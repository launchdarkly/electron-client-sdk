import * as LDClient from '../index';
import * as packageJson from '../../package.json';

import {
  TestHttpHandlers,
  TestHttpServer,
  TestHttpServers,
  sleepAsync,
  withCloseable,
} from 'launchdarkly-js-test-helpers';

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

        const client = LDClient.initializeInMain(envName, user, {
          baseUrl: server.url,
          sendEvents: false,
          useNetModule: true,
        });
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

        const client = LDClient.initializeInMain(envName, user, {
          baseUrl: server.url,
          sendEvents: false,
          useNetModule: true,
        });
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
    it("sends events through Electron's net module", async () => {
      await withCloseable(TestHttpServers.start, async server => {
        server.byDefault(TestHttpHandlers.respond(200));
        const client = LDClient.initializeInMain(envName, user, {
          bootstrap: {},
          diagnosticOptOut: true,
          eventsUrl: server.url,
          useNetModule: true,
        });
        await withCloseable(client, async () => {
          await client.waitForInitialization();

          client.track('whatever');
          await client.flush();

          const req = await server.nextRequest();
          const events = JSON.parse(req.body);
          expect(events.map(event => event.kind)).toEqual(['identify', 'custom']);
        });
      });
    });
  });

  describe('configuration', () => {
    const makeLogger = () => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    });

    it('accepts useNetModule without reporting an unknown option', async () => {
      const logger = makeLogger();
      const client = LDClient.initializeInMain(envName, user, {
        bootstrap: {},
        sendEvents: false,
        logger,
        useNetModule: true,
      });
      await withCloseable(client, async () => {
        await client.waitForInitialization();
        await sleepAsync(10);

        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      });
    });

    it('warns once when tlsParams are ignored', async () => {
      const logger = makeLogger();
      const client = LDClient.initializeInMain(envName, user, {
        bootstrap: {},
        sendEvents: false,
        logger,
        tlsParams: { ca: 'custom CA' },
        useNetModule: true,
      });
      await withCloseable(client, async () => {
        await client.waitForInitialization();
        await sleepAsync(10);

        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
          "The useNetModule option is enabled, so tlsParams will be ignored. Electron's net module delegates TLS " +
            'configuration to Chromium. Disable useNetModule to use custom TLS parameters.'
        );
        expect(logger.error).not.toHaveBeenCalled();
      });
    });

    it('does not warn when tlsParams use the Node HTTPS transport', async () => {
      const logger = makeLogger();
      const client = LDClient.initializeInMain(envName, user, {
        bootstrap: {},
        sendEvents: false,
        logger,
        tlsParams: { ca: 'custom CA' },
      });
      await withCloseable(client, async () => {
        await client.waitForInitialization();
        await sleepAsync(10);

        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      });
    });
  });
});
