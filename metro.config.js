// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

/**
 * Demo builds (SSJ_DEMO=1, set by `npm run demo` / `npm run build:demo`)
 * swap the demo switch module for its "on" version, which brings in a
 * pretend backend and sample catalogue.
 *
 * The swap happens here, at bundle time, rather than with an `if` in the
 * app: a production build then never even resolves the demo files, so no
 * demo code or placeholder photo can end up in the real app or website.
 */
if (process.env.SSJ_DEMO === "1") {
  const demoModule = path.resolve(__dirname, "src/demo/on.ts");
  const isDemoSwitch = (name) =>
    name === "@/demo/mode" || /[\\/]src[\\/]demo[\\/]mode(\.ts)?$/.test(name);

  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (isDemoSwitch(moduleName)) {
      return { type: "sourceFile", filePath: demoModule };
    }
    return upstream
      ? upstream(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
