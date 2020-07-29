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
