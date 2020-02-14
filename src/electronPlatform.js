const os = require('os');
const storage = require('electron-json-storage');
const { EventSource } = require('launchdarkly-eventsource');
const newHttpRequest = require('./httpRequest');
const packageJson = require('../package.json');

function makeElectronPlatform(options) {
  const tlsParams = filterTlsParams(options && options.tlsParams);

  const ret = {};

  ret.httpRequest = (method, url, headers, body) => newHttpRequest(method, url, headers, body, tlsParams);

  ret.httpAllowsPost = () => true;

  ret.getCurrentUrl = () => null;

  ret.isDoNotTrack = () => false;

  ret.localStorage = {
    get: key =>
      new Promise((resolve, reject) => storage.get(key, (err, value) => (err ? reject(err) : resolve(value)))),
    set: (key, value) =>
      new Promise((resolve, reject) => storage.set(key, value, err => (err ? reject(err) : resolve()))),
    clear: key => new Promise((resolve, reject) => storage.remove(key, err => (err ? reject(err) : resolve()))),
  };

  ret.eventSourceFactory = (url, options) => new EventSource(url, options);
  ret.eventSourceIsActive = es => es.readyState === EventSource.OPEN || es.readyState === EventSource.CONNECTING;
  ret.eventSourceAllowsReport = true;

  ret.userAgent = 'ElectronClient';
  ret.version = packageJson.version;

  ret.diagnosticSdkData = {
    name: 'electron-client-sdk',
    version: packageJson.version,
  };

  ret.diagnosticPlatformData = {
    name: 'Electron',
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    osArch: os.arch(),
    osName: normalizePlatformName(os.platform()),
    osVersion: os.release(),
  };

  return ret;
}

function normalizePlatformName(platformName) {
  // The following logic is based on how Node.js reports the platform name
  switch (platformName) {
    case 'darwin':
      return 'MacOS';
    case 'win32':
      return 'Windows';
    case 'linux':
      return 'Linux';
    default:
      return platformName;
  }
}

const httpsOptions = [
  'pfx',
  'key',
  'passphrase',
  'cert',
  'ca',
  'ciphers',
  'rejectUnauthorized',
  'secureProtocol',
  'servername',
  'checkServerIdentity',
];

function filterTlsParams(tlsParams) {
  const input = tlsParams || {};
  return Object.keys(input)
    .filter(key => httpsOptions.includes(key))
    .reduce((obj, key) => Object.assign({}, obj, { [key]: input[key] }), {});
}

module.exports = makeElectronPlatform;
