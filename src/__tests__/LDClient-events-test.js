import * as LDClient from '../index';

import { withCloseable } from 'launchdarkly-js-test-helpers';

describe('LDClient', () => {
  const envName = 'UNKNOWN_ENVIRONMENT_ID';
  const user = { key: 'user' };

  // Event generation in general is tested in a non-platform-specific way in launchdarkly-js-sdk-common.
  // The following tests just demonstrate that the common client calls our platform object when it
  // should.

  describe('event generation', () => {
    function stubEventProcessor() {
      const ep = { events: [] };
      ep.start = function() {};
      ep.flush = function() {};
      ep.stop = function() {};
      ep.enqueue = function(e) {
        ep.events.push(e);
      };
      return ep;
    }

    // This tests that the client calls our platform's getCurrentUrl() and isDoNotTrack() methods.
    it('sends an event for track()', async () => {
      const ep = stubEventProcessor();
      const client = LDClient.initializeInMain(envName, user, { eventProcessor: ep, bootstrap: {} });
      await withCloseable(client, async () => {
        await client.waitForInitialization();

        const data = { thing: 'stuff' };

        client.track('eventkey', data);

        expect(ep.events.length).toEqual(2);
        const trackEvent = ep.events[1];
        expect(trackEvent.kind).toEqual('custom');
        expect(trackEvent.key).toEqual('eventkey');
        expect(trackEvent.user).toEqual(user);
        expect(trackEvent.data).toEqual(data);
        expect(trackEvent.url).toEqual(null);
      });
    });
  });
});
