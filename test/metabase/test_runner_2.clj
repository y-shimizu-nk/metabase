(ns metabase.test-runner-2
  (:refer-clojure :exclude [test])
  (:require
   [clojure.java.classpath :as classpath]
   [clojure.java.io :as io]
   [clojure.pprint :as pprint]
   [clojure.set :as set]
   [clojure.string :as str]
   [clojure.test :as t]
   [clojure.tools.namespace.find :as ns.find]
   [eftest.report]
   [eftest.report.pretty]
   [eftest.report.progress]
   [eftest.runner]
   [mb.hawk.init :as hawk.init]
   [mb.hawk.parallel :as hawk.parallel]
   [mb.hawk.util :as u]
   [metabase.plugins.classloader :as classloader]
   [metabase.test.initialize :as initialize]
   [metabase.util]))

(set! *warn-on-reflection* true)

(defn run-test
  "Run a single test `test-var`. Wraps/replaces [[clojure.test/test-var]]."
  [test-var options]
  (when-let [{:keys [test], test-ns :ns} (meta test-var)]
    (when test
      (let [{::t/keys [each-fixtures once-fixtures]} (meta test-ns)]
        (binding [hawk.parallel/*parallel?* (hawk.parallel/parallel? test-var)
                  t/*testing-vars*          (conj t/*testing-vars* test-var)]
          (t/report {:type :begin-test-var, :var test-var})
          (try
            (let [thunk (reduce
                         (fn [thunk fixture]
                           (^:once fn* []
                             (fixture thunk)))
                         test
                         each-fixtures)]
              (thunk))
            (catch Throwable e
              (t/report {:type     :error
                         :message  "Uncaught exception, not in assertion."
                         :expected nil
                         :actual   e}))
            (finally
              (swap! (:finished-tests options) inc)))
          (t/report {:type :end-test-var, :var test-var}))))))

;; don't randomize test order for now please, thanks anyway
#_(alter-var-root #'eftest.runner/deterministic-shuffle (constantly (fn [_ test-vars] test-vars)))

#_(def ^:private ^ReentrantReadWriteLock lock
  (ReentrantReadWriteLock.))

(defmethod eftest.report.progress/report ::submit-test
  [{:keys [total]}]
  {:pre [(pos-int? total)]}
  (t/with-test-out
    (#'eftest.report.progress/print-progress (swap! eftest.report/*context* assoc-in [:bar :total] total))))

(defn run-test! [varr {:keys [total-tests total-parallel-tests single-threaded-tests], :as options}]
  (let [total (swap! total-tests inc)]
    (t/report {:type ::submit-test, :total total}))
  (if (hawk.parallel/parallel? varr)
    (do
      (swap! total-parallel-tests inc)
      (let [thunk (bound-fn* (^:once fn* [] (run-test varr options)))]
        (.submit clojure.lang.Agent/pooledExecutor ^Runnable thunk)))
    (swap! single-threaded-tests conj (bound-fn* (^:once fn* [] (run-test varr options))))))

(defmulti find-and-run-tests!
  "Find test vars in `arg`, which can be a string directory name, symbol naming a specific namespace or test, or a
  collection of one or more of the above."
  {:arglists '([arg options])}
  (fn [arg _options]
    (type arg)))

;; collection of one of the things below
(defmethod find-and-run-tests! clojure.lang.Sequential
  [xs options]
  (doseq [x xs]
    (find-and-run-tests! x options)))

;; directory name
(defmethod find-and-run-tests! String
  [dir-name options]
  (find-and-run-tests! (io/file dir-name) options))

(defn- exclude-directory? [dir exclude-directories]
  (when (some (fn [directory]
                (str/starts-with? (str dir) directory))
              exclude-directories)
    (println "Excluding directory" (pr-str (str dir)))
    true))

(defn- include-namespace? [ns-symbol namespace-pattern]
  (if namespace-pattern
    (re-matches (re-pattern namespace-pattern) (name ns-symbol))
    true))

;; directory
(defmethod find-and-run-tests! java.io.File
  [^java.io.File file {:keys [namespace-pattern exclude-directories], :as options}]
  (when (and (.isDirectory file)
             (not (str/includes? (str file) ".gitlibs/libs"))
             (not (exclude-directory? file exclude-directories)))
    (println "Looking for test namespaces in directory" (str file))
    (doseq [nmspace (ns.find/find-namespaces-in-dir file)
            :when   (include-namespace? nmspace namespace-pattern)]
      (find-and-run-tests! nmspace options))))

(defn- load-test-namespace [ns-symb]
  (binding [hawk.init/*test-namespace-being-loaded* ns-symb]
    (when-not ((loaded-libs) ns-symb)
      (classloader/require ns-symb))))

(defn- find-and-run-tests!-for-var-symbol
  [symb options]
  (load-test-namespace (symbol (namespace symb)))
  (let [varr (or (resolve symb)
                 (throw (ex-info (format "Unable to resolve test named %s" symb) {:test-symbol symb})))]
    (run-test! varr options)))

(defn- excluded-namespace-tags
  "Return a set of all tags in a namespace metadata that are also in the `:exclude-tags` options."
  [ns-symb options]
  (when-let [excluded-tags (not-empty (set (:exclude-tags options)))]
    (let [ns-tags (-> ns-symb find-ns meta keys set)]
      (not-empty (set/intersection excluded-tags ns-tags)))))

(defn- find-and-run-tests!-for-namespace-symbol
  [symb options]
  (load-test-namespace symb)
  (if-let [excluded-tags (not-empty (excluded-namespace-tags symb options))]
    (println (format
              "Skipping tests in `%s` due to excluded tag(s): %s"
              symb
              (->> excluded-tags sort (str/join ","))))
    (doseq [varr (eftest.runner/find-tests symb)]
      (run-test! varr options))))

;; a test namespace or individual test
(defmethod find-and-run-tests! clojure.lang.Symbol
  [symb options]
  (let [f (if (namespace symb)
            ;; a actual test var e.g. `metabase.whatever-test/my-test`
            find-and-run-tests!-for-var-symbol
            ;; a namespace e.g. `metabase.whatever-test`
            find-and-run-tests!-for-namespace-symbol)]
    (f symb options)))

;; default -- look in all dirs on the classpath
(defmethod find-and-run-tests! nil
  [_nil options]
  (find-and-run-tests! (classpath/system-classpath) options))

(defn- reporter
  "Create a new test reporter/event handler, a function with the signature `(handle-event event)` that gets called once
  for every [[clojure.test]] event, including stuff like `:begin-test-run`, `:end-test-var`, and `:fail`."
  [options]
  (let [stdout-reporter (case (:mode options)
                          (:cli/ci :repl) eftest.report.pretty/report
                          eftest.report.progress/report)]
    stdout-reporter
    #_(fn handle-event [event]
      (hawk.junit/handle-event! event)
      (stdout-reporter event))))

(defn find-and-run-tests-with-options!
  "Find tests using the options map as passed to `clojure -X`."
  [{:keys [only], :as options}]
  (println "Running tests with options" (pr-str options))
  (when only
    (println "Running tests in" (pr-str only)))
  (binding [t/report                (reporter options)
            eftest.report/*context* (atom {})]
    (t/report {:type :begin-test-run, :count 0})
    (initialize/initialize-if-needed! :db :plugins)
    (find-and-run-tests! only options)))

;; (def ^:private env-mode
;;   (cond
;;     (env/env :hawk-mode)
;;     (keyword (env/env :hawk-mode))

;;     (env/env :ci)
;;     :cli/ci))

;; (defn run-tests
;;   "Run `test-vars` with `options`, which are passed directly to [[eftest.runner/run-tests]].

;;   To run tests from the REPL, use this function.

;;     ;; run tests in a single namespace
;;     (run (find-and-run-tests! 'metabase.bad-test nil))

;;     ;; run tests in a directory
;;     (run (find-and-run-tests! \"test/hawk/query_processor_test\" nil))"
;;   ([test-vars]
;;    (run-tests test-vars nil))

;;   ([test-vars options]
;;    (let [options (merge {:mode :repl}
;;                         options)]
;;      (when-not (every? var? test-vars)
;;        (throw (ex-info "Invalid test vars" {:test-vars test-vars, :options options})))

;;      (merge
;;       (eftest.runner/run-tests
;;        test-vars
;;        (merge
;;         {:capture-output? false
;;          :multithread?    :vars
;;          :report          (reporter options)}
;;         options))
;;       @*parallel-test-counter*))))

(defn- wait-for-results [{:keys [finished-tests total-tests total-parallel-tests single-threaded-tests], :as options}]
  (if (< @finished-tests @total-parallel-tests)
    (do
      (Thread/sleep 50)
      (recur options))
    (do
      (println "\n\n" (metabase.util/emoji "🤮🤮🤮") "RUNNING SINGLE THREADED TESTS" (metabase.util/emoji "🤮🤮🤮") "\n")
      (doseq [thunk @single-threaded-tests]
        (thunk))
      {:parallel        @total-parallel-tests
       :single-threaded (- @total-tests @total-parallel-tests)
       :error           0
       :fail            0})))

(defn- find-and-run-tests-with-options
  "Entrypoint for the test runner. `options` are passed directly to `eftest`; see https://github.com/weavejester/eftest
  for full list of options."
  [options]
  (let [start-time-ms (System/currentTimeMillis)
        _             (find-and-run-tests-with-options! options)
        summary       (wait-for-results options)
        fail?         (pos? (+ (:error summary) (:fail summary)))]
    (pprint/pprint summary)
    (printf "Ran %d tests in parallel, %d single-threaded.\n" (:parallel summary 0) (:single-threaded summary 0))
    (printf "Finding and running tests took %s.\n" (u/format-milliseconds (- (System/currentTimeMillis) start-time-ms)))
    (println (if fail? "Tests failed." "All tests passed."))
    (System/exit (if fail? 1 0))
    ;; (case (:mode options)
    ;;   (:cli/local :cli/ci)
    ;;   summary)
    ))

(defn find-and-run-tests [options]
  (let [options (assoc options
                       :total-tests          (atom 0)
                       :total-parallel-tests (atom 0)
                       :finished-tests       (atom 0)
                       :single-threaded-tests (atom []))]
    (find-and-run-tests-with-options options)))
