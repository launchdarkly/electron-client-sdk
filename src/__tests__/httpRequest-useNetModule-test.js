const EventEmitter = require('events');

describe("httpRequest with Electron's net module", () => {
  let mockElectronNet;
  let mockRequest;
  let newHttpRequest;

  beforeEach(() => {
    mockRequest = new EventEmitter();
    mockRequest.setHeader = jest.fn();
    mockRequest.write = jest.fn();
    mockRequest.end = jest.fn();
    mockRequest.abort = jest.fn();

    mockElectronNet = {
      request: jest.fn(() => mockRequest),
    };
    jest.doMock('electron', () => ({ net: mockElectronNet }));
    newHttpRequest = require('../httpRequest');
  });

  afterEach(() => {
    jest.dontMock('electron');
  });

  it('sends the request and reads the response', async () => {
    const result = newHttpRequest(
      'POST',
      'https://example.com/path',
      { Authorization: 'token', 'Content-Type': 'application/json' },
      '{"value":true}',
      { ca: 'ignored' },
      true
    );

    expect(mockElectronNet.request).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://example.com/path',
    });
    expect(mockRequest.setHeader.mock.calls).toEqual([
      ['Authorization', 'token'],
      ['Content-Type', 'application/json'],
    ]);
    expect(mockRequest.write).toHaveBeenCalledWith('{"value":true}');
    expect(mockRequest.end).toHaveBeenCalledTimes(1);

    const response = new EventEmitter();
    response.statusCode = 201;
    response.headers = { 'content-type': 'application/json' };
    mockRequest.emit('response', response);
    response.emit('data', '{"ok":');
    response.emit('data', 'true}');
    response.emit('end');

    const value = await result.promise;
    expect(value.status).toEqual(201);
    expect(value.header('Content-Type')).toEqual('application/json');
    expect(value.body).toEqual('{"ok":true}');
  });

  it('rejects the request promise on an error', async () => {
    const result = newHttpRequest('GET', 'https://example.com', {}, undefined, {}, true);
    const error = new Error('request failed');

    mockRequest.emit('error', error);

    await expect(result.promise).rejects.toBe(error);
  });

  it('aborts the Electron request when cancelled', () => {
    const result = newHttpRequest('GET', 'https://example.com', {}, undefined, {}, true);

    result.cancel();

    expect(mockRequest.abort).toHaveBeenCalledTimes(1);
  });
});
