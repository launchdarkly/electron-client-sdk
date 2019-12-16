const { AsyncQueue, TestHttpHandlers, TestHttpServers } = require('launchdarkly-js-test-helpers');

// This builds upon the mock HTTP server helpers in launchdarkly-js-test-helpers to provide a
// simulated LaunchDarkly server that implements all of the client-side endpoints, including
// streaming, with separate state for each environment and user.
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
  const server = await TestHttpServers.start();
  const streams = [];
  const me = { url: server.url };

  me.close = () => {
    streams.forEach(s => s.close());
    server && server.close();
  };

  me.addEnvironment = envId => {
    const events = new AsyncQueue();
    const users = {};

    const forUser = action => (req, res) => {
      const user = JSON.parse(req.body);
      if (users[user.key]) {
        action(users[user.key], req, res);
      } else {
        TestHttpHandlers.respond(404)(req, res);
      }
    };

    server.forMethodAndPath(
      // Note that we're assuming the client will use REPORT mode to get flags, because parsing the
      // user properties out of the URL is a pain.
      'report',
      '/sdk/evalx/' + envId + '/user',
      forUser((u, req, res) => {
        TestHttpHandlers.respondJson(u.flags)(req, res);
      })
    );
    server.forMethodAndPath(
      'report',
      '/eval/' + envId,
      forUser((u, req, res) => {
        TestHttpHandlers.sseStream(u.stream)(req, res);
      })
    );
    server.forMethodAndPath('post', '/events/bulk/' + envId, (req, res) => {
      JSON.parse(req.body).forEach(event => events.add(event));
      TestHttpHandlers.respond(202)(req, res);
    });

    function addUser(userKey, flagValues) {
      const stream = new AsyncQueue();
      streams.push(stream);
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
          stream.add({ type: eventName, data: JSON.stringify(data) });
        },
      };
    }

    return {
      events,
      addUser,
      nextEvent: async () => await events.take(),
    };
  };

  return me;
}

module.exports = fakeLaunchDarkly;
