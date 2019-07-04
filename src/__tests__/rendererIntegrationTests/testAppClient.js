const electron = require('electron');
const path = require('path');
const spectron = require('spectron');

// Helper functions for manipulating the Electron application used by the integration tests.
//
// Usage:
//   const fld = await fakeLaunchDarkly();
//   const app = testAppClient(fld, defaultOptions);
//   await app.start(anyMoreOptions);
//   // do some things
//   await app.close();
//
// Options:
//   env: either a single environment ID or an array; it will create one client for each of these
//   testName: will be displayed in the window
//   userKey: clients will be initialized with this user
//   streaming: true to enable streaming

function testAppClient(fakeLD, baseOptions) {
  let app;
  let numClients;
  const timeout = 2000;
  const options = Object.assign({}, baseOptions);
  const me = {};

  async function waitForClientStatus(status) {
    for (let i = 0; i < numClients; i++) {
      await app.client.waitUntilTextExists('#status' + i, status, timeout);
    }
  }

  async function getClientOutput(index) {
    const output = await app.client.getText('#output' + (index || 0));
    const fields = output.split(':');
    const flags = {};
    fields[1].split(',').forEach(s => {
      const fields1 = s.split('=');
      flags[fields1[0]] = fields1[1];
    });
    return { userKey: fields[0], flags: flags };
  }

  me.start = async addOptions => {
    Object.assign(options, addOptions);
    const args = [path.join(__dirname, 'testAppMain.js')];
    const envs = Array.isArray(options.env) ? options.env : [options.env];
    numClients = envs.length;

    args.push('-s', fakeLD.url);
    args.push('-t', options.testName);
    args.push('-u', options.userKey);
    args.push('-e', envs.join(','));
    options.streaming && args.push('--streaming');

    app = new spectron.Application({
      path: electron,
      args: args,
    });

    await app.start();
    await app.client.waitUntilWindowLoaded();
    await waitForClientStatus('loaded');
  };

  me.close = async () => {
    if (options.dumpLogs) {
      const logs = await app.client.getMainProcessLogs();
      console.log(logs.join('\n'));
    }
    if (app.isRunning()) {
      await app.stop();
    }
  };

  // Waits until all clients have received new flag values
  me.waitUntilClientsUpdated = async updateCount => {
    await waitForClientStatus(`updated (${updateCount || 1})`);
  };

  // Causes the main process to call identify() on all clients
  me.switchUser = async key => {
    await app.client.setValue('#user', key);
    await app.client.click('#set-user');
  };

  // Returns the current front-end user key - specify index if there are multiple clients
  me.getClientUserKey = async index => {
    const output = await getClientOutput(index);
    return output.userKey;
  };

  // Returns the current flag keys and values - specify index if there are multiple clients
  me.getClientFlags = async index => {
    const output = await getClientOutput(index);
    return output.flags;
  };

  return me;
}

module.exports = testAppClient;
