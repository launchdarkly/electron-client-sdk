import * as httpServer from './http-server';

import * as LDClient from '../index';

describe('LDClient', () => {
  const envName = 'UNKNOWN_ENVIRONMENT_ID';
  const user = { key: 'user' };

  afterEach(() => {
    httpServer.closeServers();
  });

  it('should exist', () => {
    expect(LDClient).toBeDefined();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const data = { flag: { value: 3 } };
      const server = await httpServer.createServer();
      httpServer.autoRespond(server, res => httpServer.respondJson(res, data));

      const client = LDClient.initializeInMain(envName, user, { baseUrl: server.url, sendEvents: false });
      await client.waitForInitialization();

      expect(client.variation('flag')).toEqual(3);
    });

    it('sends correct User-Agent in request', async () => {
      const server = await httpServer.createServer();
      httpServer.autoRespond(server, res => httpServer.respondJson(res, {}));

      const client = LDClient.initializeInMain(envName, user, { baseUrl: server.url, sendEvents: false });
      await client.waitForInitialization();

      expect(server.requests.length).toEqual(1);
      expect(server.requests[0].headers['x-launchdarkly-user-agent']).toMatch(/^ElectronClient\/1\./);
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

      await client.waitForInitialization();

      client.track('whatever');
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
