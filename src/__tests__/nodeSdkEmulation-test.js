import * as httpServer from './http-server';

import * as LDClient from '../index';

// These tests verify that the methods provided by nodeSdkEmulation.js behave the way a user of
// the Node SDK would expect them to behave.

describe('Node-style API wrapper', () => {
  const envName = 'UNKNOWN_ENVIRONMENT_ID';
  const user = { key: 'user' };
  const otherUser = { key: 'other' };
  const flags = { flag: { value: 'a', variation: 1 } };
  const flagsBootstrap = { flag: 'a', $flagsState: { flag: { variation: 1 } } };
  const flagKey = 'flag';
  const flagValue = 'a';
  let warnSpy;
  let server;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    httpServer.closeServers();
    warnSpy.mockRestore();
  });

  async function makeServerWithFlags() {
    server = await httpServer.createServer();
    httpServer.autoRespond(server, res => httpServer.respondJson(res, flags));
    return server;
  }

  async function makeServerWithError() {
    server = await httpServer.createServer();
    httpServer.autoRespond(server, res => httpServer.respond(res, 401));
    return server;
  }

  function createWrappedClient(options) {
    const baseConfig = {
      baseUrl: server.url,
      eventsUrl: server.url
    }
    const client = LDClient.initializeInMain(envName, user, Object.assign(baseConfig, options));
    return LDClient.createNodeSdkAdapter(client);
  }

  function asyncTestWithIdentify(testFn) {
    async function doTest(changeUser, bootstrap) {
      await (changeUser ? makeServerWithFlags() : makeServerWithError());
      const wrappedClient = createWrappedClient({ bootstrap: bootstrap });
      await wrappedClient.waitForInitialization();
      await testFn(wrappedClient, changeUser ? otherUser : user);
    }

    it('when user is not changed', async () => await doTest(false, flagsBootstrap));

    it('when user is changed', async () => await doTest(true, {}));
  }

  it('supports initialized()', async () => {
    await makeServerWithFlags();
    const wrappedClient = createWrappedClient();
    expect(wrappedClient.initialized()).toBe(false);

    await wrappedClient.waitForInitialization();
    expect(wrappedClient.initialized()).toBe(true);
  });

  describe('waitUntilReady()', () => {
    it('resolves on success', async () => {
      await makeServerWithFlags();
      const wrappedClient = createWrappedClient();
      await wrappedClient.waitUntilReady();
    });

    it('resolves on failure', async () => {
      await makeServerWithError();
      const wrappedClient = createWrappedClient();
      await wrappedClient.waitUntilReady();
    });
  });

  describe('waitForInitialization()', () => {
    it('resolves on success', async () => {
      await makeServerWithFlags();
      const wrappedClient = createWrappedClient();
      const result = await wrappedClient.waitForInitialization();
      expect(result).toBe(wrappedClient);
    });

    it('rejects on failure', async () => {
      await makeServerWithError();
      const wrappedClient = createWrappedClient();
      await expect(wrappedClient.waitForInitialization()).rejects.toThrow();
    });
  });

  describe('variation()', () => {
    asyncTestWithIdentify(async (wrappedClient, user) => {
      const value = await wrappedClient.variation(flagKey, user, 'default');
      expect(value).toEqual(flagValue);
    });
  });

  describe('variationDetail()', () => {
    asyncTestWithIdentify(async (wrappedClient, user) => {
      const value = await wrappedClient.variationDetail(flagKey, user, 'default');
      expect(value).toEqual({ value: flagValue, variationIndex: 1, reason: null });
    });
  });

  describe('allFlags()', () => {
    asyncTestWithIdentify(async (wrappedClient, user) => {
      const flags = await wrappedClient.allFlags(user);
      expect(flags).toEqual({ flag: flagValue });
    });
  });

  describe('allFlagsState()', () => {
    asyncTestWithIdentify(async (wrappedClient, user) => {
      const state = await wrappedClient.allFlagsState(user);
      expect(state).toEqual({
        $valid: true,
        flag: flagValue,
        $flagsState: {
          flag: {
            variation: 1,
          },
        },
      });
    });
  });

  describe('supports track()', () => {
    asyncTestWithIdentify(async (wrappedClient, user) => {
      let events = [];
      server.on('request', (req, res) =>
        httpServer.readAll(req).then(result => {
          if (/^\/events\/bulk\//.test(req.url)) {
            events = events.concat(JSON.parse(result));
          }
          httpServer.respond(res, 200);
        })
      );
      await wrappedClient.track('my-event-key', user);
      await wrappedClient.flush();
      
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'custom',
            key: 'my-event-key'
          })
        ])
      );
    });
  });

  describe('identify()', () => {
    it('makes a flags request when switching users', async () => {
      await makeServerWithFlags();
      const wrappedClient = createWrappedClient({ bootstrap: {} });

      await wrappedClient.waitForInitialization();
      await wrappedClient.identify(otherUser);

      expect(server.requests.length).toEqual(1);
    });

    it('calls identify() even if user is unchanged', async () => {
      // The behavior we're testing here is that the wrapper always calls the underlying identify() method,
      // because the contract for identify() is that it always generates an identify event. In the future, the
      // client will be changed so that if you call identify() with the same user, it sends an event but does
      // not re-request the flags.
      await makeServerWithFlags();
      const wrappedClient = createWrappedClient({ bootstrap: {} });

      await wrappedClient.waitForInitialization();
      await wrappedClient.identify(user);

      expect(server.requests.length).toEqual(1);
    });
  });

  it('returns empty string from secureModeHash() and logs a warning', async () => {
    const wrappedClient = createWrappedClient({ bootstrap: {} });

    await wrappedClient.waitForInitialization();
    const hash = wrappedClient.secureModeHash(user);
    expect(hash).toEqual('');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('supports on()', done => {
    const wrappedClient = createWrappedClient({ bootstrap: {} });
    wrappedClient.on('ready', () => done());
  });

  it('supports off()', done => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();

    const wrappedClient = createWrappedClient({ bootstrap: {} });
    wrappedClient.on('ready', listener1);
    wrappedClient.on('ready', listener2);
    wrappedClient.off('ready', listener1);

    wrappedClient.waitForInitialization().then(() => {
      expect(listener2).toHaveBeenCalled();
      expect(listener1).not.toHaveBeenCalled();

      done();
    });
  });
});
