import * as LDClient from '../index';

import { TestHttpHandlers, TestHttpServer, sleepAsync, withCloseable } from 'launchdarkly-js-test-helpers';

describe('LDClient httpRequest option', () => {
  const envName = 'UNKNOWN_ENVIRONMENT_ID';
  const user = { key: 'user' };

  const makeLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  const makeResponse = (status, body, headers = {}) => ({
    status,
    header: name => headers[name.toLowerCase()],
    body,
  });

  it('accepts httpRequest without reporting an unknown option', async () => {
    const logger = makeLogger();
    const client = LDClient.initializeInMain(envName, user, {
      bootstrap: {},
      diagnosticOptOut: true,
      httpRequest: jest.fn(),
      logger,
      sendEvents: false,
    });

    await withCloseable(client, async () => {
      await client.waitForInitialization();
      await sleepAsync(10);

      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  it('uses a result without cancel to poll and parse a complete response', async () => {
    const responseHeader = jest.fn(name => ({ 'content-type': 'application/json' }[name.toLowerCase()]));
    const httpRequest = jest.fn(() => ({
      promise: Promise.resolve({
        status: 200,
        header: responseHeader,
        body: JSON.stringify({ flag: { value: 3 } }),
      }),
    }));
    const client = LDClient.initializeInMain(envName, user, {
      baseUrl: 'https://example.com',
      diagnosticOptOut: true,
      httpRequest,
      sendEvents: false,
      useReport: true,
    });

    await withCloseable(client, async () => {
      await client.waitForInitialization();

      expect(client.variation('flag')).toEqual(3);
      expect(httpRequest).toHaveBeenCalledTimes(1);
      expect(httpRequest).toHaveBeenCalledWith(
        'REPORT',
        'https://example.com/sdk/evalx/' + envName + '/user',
        {
          'Content-Type': 'application/json',
          'X-LaunchDarkly-User-Agent': expect.stringMatching(/^ElectronClient\/1\./),
        },
        JSON.stringify(user)
      );
      expect(responseHeader).toHaveBeenCalledWith('content-type');
    });
  });

  it('uses httpRequest for analytics and diagnostic posts', async () => {
    const httpRequest = jest.fn(() => ({ promise: Promise.resolve(makeResponse(202, '')) }));
    const client = LDClient.initializeInMain(envName, user, {
      bootstrap: {},
      eventsUrl: 'https://events.example.com',
      httpRequest,
    });

    await withCloseable(client, async () => {
      await client.waitForInitialization();
      client.track('custom-event');
      await client.flush();

      const diagnosticCall = httpRequest.mock.calls.find(call => call[1].includes('/events/diagnostic/'));
      const analyticsCall = httpRequest.mock.calls.find(call => call[1].includes('/events/bulk/'));

      expect(diagnosticCall).toBeDefined();
      expect(diagnosticCall[0]).toEqual('POST');
      expect(diagnosticCall[1]).toEqual('https://events.example.com/events/diagnostic/' + envName);
      expect(diagnosticCall[2]['Content-Type']).toEqual('application/json');
      expect(JSON.parse(diagnosticCall[3]).kind).toEqual('diagnostic-init');

      expect(analyticsCall).toBeDefined();
      expect(analyticsCall[0]).toEqual('POST');
      expect(analyticsCall[1]).toEqual('https://events.example.com/events/bulk/' + envName);
      expect(analyticsCall[2]['Content-Type']).toEqual('application/json');
      expect(JSON.parse(analyticsCall[3]).map(event => event.kind)).toEqual(['identify', 'custom']);
    });
  });

  it('reports a rejected transport promise as an initialization network error', async () => {
    const logger = makeLogger();
    const httpRequest = jest.fn(() => ({ promise: Promise.reject(new Error('request failed')) }));
    const client = LDClient.initializeInMain(envName, user, {
      diagnosticOptOut: true,
      httpRequest,
      logger,
      sendEvents: false,
    });

    await withCloseable(client, async () => {
      await expect(client.waitForInitialization()).rejects.toThrow(/network error.*request failed/);
    });
  });

  it('cancels a polling request when another request supersedes it', async () => {
    const cancel = jest.fn();
    const firstPromise = new Promise(() => {});
    const httpRequest = jest
      .fn()
      .mockReturnValueOnce({ promise: firstPromise, cancel })
      .mockReturnValueOnce({
        promise: Promise.resolve(
          makeResponse(200, JSON.stringify({ flag: { value: 'second' } }), {
            'content-type': 'application/json',
          })
        ),
      });
    const client = LDClient.initializeInMain(envName, user, {
      diagnosticOptOut: true,
      httpRequest,
      sendEvents: false,
      useReport: true,
    });

    await withCloseable(client, async () => {
      await client.identify({ key: 'second-user' });

      expect(cancel).toHaveBeenCalledTimes(1);
      expect(client.variation('flag')).toEqual('second');
    });
  });

  it('uses httpRequest instead of tlsParams and warns once', async () => {
    const logger = makeLogger();
    const httpRequest = jest.fn(() => ({
      promise: Promise.resolve(
        makeResponse(200, JSON.stringify({ flag: { value: 3 } }), { 'content-type': 'application/json' })
      ),
    }));
    const client = LDClient.initializeInMain(envName, user, {
      diagnosticOptOut: true,
      httpRequest,
      logger,
      sendEvents: false,
      tlsParams: { ca: 'custom CA' },
    });

    await withCloseable(client, async () => {
      await client.waitForInitialization();
      await sleepAsync(10);

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        'The httpRequest option is set, so tlsParams will not be applied to polling, analytics, or diagnostic requests.'
      );
      expect(logger.error).not.toHaveBeenCalled();
      expect(httpRequest).toHaveBeenCalledTimes(1);
      expect(client.variation('flag')).toEqual(3);
    });
  });

  it('falls back to the default transport when httpRequest is not a function', async () => {
    await withCloseable(TestHttpServer.start, async server => {
      const logger = makeLogger();
      server.byDefault(TestHttpHandlers.respondJson({ flag: { value: 3 } }));
      const client = LDClient.initializeInMain(envName, user, {
        baseUrl: server.url,
        diagnosticOptOut: true,
        httpRequest: {},
        logger,
        sendEvents: false,
      });

      await withCloseable(client, async () => {
        await client.waitForInitialization();
        await sleepAsync(10);

        expect(client.variation('flag')).toEqual(3);
        expect(server.requestCount()).toEqual(1);
        expect(logger.error).toHaveBeenCalledWith(
          'Config option "httpRequest" should be of type function, got object, using default value'
        );
      });
    });
  });
});
