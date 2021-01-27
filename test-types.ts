
// This file exists only so that we can run the TypeScript compiler in the CI build
// to validate our typings.d.ts file.

import * as ld from 'launchdarkly-electron-client-sdk';

var emptyOptions: ld.LDOptions = {};
var logger: ld.LDLogger = ld.createConsoleLogger("info");
var allOptions: ld.LDOptions = {
  bootstrap: { },
  baseUrl: '',
  eventsUrl: '',
  streamUrl: '',
  streaming: true,
  useReport: true,
  sendLDHeaders: true,
  evaluationReasons: true,
  sendEvents: true,
  allAttributesPrivate: true,
  privateAttributeNames: [ 'x' ],
  allowFrequentDuplicateEvents: true,
  sendEventsOnlyForVariation: true,
  flushInterval: 1,
  samplingInterval: 1,
  streamReconnectDelay: 1,
  logger: logger,
  autoAliasingOptOut: true
};
var user: ld.LDUser = { key: 'user' };
var anonymousUser: ld.LDUser = { key: 'anon-user', anonymous: true };

// Note that there are three slightly different client interfaces provided by the SDK

var client1: ld.LDElectronMainClient = ld.initializeInMain('env', user, allOptions);
var client2: ld.LDElectronRendererClient = ld.initializeInRenderer('env', allOptions);
var client2WithDefaults: ld.LDElectronRendererClient = ld.initializeInRenderer();
var client3: ld.LDElectronNodeAdapterClient = ld.createNodeSdkAdapter(client1);

client1.waitUntilReady().then(() => {});
client1.waitForInitialization().then(() => {});
client2.waitUntilReady().then(() => {});
client2.waitForInitialization().then(() => {});
client3.waitUntilReady().then(() => {});
client3.waitForInitialization().then(() => {});

client1.identify(user).then(() => {});
client1.identify(user, undefined, () => {});
client1.identify(user, 'hash').then(() => {});
client2.identify(user).then(() => {});
client2.identify(user, undefined, () => {});
client2.identify(user, 'hash').then(() => {});
client3.identify(user); // LDElectronNodeAdapterClient has server-side semantics for identify()

client1.alias(user, anonymousUser);
client2.alias(user, anonymousUser);
client3.alias(user, anonymousUser);

var user1: ld.LDUser = client1.getUser();
var user2: ld.LDUser = client2.getUser();
// LDElectronNodeAdapterClient does not have getUser()

client1.flush(() => {});
client1.flush().then(() => {});
client2.flush(() => {});
client2.flush().then(() => {});
client3.flush(() => {});
client3.flush().then(() => {});

var boolFlagValue1: ld.LDFlagValue = client1.variation('key', false);
var numberFlagValue1: ld.LDFlagValue = client1.variation('key', 2);
var stringFlagValue1: ld.LDFlagValue = client1.variation('key', 'default');
var boolFlagValue2: ld.LDFlagValue = client2.variation('key', false);
var numberFlagValue2: ld.LDFlagValue = client2.variation('key', 2);
var stringFlagValue2: ld.LDFlagValue = client2.variation('key', 'default');
// LDElectronNodeAdapterClient has asynchronous variation() like server-side SDKs
client3.variation('key', user, false, () => {});
client3.variation('key', user, false).then(() => {});

var detail1: ld.LDEvaluationDetail = client1.variationDetail('key', 'default');
var detail2: ld.LDEvaluationDetail = client2.variationDetail('key', 'default');
// LDElectronNodeAdapterClient has asynchronous variationDetail() like server-side SDKs
client3.variationDetail('key', user, false, (value: ld.LDFlagValue) => {});
client3.variationDetail('key', user, false).then((value: ld.LDFlagValue) => {});

var detailValue: ld.LDFlagValue = detail1.value;
var detailIndex: number | undefined = detail1.variationIndex;
var detailReason: ld.LDEvaluationReason = detail1.reason;

client1.setStreaming(true);
client1.setStreaming();
client2.setStreaming(true);
client2.setStreaming();

function handleEvent() {}
client1.on('event', handleEvent);
client1.off('event', handleEvent);
client2.on('event', handleEvent);
client2.off('event', handleEvent);

client1.track('event');
client1.track('event', { someData: 'x' });
client1.track('event', null, 3.5);
client2.track('event');
client2.track('event', { someData: 'x' });
client2.track('event', null, 3.5);
client3.track('event', user);
client3.track('event', user, { someData: 'x' });

var flagSet1: ld.LDFlagSet = client1.allFlags();
var flagSet2: ld.LDFlagSet = client2.allFlags();
client3.allFlagsState(user, (flags: ld.LDFlagSet) => {});
client3.allFlagsState(user).then((flags: ld.LDFlagSet) => {});

var flagSetValue: ld.LDFlagValue = flagSet1['key'];

client1.close(() => {});
client1.close().then(() => {});
client2.close(() => {});
client2.close().then(() => {});
client3.close();

var isOffline: boolean = client3.isOffline();
