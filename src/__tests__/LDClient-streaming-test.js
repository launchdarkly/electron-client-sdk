import * as httpServer from './http-server';

import * as LDClient from '../index';

// Unlike the LDClient-streaming-test.js in ldclient-js-common, which tests the client streaming logic
// against a mock EventSource, this does end-to-end testing against an embedded HTTP server to verify
// that the EventSource implementation we're using in Electron basically works.

describe('LDClient streaming', () => {
  const envName = 'UNKNOWN_ENVIRONMENT_ID';
  const user = { key: 'user' };
  const encodedUser = 'eyJrZXkiOiJ1c2VyIn0';
  const expectedGetUrl = '/eval/' + envName + '/' + encodedUser;
  const expectedReportUrl = '/eval/' + envName;

  afterEach(() => {
    httpServer.closeServers();
  });

  it('makes GET request and receives an event', async () => {
    const server = await httpServer.createServer();

    server.on('request', (req, res) => {
      expect(req.url).toEqual(expectedGetUrl);
      expect(req.method).toEqual('GET');

      httpServer.respondSSEEvent(res, 'put', { flag: { value: 'yes', version: 1 } });
    });

    const config = { bootstrap: {}, streaming: true, streamUrl: server.url };
    const client = LDClient.initializeInMain(envName, user, config);
    const changedFlag = new Promise(resolve => client.on('change:flag', resolve));
    const value = await changedFlag;
    expect(value).toEqual('yes');
  });

  it('makes REPORT request and receives an event', async () => {
    const server = await httpServer.createServer();

    server.on('request', (req, res) => {
      expect(req.url).toEqual(expectedReportUrl);
      expect(req.method).toEqual('REPORT');
      httpServer.readAll(req).then(body => {
        expect(body).toEqual(JSON.stringify(user));

        httpServer.respondSSEEvent(res, 'put', { flag: { value: 'yes', version: 1 } });
      });
    });

    const config = { bootstrap: {}, streaming: true, streamUrl: server.url, useReport: true };
    const client = LDClient.initializeInMain(envName, user, config);
    const changedFlag = new Promise(resolve => client.on('change:flag', resolve));
    const value = await changedFlag;
    expect(value).toEqual('yes');
  });
});
