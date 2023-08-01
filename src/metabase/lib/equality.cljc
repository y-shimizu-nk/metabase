(ns metabase.lib.equality
  "Logic for determining whether two pMBQL queries are equal."
  (:refer-clojure :exclude [=])
  (:require
   [medley.core :as m]
   [metabase.lib.dispatch :as lib.dispatch]
   [metabase.lib.hierarchy :as lib.hierarchy]
   [metabase.lib.metadata :as lib.metadata]
   [metabase.lib.options :as lib.options]
   [metabase.lib.ref :as lib.ref]
   [metabase.lib.schema.common :as lib.schema.common]
   [metabase.lib.schema.ref :as lib.schema.ref]
   [metabase.mbql.util.match :as mbql.u.match]
   [metabase.util.malli :as mu]))

(defmulti =
  "Determine whether two already-normalized pMBQL maps, clauses, or other sorts of expressions are equal. The basic rule
  is that two things are considered equal if they are [[clojure.core/=]], or, if they are both maps, if they
  are [[clojure.core/=]] if you ignore all qualified keyword keys besides `:lib/type`."
  {:arglists '([x y])}
  ;; two things with different dispatch values (for maps, the `:lib/type` key; for MBQL clauses, the tag, and for
  ;; everything else, the `:dispatch-type/*` key) can't be equal.
  (fn [x y]
    (let [x-dispatch-value (lib.dispatch/dispatch-value x)
          y-dispatch-value (lib.dispatch/dispatch-value y)]
      (if (not= x-dispatch-value y-dispatch-value)
        ::different-dispatch-values
        x-dispatch-value)))
  :hierarchy lib.hierarchy/hierarchy)

(defmethod = ::different-dispatch-values
  [_x _y]
  false)

(defn- relevant-keys-set
  "Set of keys in a map that we consider relevant for [[=]] purposes."
  [m]
  (into #{}
        (remove (fn [k]
                  (and (qualified-keyword? k)
                       (not= k :lib/type))))
        (keys m)))

(defmethod = :dispatch-type/map
  [m1 m2]
  (let [m1-keys (relevant-keys-set m1)
        m2-keys (relevant-keys-set m2)]
    (and (clojure.core/= m1-keys m2-keys)
         (every? (fn [k]
                   (= (get m1 k)
                      (get m2 k)))
                 m1-keys))))

(defmethod = :dispatch-type/sequential
  [xs ys]
  (and (clojure.core/= (count xs) (count ys))
       (loop [[x & more-x] xs, [y & more-y] ys]
         (and (= x y)
              (or (empty? more-x)
                  (recur more-x more-y))))))

(def ^:private ^:dynamic *side->uuid->index* nil)

(defn- aggregation-uuid->index
  [stage]
  (into {}
        (map-indexed (fn [idx [_tag {ag-uuid :lib/uuid}]]
                       [ag-uuid idx]))
        (:aggregation stage)))

(defmethod = :mbql.stage/mbql
  [x y]
  (binding [*side->uuid->index* {:left (aggregation-uuid->index x)
                                 :right (aggregation-uuid->index y)}]
    ((get-method = :dispatch-type/map) x y)))

(defmethod = :aggregation
  [[x-tag x-opts x-uuid :as x] [y-tag y-opts y-uuid :as y]]
  (and (clojure.core/= 3 (count x) (count y))
       (clojure.core/= x-tag y-tag)
       (= x-opts y-opts)
       ;; If nil, it means we aren't comparing a stage, so just compare the uuid directly
       (if *side->uuid->index*
         (clojure.core/= (get-in *side->uuid->index* [:left x-uuid] ::no-left)
                         (get-in *side->uuid->index* [:right y-uuid] ::no-right))
         (clojure.core/= x-uuid y-uuid))))

;;; if we've gotten here we at least know the dispatch values for `x` and `y` are the same, which means the types will
;;; be the same.
(defmethod = :default
  [x y]
  (cond
    (map? x)        ((get-method = :dispatch-type/map) x y)
    (sequential? x) ((get-method = :dispatch-type/sequential) x y)
    :else           (clojure.core/= x y)))

(defn- update-options-remove-namespaced-keys [a-ref]
  (lib.options/update-options a-ref (fn [options]
                                      (into {} (remove (fn [[k _v]] (qualified-keyword? k))) options))))

(defn- field-id-ref? [a-ref]
  (mbql.u.match/match-one a-ref
    [:field _opts (_id :guard pos-int?)]))

(defn- named-refs-for-integer-refs [metadata-providerable refs]
  (keep (fn [a-ref]
          (mbql.u.match/match-one a-ref
            [:field opts (field-id :guard integer?)]
            (when-let [field-name (:name (lib.metadata/field metadata-providerable field-id))]
              [:field opts field-name])))
        refs))

(defn find-closest-matches-for-refs
  "For each ref in `needles`, find the ref in `haystack` that it most closely matches. This is meant to power things
  like [[metabase.lib.breakout/breakoutable-columns]] which are supposed to include `:breakout-position` for columns
  that are already present as a breakout; sometimes the column in the breakout does not exactly match what MLv2 would
  have generated. So try to figure out which column it is referring to.

  This first looks for each matching ref with a strict comparison, then in increasingly less-strict comparisons until it
  finds something that matches. This is mostly to work around bugs like #31482 where MLv1 generated queries with
  `:field` refs that did not include join aliases even though the Fields came from joined Tables... we still know the
  Fields are the same if they have the same IDs.

  The three-arity version can also find matches between integer Field ID references like `[:field {} 1]` and
  equivalent string column name field literal references like `[:field {} \"bird_type\"]` by resolving Field IDs using
  a `metadata-providerable` (something that can be treated as a metadata provider, e.g. a `query` with a
  MetadataProvider associated with it). This is the ultimately hacky workaround for totally busted legacy queries.

  Note that this currently only works when `needles` contain integer Field IDs. The `haystack` refs must have string
  literal column names. Luckily we currently don't have problems with MLv1/legacy queries accidentally using string
  `:field` literals where it shouldn't have been doing so.

  Returns a list parallel to `needles`, where each element is either nil (no match) or the index of the most closely
  matching ref in `haystack`.

  IMPORTANT!

  When trying to find the matching ref for a sequence of metadatas, prefer [[index-of-closest-matching-metadata]]
  or [[closest-matching-metadata]] instead, which are less
  broken (see [[metabase.lib.equality-test/index-of-closest-matching-metadata-test]]) and is slightly more performant,
  since it converts metadatas to refs in a lazy fashion."
  ([needles haystack]
   (loop [xforms      [identity ; Start with no transformation at all.
                       ;; ignore irrelevant keys from :binning options
                       #(lib.options/update-options % m/update-existing :binning dissoc :metadata-fn :lib/type)
                       ;; ignore namespaced keys
                       update-options-remove-namespaced-keys
                       ;; ignore type info
                       #(lib.options/update-options % dissoc :base-type :effective-type)
                       ;; ignore temporal-unit
                       #(lib.options/update-options % dissoc :temporal-unit)
                       ;; ignore binning
                       #(lib.options/update-options % dissoc :binning)
                       ;; ignore join alias
                       #(lib.options/update-options % dissoc :join-alias)]
          haystack-xf haystack
          ;; The output list of found indexes, all nil to start.
          results      (vec (repeat (count needles) nil))
          ;; A map of needles left to find. Keys are indexes, values are the refs to find.
          needles      (into {} (map-indexed vector needles))]
     (if (or (empty? needles)
             (empty? xforms)
             (every? some? results))
       results
       (let [xformed (map (first xforms) haystack-xf)
             needles (update-vals needles (first xforms))
             matches (for [[needle-index a-ref] needles
                           :let [haystack-index (first (keep-indexed #(when (= %2 a-ref) %1) xformed))]
                           :when haystack-index]
                       [needle-index haystack-index])
             finished-needles (set (map first matches))]
         ;; matches is a list of [index-in-results index-in-haystack] pairs
         (recur (rest xforms)
                xformed
                ;; Don't overwrite an already-populated index in the results - if it's already filled in, it was set by
                ;; an earlier, more precise match. Note that "needles" with integer field refs have the a duplicate with
                ;; the corresponding :name added as a duplicate needle. The first to match should win.
                (reduce (fn [res [at to]] (update res at #(or % to))) results matches)
                (m/remove-keys finished-needles needles))))))

  ([metadata-providerable needles haystack]
   ;; First run with the needles as given.
   (let [matches (find-closest-matches-for-refs needles haystack)
         blanks  (keep-indexed #(when-not %2 %1) matches)
         ;; Then if any of the needles were not found, try converting them to :name refs and search again.
         by-name (when (seq blanks)
                   (find-closest-matches-for-refs (map #(nth needles %) blanks) haystack))]
     (when (seq by-name)
       (reduce (fn [matches at]
                 (when-let [named (nth by-name at)]
                   (update matches at )
                   )
                 ))
       )
     (find-closest-matches-for-refs (concat needles named-needles) haystack))))

(mu/defn index-of-closest-matching-metadata :- [:maybe ::lib.schema.common/int-greater-than-or-equal-to-zero]
  "Like [[find-closest-matching-ref]], but finds the closest match for `a-ref` from a sequence of Column `metadatas`
  rather than a sequence of refs. This allows us to do more sophisticated fuzzy matching
  than [[find-closest-matching-ref]], because column metadatas inherently have more information than they do after
  they are converted to refs.

  If a match is found, this returns the index of the matching metadata in `metadatas`. Otherwise returns `nil.` If you
  want the metadata instead, use [[closest-matching-metadata]]."
  [a-ref     :- ::lib.schema.ref/ref
   metadatas :- [:maybe [:sequential lib.metadata/ColumnMetadata]]]
  (when (seq metadatas)
    ;; create refs in a lazy fashion, e.g. if the very first metadata ends up matching we don't need to create refs
    ;; for all of the other metadatas.
    (letfn [(index-with-ref-fn [ref-fn]
              ;; store the associated index in metadata attached to the created ref.
              (let [refs (for [[i metadata] (m/indexed metadatas)]
                           (vary-meta (ref-fn metadata) assoc ::index i))]
                (when-let [matching-ref (find-closest-matching-ref a-ref refs)]
                  (::index (meta matching-ref)))))]
      (or
       ;; attempt to find a matching ref using the same logic as [[find-closest-matching-ref]] ...
       (index-with-ref-fn lib.ref/ref)
       ;; if that fails, and we're comparing a "Field ID" ref like
       ;;
       ;;    [:field {} 1]
       ;;
       ;; then try again forcing creation of Field ID refs for all of the metadatas. This way we can match
       ;; things where the FE incorrectly used a Field ID ref even tho we were expecting a nominal :field
       ;; literal ref like
       ;;
       ;;    [:field {} "my_field"]
       (when (field-id-ref? a-ref)
         ;; force creation of a Field ID ref by giving it a source that will make the ref creation code
         ;; treat this as coming from a source table. This only makes sense for metadatas that have an
         ;; associated Field `:id`, so only do it for those ones.
         (index-with-ref-fn (fn [metadata]
                              (lib.ref/ref
                               (cond-> metadata
                                 (:id metadata) (assoc :lib/source :source/table-defaults))))))))))

(mu/defn closest-matching-metadata :- [:maybe lib.metadata/ColumnMetadata]
  "Like [[find-closest-matching-ref]], but finds the closest match for `a-ref` from a sequence of Column `metadatas`
  rather than a sequence of refs. See [[index-of-closet-matching-metadata]] for more info."
  [a-ref     :- ::lib.schema.ref/ref
   metadatas :- [:maybe [:sequential lib.metadata/ColumnMetadata]]]
  (when-let [i (index-of-closest-matching-metadata a-ref metadatas)]
    (nth metadatas i)))

(defn mark-selected-columns
  "Mark `columns` as `:selected?` if they appear in `selected-columns-or-refs`. Uses fuzzy matching
  with [[index-of-closest-matching-metadata]].

  Example usage:

    ;; example (simplified) implementation of [[metabase.lib.field/fieldable-columns]]
    ;;
    ;; return (visibile-columns query), but if any of those appear in `:fields`, mark then `:selected?`
    (mark-selected-columns (visibile-columns query) (:fields stage))"
  [cols selected-columns-or-refs]
  (when (seq cols)
    (let [selected-refs              (mapv lib.ref/ref selected-columns-or-refs)
          matching-selected-indecies (into #{}
                                           (map (fn [selected-ref]
                                                  (index-of-closest-matching-metadata selected-ref cols)))
                                           selected-refs)]
      (mapv
       (fn [[i col]]
         (assoc col :selected? (contains? matching-selected-indecies i)))
       (m/indexed cols)))))
