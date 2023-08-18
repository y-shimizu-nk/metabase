/* eslint-env node */
/* eslint-disable import/no-commonjs */
/* eslint-disable import/order */

const ASSETS_PATH = __dirname + "/resources/frontend_client/app/assets";
const FONTS_PATH = __dirname + "/resources/frontend_client/app/fonts";
const SRC_PATH = __dirname + "/frontend/src/metabase";
const LIB_SRC_PATH = __dirname + "/frontend/src/metabase-lib";
const ENTERPRISE_SRC_PATH =
  __dirname + "/enterprise/frontend/src/metabase-enterprise";
const TYPES_SRC_PATH = __dirname + "/frontend/src/metabase-types";
const CLJS_SRC_PATH = __dirname + "/frontend/src/cljs_release";
const CLJS_SRC_PATH_DEV = __dirname + "/frontend/src/cljs";
const TEST_SUPPORT_PATH = __dirname + "/frontend/test/__support__";
const E2E_PATH = __dirname + "/e2e";

// default WEBPACK_BUNDLE to development
const WEBPACK_BUNDLE = process.env.WEBPACK_BUNDLE || "development";
const devMode = WEBPACK_BUNDLE !== "production";

const alias = {
  assets: ASSETS_PATH,
  fonts: FONTS_PATH,
  metabase: SRC_PATH,
  "metabase-lib": LIB_SRC_PATH,
  "metabase-enterprise": ENTERPRISE_SRC_PATH,
  "metabase-types": TYPES_SRC_PATH,
  "metabase-dev": `${SRC_PATH}/dev${devMode ? "" : "-noop"}.js`,
  cljs: devMode ? CLJS_SRC_PATH_DEV : CLJS_SRC_PATH,
  __support__: TEST_SUPPORT_PATH,
  e2e: E2E_PATH,
  style: SRC_PATH + "/css/core/index",
  ace: __dirname + "/node_modules/ace-builds/src-min-noconflict",
  // NOTE @kdoh - 7/24/18
  // icepick 2.x is es6 by defalt, to maintain backwards compatability
  // with ie11 point to the minified version
  icepick: __dirname + "/node_modules/icepick/icepick.min",
  // conditionally load either the EE plugins file or a empty file in the CE code tree
  "ee-plugins":
    process.env.MB_EDITION === "ee"
      ? ENTERPRISE_SRC_PATH + "/plugins"
      : SRC_PATH + "/lib/noop",
  "ee-overrides":
    process.env.MB_EDITION === "ee"
      ? ENTERPRISE_SRC_PATH + "/overrides"
      : SRC_PATH + "/lib/noop",
};

module.exports = {
  alias,
};
