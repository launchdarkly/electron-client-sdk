const electron = require('electron');
const parseArgs = require('minimist');
const ldElectron = require('launchdarkly-electron-client-sdk');

const app = electron.app;

const args = parseArgs(process.argv.slice(2));

const ldOptions = {
  logger: ldElectron.createConsoleLogger('debug'),
  streaming: args.streaming,
  useReport: true,
};

if (args.httpRequest === true) {
  ldOptions.httpRequest = makeElectronNetHttpRequest;
}

const testConfig = {
  testName: 'test name unknown',
  envIds: ['default-env'],
  userKey: 'test-user-key',
};

global.ldTestConfig = testConfig; // this is so window.js can access it

if (args.e) {
  testConfig.envIds = args.e.split(',');
}

if (args.t) {
  testConfig.testName = args.t;
}

if (args.u) {
  testConfig.userKey = args.u;
}

if (args.s) {
  ldOptions.baseUrl = args.s;
  ldOptions.streamUrl = args.s;
  ldOptions.eventsUrl = args.s;
}

app.on('ready', () => {
  const uniqueEnvIds = Array.from(new Set(testConfig.envIds));
  const user = { key: testConfig.userKey };
  uniqueEnvIds.forEach(envId => {
    const ldClient = ldElectron.initializeInMain(envId, user, ldOptions);
    // The automatic flush interval can't be set to less than 2 seconds. To make event tests less slow,
    // we'll use our own more frequent flush timer.
    setInterval(() => ldClient.flush(), 250);

    electron.ipcMain.on('changeUser', (event, newUserKey) => {
      ldClient.identify({ key: newUserKey });
    });
  });

  const w = new electron.BrowserWindow({ width: 800, height: 600, webPreferences: { nodeIntegration: true } });
  w.loadURL(`file://${__dirname}/testAppWindow.html`);
});

// Quit when all windows are closed.
app.on('window-all-closed', () => app.quit());

function makeElectronNetHttpRequest(method, url, headers, body) {
  let request;
  let rejectRequest;
  const promise = new Promise((resolve, reject) => {
    rejectRequest = reject;
    request = electron.net.request({ method, url });
    Object.keys(headers).forEach(name => request.setHeader(name, headers[name]));
    request.setHeader('X-Test-Http-Request', 'electron.net');

    request.on('response', response => {
      let responseBody = '';
      let responseEnded = false;

      response.on('data', chunk => {
        responseBody += chunk;
      });
      response.on('error', reject);
      response.on('aborted', () => reject(new Error('response aborted')));
      response.on('end', () => {
        responseEnded = true;
        if (response.complete === false) {
          reject(new Error('response body was incomplete'));
          return;
        }

        const responseHeaders = Object.keys(response.headers).reduce((result, name) => {
          const value = response.headers[name];
          return Object.assign({}, result, {
            [name.toLowerCase()]: Array.isArray(value) ? value.join(', ') : String(value),
          });
        }, {});
        resolve({
          status: response.statusCode,
          header: name => responseHeaders[name.toLowerCase()],
          body: responseBody,
        });
      });
      response.on('close', () => {
        if (!responseEnded) {
          reject(new Error('response body was incomplete'));
        }
      });
    });
    request.on('error', reject);
    request.on('abort', () => reject(new Error('request aborted')));
    if (body) {
      request.write(body);
    }
    request.end();
  });

  return {
    promise,
    cancel: () => {
      request.abort();
      rejectRequest(new Error('request aborted'));
    },
  };
}
