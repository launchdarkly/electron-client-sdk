import * as LDClient from '../index';

const { TestHttpHandlers, TestHttpServers, eventSink, withCloseable } = require('launchdarkly-js-test-helpers');

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

  async function withServerReturningFlags(asyncCallback) {
    const server = await TestHttpServers.start();
    server.byDefault(TestHttpHandlers.respondJson(flags));
    return await withCloseable(server, asyncCallback);
  }

  async function withServerReturningError(asyncCallback) {
    const server = await TestHttpServers.start();
    server.byDefault(TestHttpHandlers.respond(401));
    return await withCloseable(server, asyncCallback);
  }

  async function withWrappedClient(server, options, asyncCallback) {
    const baseConfig = {
      baseUrl: server.url,
      eventsUrl: server.url,
      diagnosticOptOut: true,
    };
    const client = LDClient.initializeInMain(envName, user, Object.assign(baseConfig, options));
    return await withCloseable(LDClient.createNodeSdkAdapter(client), asyncCallback);
  }

  function asyncTestWithIdentify(testFn) {
    async function doTest(changeUser, bootstrap) {
      await (changeUser ? withServerReturningFlags : withServerReturningError)(async server => {
        await withWrappedClient(server, { bootstrap: bootstrap }, async wrappedClient => {
          await wrappedClient.waitForInitialization();
          await testFn(wrappedClient, changeUser ? otherUser : user, server);
        });
      });
    }

    it('when user is not changed', async () => await doTest(false, flagsBootstrap));

    it('when user is changed', async () => await doTest(true, {}));
  }

  it('supports initialized()', async () => {
    await withServerReturningFlags(async server => {
      await withWrappedClient(server, {}, async wrappedClient => {
        expect(wrappedClient.initialized()).toBe(false);
        await wrappedClient.waitForInitialization();
        expect(wrappedClient.initialized()).toBe(true);
      });
    });
  });

  describe('waitUntilReady()', () => {
    it('resolves on success', async () => {
      await withServerReturningFlags(async server => {
        await withWrappedClient(server, {}, async wrappedClient => {
          await wrappedClient.waitUntilReady();
        });
      });
    });

    it('resolves on failure', async () => {
      await withServerReturningError(async server => {
        await withWrappedClient(server, {}, async wrappedClient => {
          await wrappedClient.waitUntilReady();
        });
      });
    });
  });

  describe('waitForInitialization()', () => {
    it('resolves on success', async () => {
      await withServerReturningFlags(async server => {
        await withWrappedClient(server, {}, async wrappedClient => {
          const result = await wrappedClient.waitForInitialization();
          expect(result).toBe(wrappedClient);
        });
      });
    });

    it('rejects on failure', async () => {
      await withServerReturningError(async server => {
        await withWrappedClient(server, {}, async wrappedClient => {
          await expect(wrappedClient.waitForInitialization()).rejects.toThrow();
        });
      });
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
    asyncTestWithIdentify(async (wrappedClient, user, server) => {
      let events = [];
      server.forMethodAndPath('post', '/events/bulk/' + envName, (req, res) => {
        events = events.concat(JSON.parse(req.body));
        TestHttpHandlers.respond(202)(req, res);
      });
      await wrappedClient.track('my-event-key', user);
      await wrappedClient.flush();

      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'custom',
            key: 'my-event-key',
          }),
        ])
      );
    });
  });

  describe('identify()', () => {
    it('makes a flags request when switching users', async () => {
      await withServerReturningFlags(async server => {
        await withWrappedClient(server, { bootstrap: {} }, async wrappedClient => {
          await wrappedClient.waitForInitialization();
          await wrappedClient.identify(otherUser);

          expect(server.requests.length()).toEqual(1);
        });
      });
    });

    it('calls identify() even if user is unchanged', async () => {
      // The behavior we're testing here is that the wrapper always calls the underlying identify() method,
      // because the contract for identify() is that it always generates an identify event. In the future, the
      // client will be changed so that if you call identify() with the same user, it sends an event but does
      // not re-request the flags.
      await withServerReturningFlags(async server => {
        await withWrappedClient(server, { bootstrap: {} }, async wrappedClient => {
          await wrappedClient.waitForInitialization();
          await wrappedClient.identify(user);

          expect(server.requests.length()).toEqual(1);
        });
      });
    });
  });

  it('returns empty string from secureModeHash() and logs a warning', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await withServerReturningFlags(async server => {
        await withWrappedClient(server, { bootstrap: {} }, async wrappedClient => {
          await wrappedClient.waitForInitialization();
          const hash = wrappedClient.secureModeHash(user);
          expect(hash).toEqual('');
          expect(warnSpy).toHaveBeenCalled();
        });
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('supports on()', async () => {
    await withServerReturningFlags(async server => {
      await withWrappedClient(server, { bootstrap: {} }, async wrappedClient => {
        const receivedEvents = eventSink(wrappedClient, 'ready');
        await receivedEvents.take();
      });
    });
  });

  it('supports off()', async () => {
    await withServerReturningFlags(async server => {
      await withWrappedClient(server, { bootstrap: {} }, async wrappedClient => {
        const listener1 = jest.fn();
        const listener2 = jest.fn();

        wrappedClient.on('ready', listener1);
        wrappedClient.on('ready', listener2);
        wrappedClient.off('ready', listener1);

        await wrappedClient.waitForInitialization();

        expect(listener2).toHaveBeenCalled();
        expect(listener1).not.toHaveBeenCalled();
      });
    });
  });
});
