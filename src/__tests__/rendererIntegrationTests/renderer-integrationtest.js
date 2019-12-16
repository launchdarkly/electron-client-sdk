const fs = require('fs');
const path = require('path');
const fakeLaunchDarkly = require('./fakeLaunchDarkly');
const testAppClient = require('./testAppClient');

const { withCloseable } = require('launchdarkly-js-test-helpers');

describe('full application integration tests', () => {
  const projectRoot = path.join(__dirname, '..', '..', '..');
  const sdkSymlinkPath = path.join(projectRoot, 'node_modules', 'launchdarkly-electron-client-sdk');
  const defaultUserKey = 'default-user';
  const defaultEnvId = 'fake-env';
  const timeout = 10000; // jest default is 5000; Electron might be slow to start up

  beforeEach(() => {
    // Some of the interactions between the renderer client and the main client will only work if the SDK
    // has really been loaded as a Node module, rather than with "require('../index')" as we do in the
    // regular unit tests. So we are putting our own project into our own node_modules as a symlink.
    try {
      fs.unlinkSync(sdkSymlinkPath);
    } catch {}
    fs.symlinkSync(projectRoot, sdkSymlinkPath);
  });

  afterEach(() => {
    fs.unlinkSync(sdkSymlinkPath);
  });

  function doTest(name, fn) {
    it(
      name,
      async () => {
        await withCloseable(fakeLaunchDarkly, async fakeLD => {
          const app = testAppClient(fakeLD, {
            userKey: defaultUserKey,
            env: defaultEnvId,
            testName: name,
          });
          try {
            await fn(fakeLD, app);
          } catch (e) {
            const logs = await app.getLogs();
            console.log('*** console output from Electron app follows ***\n' + logs.join('\n'));
            throw e;
          } finally {
            await app.close();
          }
        });
      },
      timeout
    );
  }

  doTest('loads flags in renderer client', async (fakeLD, app) => {
    const env = fakeLD.addEnvironment(defaultEnvId);
    const flags = { flag1: 'value1', flag2: 'value2' };
    env.addUser(defaultUserKey, flags);

    await app.start();

    await expect(app.getClientUserKey(0)).resolves.toEqual(defaultUserKey);
    await expect(app.getClientFlags(0)).resolves.toEqual(flags);
  });

  doTest('sends events from renderer client', async (fakeLD, app) => {
    const env = fakeLD.addEnvironment(defaultEnvId);
    env.addUser(defaultUserKey, { flag1: 'value1' });

    await app.start();

    const event0 = await env.nextEvent();
    expect(event0.kind).toEqual('identify');
    expect(event0.user.key).toEqual(defaultUserKey);

    const event1 = await env.nextEvent();
    expect(event1.kind).toEqual('summary');
    expect(event1.features.flag1.counters[0].value).toEqual('value1');
    expect(event1.features.flag1.counters[0].count).toEqual(1);
  });

  doTest('loads flags in multiple renderer clients for same environment', async (fakeLD, app) => {
    const env = fakeLD.addEnvironment(defaultEnvId);
    const flags = { flag1: 'value1', flag2: 'value2' };
    env.addUser(defaultUserKey, flags);

    await app.start({ env: [defaultEnvId, defaultEnvId] });

    for (let i = 0; i < 2; i++) {
      await expect(app.getClientUserKey(i)).resolves.toEqual(defaultUserKey);
      await expect(app.getClientFlags(i)).resolves.toEqual(flags);
    }
  });

  doTest('loads flags in multiple renderer clients for multiple environments', async (fakeLD, app) => {
    const envId1 = 'env0';
    const envId2 = 'env1';
    const flags1 = { flag1: 'value1' };
    const flags2 = { flag2: 'value2' };
    const env1 = fakeLD.addEnvironment(envId1);
    const env2 = fakeLD.addEnvironment(envId2);
    env1.addUser(defaultUserKey, flags1);
    env2.addUser(defaultUserKey, flags2);

    await app.start({ env: [envId1, envId2] });

    await expect(app.getClientUserKey(0)).resolves.toEqual(defaultUserKey);
    await expect(app.getClientUserKey(1)).resolves.toEqual(defaultUserKey);
    await expect(app.getClientFlags(0)).resolves.toEqual(flags1);
    await expect(app.getClientFlags(1)).resolves.toEqual(flags2);
  });

  doTest('updates user in renderer client', async (fakeLD, app) => {
    const env = fakeLD.addEnvironment(defaultEnvId);
    const newUserKey = 'user2';
    const flags1 = { flag: 'first' };
    const flags2 = { flag: 'second' };
    env.addUser(defaultUserKey, flags1);
    env.addUser(newUserKey, flags2);

    await app.start();

    await expect(app.getClientFlags(0)).resolves.toEqual(flags1);

    await app.switchUser(newUserKey);
    await app.waitUntilClientsUpdated();

    await expect(app.getClientFlags(0)).resolves.toEqual(flags2);
  });

  doTest('passes streaming PUT update to renderer client', async (fakeLD, app) => {
    const env = fakeLD.addEnvironment(defaultEnvId);
    const envUser = env.addUser(defaultUserKey, { flag: 'first' });

    await app.start({ streaming: true });

    await expect(app.getClientFlags(0)).resolves.toEqual({ flag: 'first' });

    envUser.streamUpdate('put', { flag: { value: 'second', version: 2 } });
    await app.waitUntilClientsUpdated();

    await expect(app.getClientFlags(0)).resolves.toEqual({ flag: 'second' });
  });

  doTest('passes streaming PATCH updates to renderer client', async (fakeLD, app) => {
    const env = fakeLD.addEnvironment(defaultEnvId);
    const envUser = env.addUser(defaultUserKey, { flag: 'first' });

    await app.start({ streaming: true });

    await expect(app.getClientFlags(0)).resolves.toEqual({ flag: 'first' });

    envUser.streamUpdate('patch', { key: 'flag', value: 'second', version: 2 });
    await app.waitUntilClientsUpdated(1);

    await expect(app.getClientFlags(0)).resolves.toEqual({ flag: 'second' });

    envUser.streamUpdate('patch', { key: 'flag', value: 'third', version: 3 });
    await app.waitUntilClientsUpdated(2);

    await expect(app.getClientFlags(0)).resolves.toEqual({ flag: 'third' });
  });

  doTest('receives custom event from renderer client', async (fakeLD, app) => {
    const env = fakeLD.addEnvironment(defaultEnvId);
    env.addUser(defaultUserKey, {});
    await app.start();

    await app.triggerCustomEvent(0);

    while (true) {
      const e = await env.nextEvent();
      if (e.kind === 'custom') {
        expect(e.key).toEqual('my-event');
        expect(e.userKey).toEqual(defaultUserKey);
        // Normally we'd check e.url here too (it should refer to testAppWindow.html), but due to the way that
        // Spectron launches Electron, the application root path won't point to this directory and so the URL
        // logic will not work.
        break;
      }
    }
  });
});
