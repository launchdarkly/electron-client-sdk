const common = require('launchdarkly-js-sdk-common');
const winston = require('winston');
const electronPlatform = require('./electronPlatform');
const interprocessSync = require('./interprocessSync');
const nodeSdkEmulation = require('./nodeSdkEmulation');
const rendererClient = require('./rendererClient');
const packageJson = require('../package.json');

// This creates an SDK instance to be used in the main process of Electron. It can be used
// either by itself or in combination with SDK instances in renderer windows (created with
// initializeRenderer).
function initializeInMain(env, user, options = {}) {
  // Pass our platform object to the common code to create the Electron version of the client
  const platform = electronPlatform(options);
  const extraDefaults = {};
  if (!options.logger) {
    extraDefaults.logger = createDefaultLogger();
  }
  const clientVars = common.initialize(env, user, options, platform, extraDefaults);
  const client = clientVars.client;

  // This tracker object communicates with any client instances in the renderer process that
  // were created with initializeInRenderer(), to keep them in sync with our state. If there
  // are no such clients, it has no effect.
  const tracker = interprocessSync.createMainProcessClientStateTracker(env, user, clientVars.logger);
  client.on('ready', () => tracker.initialized(clientVars.getFlagsInternal()));
  client.on(clientVars.internalChangeEventName, tracker.updatedFlags);
  tracker.on('event', event => clientVars.enqueueEvent(event));

  const realIdentify = client.identify;
  client.identify = (user, hash, cb) => {
    tracker.changedUser(user);
    return realIdentify(user, hash, cb);
  };

  // This method is probably not of much use in Electron since we have a better way to send flag
  // data to the front end, but it exists in all the server-side SDKs so why not.
  client.allFlagsState = () => {
    const flags = clientVars.getFlagsInternal();
    const result = {};
    const metadata = {};
    Object.keys(flags).forEach(key => {
      const flagState = Object.assign({}, flags[key]);
      result[key] = flagState.value;
      delete flagState.value;
      metadata[key] = flagState;
    });
    result['$flagsState'] = metadata;
    result['$valid'] = true;
    return result;
  };

  clientVars.start();

  return clientVars.client;
}

function createDefaultLogger() {
  return new winston.Logger({
    level: 'warn',
    transports: [
      new winston.transports.Console({
        formatter: options => '[LaunchDarkly] ' + (options.message || ''),
      }),
    ],
  });
}

module.exports = {
  initializeInMain: initializeInMain,
  initializeInRenderer: rendererClient.initializeInRenderer,
  createNodeSdkAdapter: nodeSdkEmulation.createNodeSdkAdapter,
  createConsoleLogger: common.createConsoleLogger,
  version: packageJson.version,
};
