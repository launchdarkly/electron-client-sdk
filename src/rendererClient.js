const electron = require('electron');
const browserClient = require('launchdarkly-js-client-sdk');
const interprocessSync = require('./interprocessSync');

function initializeInRenderer(optionalEnv, options = {}) {
  let env;
  let config;
  if (optionalEnv === Object(optionalEnv)) {
    config = optionalEnv;
    env = null;
  } else {
    env = optionalEnv;
    config = options;
  }
  const initialState = getMainEntryPoints().getInternalClientState(env);
  config = Object.assign({}, config, {
    stateProvider: interprocessSync.createStateProviderForRendererClient(env, initialState),
    streaming: false, // don't want the renderer client to open a stream if someone subscribes to change events
    fetchGoals: false, // click/pageview goals aren't supported in Electron
    eventUrlTransformer: makeEventUrlTransformer(),
  });
  return browserClient.initialize(env, null, config);
}

function getMainEntryPoints() {
  // See mainEntryPointsFromRenderer.js
  return electron.remote.require('launchdarkly-electron-client-sdk/src/mainEntryPointsFromRenderer');
}

function makeEventUrlTransformer() {
  // Electron renderer windows have URLs like file://path/where/app/is/installed/subpath/to/code.js - which are
  // specific to the user's local environment. Change these to just /subpath/to/code.js.
  const appPath = getMainEntryPoints().getInternalAppPath();
  const appFileUrlPrefix = filePathToUrl(appPath);
  return url => {
    if (url) {
      if (url.startsWith(appFileUrlPrefix)) {
        return url.substring(appFileUrlPrefix.length);
      } else if (url.startsWith('file:')) {
        // This is for the unlikely case where the application opens a window that loads an HTML file from
        // somewhere else in the filesystem that's not part of the app, which in turn loads some JS code that
        // is from the app and uses LaunchDarkly. There's no meaningful URL for analytics events in that case.
        return null;
      }
    }
    return url;
  };
}

function filePathToUrl(filePath) {
  // Adapted from https://github.com/sindresorhus/file-url
  const pathWithNormalizedSeparators = filePath.replace(/\\/g, '/');

  // in Windows, drive letter must be prefixed with a slash
  const pathName =
    pathWithNormalizedSeparators[0] === '/' ? pathWithNormalizedSeparators : `/${pathWithNormalizedSeparators}`;

  // Escape required characters for path components
  // See: https://tools.ietf.org/html/rfc3986#section-3.3
  return encodeURI(`file://${pathName}`).replace(/[?#]/g, encodeURIComponent);
}

module.exports = {
  initializeInRenderer: initializeInRenderer,
};
