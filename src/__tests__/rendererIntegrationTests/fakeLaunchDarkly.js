const httpServer = require('../http-server');
const BlockingQueue = require('./blockingQueue');

// This builds upon the mock HTTP server helpers in http-server.js to provide a simulated
// LaunchDarkly server that implements all of the client-side endpoints, including streaming,
// with separate state for each environment and user.
//
// Usage:
//   const fld = await fakeLaunchDarkly();
//   const env = fld.addEnvironment('firstEnvironment');
//   const envUser0 = env.addUser('userKey0', { flagKey: 'flagValueForUser0' });
//   const envUser1 = env.addUser('userKey1', { flagKey: 'flagValueForUser1' });
//   envUser0.streamUpdate('put', { flagKey: 'newValue' });
//   const receivedEvent = await env.nextEvent();
//   fld.close();

async function fakeLaunchDarkly() {
  const server = await httpServer.createServer();
  const streams = [];
  const me = { url: server.url };

  async function pipeStreamToResponse(stream, res) {
    while (true) {
      const data = await stream.pop();
      if (data === undefined) {
        break; // it's been closed
      }
      res.write(data);
    }
  }

  me.close = () => {
    streams.forEach(s => s.close());
    server && server.close();
  };

  me.addEnvironment = envId => {
    const events = new BlockingQueue();
    const users = {};

    const forUser = async (req, action) => {
      httpServer.readAll(req).then(body => {
        const user = JSON.parse(body);
        if (users[user.key]) {
          action(users[user.key]);
        }
      });
    };

    server.on('request', (req, res) => {
      // Note that we're assuming the client will use REPORT mode, because parsing the user properties
      // out of the URL is a pain.
      if (req.url === '/sdk/evalx/' + envId + '/user') {
        forUser(req, u => {
          httpServer.respondJson(res, u.flags);
        });
      } else if (req.url === '/eval/' + envId) {
        forUser(req, u => {
          res.writeHead(200, { 'Content-Type': 'text/event-stream' });
          pipeStreamToResponse(u.stream, res);
        });
      } else if (req.url === '/events/bulk/' + envId) {
        res.writeHead(202);
        httpServer.readAll(req).then(body => {
          events.addAll(JSON.parse(body));
        });
      }
    });

    function addUser(userKey, flagValues) {
      const stream = new BlockingQueue();
      const flags = {};
      Object.keys(flagValues).forEach(key => {
        flags[key] = { value: flagValues[key], version: 1 };
      });

      users[userKey] = {
        flags: flags,
        stream: stream,
      };

      return {
        streamUpdate: (eventName, data) => {
          stream.add(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
        },
      };
    }

    return {
      events: events,
      addUser: addUser,
      nextEvent: async () => await events.pop(),
    };
  };

  return me;
}

module.exports = fakeLaunchDarkly;
