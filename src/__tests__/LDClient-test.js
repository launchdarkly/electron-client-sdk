import * as LDClient from '../index';
import * as packageJson from '../../package.json';

import { TestHttpHandlers, TestHttpServer, withCloseable } from 'launchdarkly-js-test-helpers';

describe('LDClient', () => {
  const envName = 'UNKNOWN_ENVIRONMENT_ID';
  const user = { key: 'user' };

  it('should exist', () => {
    expect(LDClient).toBeDefined();
  });

  it('should report correct version', () => {
    expect(LDClient.version).toEqual(packageJson.version);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await withCloseable(TestHttpServer.start, async server => {
        const data = { flag: { value: 3 } };
        server.byDefault(TestHttpHandlers.respondJson(data));

        const client = LDClient.initializeInMain(envName, user, { baseUrl: server.url, sendEvents: false });
        await withCloseable(client, async () => {
          await client.waitForInitialization();

          expect(client.variation('flag')).toEqual(3);
        });
      });
    });

    it('sends correct User-Agent in request', async () => {
      await withCloseable(TestHttpServer.start, async server => {
        const data = { flag: { value: 3 } };
        server.byDefault(TestHttpHandlers.respondJson(data));

        const client = LDClient.initializeInMain(envName, user, { baseUrl: server.url, sendEvents: false });
        await withCloseable(client, async () => {
          await client.waitForInitialization();

          expect(server.requests.length()).toEqual(1);
          const req = await server.nextRequest();
          expect(req.headers['x-launchdarkly-user-agent']).toMatch(/^ElectronClient\/1\./);
        });
      });
    });
  });

  describe('track()', () => {
    it('should not warn when tracking an arbitrary custom event', async () => {
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const client = LDClient.initializeInMain(envName, user, {
        bootstrap: {},
        sendEvents: false,
        logger: logger,
      });
      await withCloseable(client, async () => {
        await client.waitForInitialization();

        client.track('whatever');
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      });
    });
  });
});
