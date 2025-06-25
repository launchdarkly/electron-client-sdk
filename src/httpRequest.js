// Node implementation of the HTTP abstraction used by launchdarkly-js-sdk-common.
// This logic should be the same in the client-side Node SDK as in the Electron SDK.

const http = require('http');
const https = require('https');
const url = require('url');

let electronNet;
try {
  electronNet = require('electron').net;
} catch (_) {
  // Not in Electron or outside main process
}

function newHttpRequest(method, requestUrl, headers, body, tlsParams, useNetModule) {
  const urlParams = url.parse(requestUrl);
  const isHttps = urlParams.protocol === 'https:';

  let request;
  const p = new Promise((resolve, reject) => {
    const onResponse = res => {
      let resBody = '';
      res.on('data', chunk => {
        resBody += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          header: name => res.headers[name.toLowerCase()], // note that the Node HTTP API will lowercase these for us
          body: resBody,
        });
      });
    };

    if (useNetModule && electronNet) {
      request = electronNet.request({ method, url: requestUrl });

      for (const [key, value] of Object.entries(headers)) {
        request.setHeader(key, value);
      }

      request.on('response', onResponse);
    } else {
      const requestParams = Object.assign({}, isHttps ? tlsParams : {}, urlParams, {
        method: method,
        headers: headers,
        body: body,
      });

      request = (isHttps ? https : http).request(requestParams, onResponse);
    }

    request.on('error', reject);
    if (body) {
      request.write(body);
    }

    request.end();
  });

  function cancel() {
    request && request.abort();
  }

  return { promise: p, cancel: cancel };
}

module.exports = newHttpRequest;
