const electron = require('electron');
const ldElectron = require('launchdarkly-electron-client-sdk');

const ldTestConfig = electron.remote.getGlobal('global').ldTestConfig;

document.getElementById('test-title').innerHTML = ldTestConfig.testName;

const userKeyInput = document.getElementById('user');
userKeyInput.value = ldTestConfig.userKey;

const statusElements = [];

document.getElementById('set-user').addEventListener('click', () => {
  statusElements.forEach(e => {
    // eslint-disable-next-line no-param-reassign
    e.innerHTML = 'changed user, waiting...';
  });
  electron.ipcRenderer.send('changeUser', userKeyInput.value);
});

const allClientsDiv = document.getElementById('test-clients');

function startClient(index, env) {
  const clientDiv = document.createElement('div');
  clientDiv.id = 'client' + index;
  clientDiv.innerHTML = `client [${index}] environment [${env}] `;
  const eventButton = document.createElement('button');
  eventButton.id = 'event' + index;
  eventButton.innerHTML = 'send event';
  clientDiv.append(eventButton);
  const statusElement = document.createElement('span');
  statusElement.id = 'status' + index;
  statusElement.innerHTML = 'waiting...';
  clientDiv.append(statusElement);
  statusElements.push(statusElement);
  const outputDiv = document.createElement('pre');
  outputDiv.id = 'output' + index;
  clientDiv.append(statusElement);
  clientDiv.append(outputDiv);
  allClientsDiv.append(clientDiv);

  let previousOutput = null;
  let updateCount = 0;

  const client = ldElectron.initializeInRenderer(env, {
    logger: ldElectron.createConsoleLogger('debug'),
  });

  function updateFlagValues() {
    const flagsAndValues = client.allFlags();
    const flagsString = Object.keys(flagsAndValues)
      .sort()
      .map(key => key + '=' + flagsAndValues[key])
      .join(',');
    const output = client.getUser().key + ':' + flagsString;
    if (output !== previousOutput) {
      outputDiv.innerHTML = output;
      if (previousOutput) {
        updateCount++;
        statusElement.innerHTML = `updated (${updateCount})`;
      } else {
        statusElement.innerHTML = 'loaded';
      }
      previousOutput = output;
    }
  }

  client.on('change', updateFlagValues);
  client.on('ready', updateFlagValues);

  eventButton.addEventListener('click', () => {
    client.track('my-event');
  });
}

for (const i in ldTestConfig.envIds) {
  startClient(i, ldTestConfig.envIds[i]);
}
