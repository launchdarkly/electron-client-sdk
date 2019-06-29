const electron = require('electron');
const interprocessSync = require('./interprocessSync');

// These are functions that are *called* from front-end code (the renderer process), but actually
// *execute* on the back end (the main process). In rendererClient.js, we use "electron.remote.require"
// to get an object that represents this file; calls to the functions in that object will magically
// execute on the back end. This mechanism is used when the front end needs to request information
// from the back end synchronously (as opposed to the one-way IPC messages used in interprocessSync.js).

function getInternalClientState(optionalEnv) {
  const t = interprocessSync.getMainProcessClientStateTracker(optionalEnv);
  return t ? t.getInitedState() : null;
}

function getInternalAppPath() {
  return electron.app.getAppPath(); // electron.app.getAppPath() only exists in the main proceas
}

module.exports = {
	getInternalClientState: getInternalClientState,
	getInternalAppPath: getInternalAppPath,
};
