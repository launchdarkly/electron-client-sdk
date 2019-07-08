import * as LDClient from '../index';
import * as mainEntryPointsFromRenderer from '../mainEntryPointsFromRenderer';

// These tests cover the mechanisms by which the main-process client and renderer-process clients are
// kept in sync. However, in the current test framework it's not possible to actually create any
// renderer processes, so the tests are just verifying that particular methods that are used in the
// synchronization logic behave correctly.

describe('interprocess sync', () => {
  const envName = 'UNKNOWN_ENVIRONMENT_ID';
  const user = { key: 'user' };
  const flagValue = 'flagValue';
  const flags = {
    flagKey: { value: flagValue, version: 1, variation: 1 },
  };
  const bootstrap = {
    flagKey: flagValue,
    $flagsState: {
      flagKey: { version: 1, variation: 1 },
    },
  };
  const expectedState = { environment: envName, user: user, flags: flags };

  describe('getInternalClientState', () => {
    it('returns null if no main client exists yet', () => {
      expect(mainEntryPointsFromRenderer.getInternalClientState(envName)).toBe(null);
    });

    it('returns null if a client exists but is not ready yet', () => {
      LDClient.initializeInMain(envName, user, { baseUrl: 'http://bad' });
      expect(mainEntryPointsFromRenderer.getInternalClientState(envName)).toBe(null);
    });

    it('returns state if client is ready', done => {
      const client = LDClient.initializeInMain(envName, user, { bootstrap: bootstrap });
      client.waitForInitialization().then(() => {
        expect(mainEntryPointsFromRenderer.getInternalClientState(envName)).toEqual(expectedState);
        done();
      });
    });

    it('if environment is unspecified and there is only one client, uses that one', done => {
      const client = LDClient.initializeInMain(envName, user, { bootstrap: bootstrap });
      client.waitForInitialization().then(() => {
        expect(mainEntryPointsFromRenderer.getInternalClientState()).toEqual(expectedState);
        done();
      });
    });

    it('if environment is unspecified and there are multiple clients, returns null', done => {
      const client1 = LDClient.initializeInMain(envName, user, { bootstrap: {}, sendEvents: false });
      const client2 = LDClient.initializeInMain(envName + '2', user, { bootstrap: bootstrap, sendEvents: false });
      client1.waitForInitialization().then(() => {
        client2.waitForInitialization().then(() => {
          expect(mainEntryPointsFromRenderer.getInternalClientState()).toBe(null);
          done();
        });
      });
    });
  });
});
