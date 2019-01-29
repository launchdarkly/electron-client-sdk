# LaunchDarkly JavaScript SDK for Electron

[![Circle CI](https://circleci.com/gh/launchdarkly/electron-client.svg?style=svg)](https://circleci.com/gh/launchdarkly/electron-client)

# This is a beta release

The Electron SDK should not be used in production environments until a final version is released.

## Introduction

This is the official LaunchDarkly client-side JavaScript SDK for [Electron](https://electronjs.org/) applications. It can be used in either the main process or a renderer process, or both. Its API closely resembles the LaunchDarkly [JavaScript SDK for browsers](https://github.com/launchdarkly/js-client), so many of its types and interfaces are specified in that project's [TypeScript definitions](https://github.com/launchdarkly/js-client/tree/master/packages/ldclient-js-common/typings.d.ts).

The SDK provides the same functionality as all of the LaunchDarkly SDKs:

* Making feature flags available to your application code.
* Sending events to LaunchDarkly for analytics and/or A/B testing.

For an example of using the SDK in a simple Electron application, see [`hello-electron`](https://github.com/launchdarkly/hello-electron).

Like the browser SDK, the Electron SDK is _client-side_-- that is, it is meant to be used with code that is deployed to an end user, either in a web browser or in a desktop application. It does not use the SDK key that the server-side SDKs use, since an end user who acquired that key could use it to access the details of your LaunchDarkly environment; instead, it uses the "client-side ID" associated with your environment.

Note that in order for LaunchDarkly to make your feature flags available to these SDKs, you must check the "Make this flag available to client-side SDKs" box on the Settings page for each flag. This is so that if you have a web application with a large number of flags used on the server side and a smaller number used on the front end, the client-side SDK can save bandwidth by only getting the subset of flags that it will use.

## Why use this instead of the Node SDK?

Since Electron is based on Node.js, it is possible to run the [LaunchDarkly Node SDK](https://github.com/launchdarkly/node-client) in it. This is strongly discouraged, as the Node SDK is meant for server-side use, not for applications that are distributed to users. There are several reasons why this distinction matters:

- The server-side SDKs include an SDK key that can download the entire definition (including rollout rules and individual user targets) of all of your feature flags. If you embed this SDK key in an application, any user who looks inside the application can then access all of your feature flag definitions—which may include sensitive data such as other users' email addresses. The client-side and mobile SDKs use different credentials that do not allow this.

- The server-side SDKs do in fact download your entire flag data using this key, since they have to be able to evaluate flags quickly for any user. That can be quite a large amount of data. The client-side and mobile SDKs, which normally evaluate flags for just one user at a time, use a much more efficient protocol where they request only the active variation for each flag for that specific user.

- The Electron SDK also includes features that are specific to Electron, such as the ability to access main-process flags from the front end as described below.

## Installation

Install the `ldclient-electron` package in your project with `npm`:

    npm install --save ldclient-electron

## Usage

### Initializing in the main process

Every Electron application consists of a _main process_, which is essentially a Node.js application, and some number of _renderer processes_, each of which is a Chromium web browser with its own window. These processes have their own independent JavaScript engines and data spaces, although there are ways to communicate between them.

The LaunchDarkly Electron SDK is designed to make it easy to use LaunchDarkly feature flags from within any of these environments. In the normal use case, there is an SDK client running in the main process; the renderer processes can then create client instances that are in effect mirrors of the main one.

To set up the main process client, you need the client-side ID for your LaunchDarkly environment; an object containing user properties (although you can change the user later); and optional configuration properties.

```js
var LDElectron = require('ldclient-electron');

var user = { key: 'example' };
var options = {};
var client = LDElectron.initializeInMain('YOUR_CLIENT_SIDE_ID', user, options);
```

The user object can contain any of the properties described [here](https://docs.launchdarkly.com/docs/targeting-users). The SDK always has a single current user; you can change it after initialization (see "Changing users").

In a renderer process, to create a client object that uses the same feature flag data, you only need to do this:

```js
var client = LDElectron.initializeInRenderer();
```

This gives you an object with the same interface--so you can evaluate feature flags, listen for flag change events, etc., in exactly the same way in the main process and the renderer process. However, only the main-process client is actually communicating with LaunchDarkly; the renderer-process clients are just delegating to the main one. This means that the overhead per application window is minimal (although it is still a good idea to retain a single client instance per window, rather than creating them ad-hoc when you need to evaluate a flag).

Both types of client are initialized asynchronously, so if you want to determine when the client is ready to evaluate feature flags, use the `ready` event, or the Promise-based method `waitForInitialization()`:

```js
client.on('ready', function() {
  // now we can evaluate some feature flags
});

// or:
client.waitForInitialization().then(function() {
  // now we can evaluate some feature flags
});
```

If you try to evaluate feature flags before the client is ready, it will behave as it would if no flags existed (i.e. `variation` will return a default value).

### Renderer/browser functionality

When you create a client instance for use in a renderer process with `initializeInRenderer()`, other than having the special "synchronizing to the main client" behavior described above, it is really just an instance of the browser SDK client. This means that the click event and pageview event functionality supported by the [browser SDK](https://github.com/launchdarkly/js-client) is available in Electron windows.

However, whether you can use URL matching rules depends on what the URLs are within your application windows. Often, these are based on an internal file path within the application.

### Bootstrapping

The `bootstrap` property in the client options allows you to speed up the startup process by providing an initial set of flag values.

If you set `bootstrap` to an object, the client will treat it as a map of flag keys to flag values. The client will immediately start out in a ready state using these values. It will still make an initial request to LaunchDarkly to get the actual latest values, but that will happen in the background.

If you set `bootstrap` to the string `"localstorage"`, the client will try to get flag values from persistent storage, using a unique key that is based on the user properties. If the client finds flag values stored for this user, it uses them and starts up immediately in a ready state-- but also makes a background request to LaunchDarkly to get the latest values, and stores them as soon as it receives them. The values are stored in files in the [`userData`](https://electronjs.org/docs/all?query=getpath#appgetpathname) directory.

### Feature flags

To evaluate any feature flag for the current user, call `variation`:

```js
var showFeature = client.variation("YOUR_FEATURE_KEY", false);

if (showFeature)  {
  // feature flag is  on
} else {
  // feature flag is off
}
```

The return value of `variation` will always be either one of the variations you defined for your flag in the LaunchDarkly dashboard, or the default value. The default value is the second parameter to `variation` (in this case `false`) and it is what the client will use if it's not possible to evaluate the flag (for instance, if the flag key does not exist, or if something about the definition of the flag is invalid).

You can also fetch all feature flags for the current user:

```js
var flags = client.allFlags();
var showFeature = flags['YOUR_FEATURE_KEY'];
```

This returns a key-value map of all your feature flags. It will contain `null` values for any flags that could not be evaluated.

Note that both of these methods are synchronous. The client always has the last known flag values in memory, so retrieving them does not involve any I/O.

### Changing users

The `identify()` method tells the client to change the current user, and obtain the feature flag values for the new user. For example, on a sign-in page in a single-page app, you may initialize the client with an anonymous user; when the user logs in, you'd want the feature flag settings for the authenticated user. 

If you provide a callback function, it will be called (with a map of flag keys and values) once the flag values for the new user are available; after that point, `variation()` will be using the new values. You can also use a Promise for the same purpose.

```js
var newUser = { key: 'someone-else', name: 'John' };

client.identify(newUser, function(newFlags) {
  console.log('value of flag for this user is: ' + newFlags["YOUR_FEATURE_KEY"]);
  console.log('this should be the same: ' + client.variation("YOUR_FEATURE_KEY"));
});

// or:
client.identify(newUser).then(function(newFlags) {
  // as above
});
```

Note that the client always has _one_ current user. The client-side SDKs are not designed for evaluating flags for different users at the same time.

### Analytics events

Evaluating flags, either with `variation()` or with `allFlags()`, produces analytics events which you can observe on your LaunchDarkly Debugger page. Specifying a user with `identify()` (and also the initial user specified in the client constructor) also produces an analytics event, which is how LaunchDarkly receives your user data.

You can also explicitly send an event with any data you like using the `track` function:

```js
client.track('my-custom-event-key', { customProperty: someValue });
```

You can completely disable event sending by setting `sendEvents` to `false` in the client options, but be aware that this means you will not have user data on your LaunchDarkly dashboard.

### Receiving live updates

By default, the client requests feature flag values only once per user (i.e. once at startup time, and then each time you call `identify()`). You can also use a persistent connection to receive flag updates whenever they occur.

Setting `streaming` to `true` in the client options, or calling `client.setStreaming(true)`, turns on this behavior. LaunchDarkly will push new values to the SDK, which will update the current feature flag state in the background, ensuring that `variation()` will always return the latest values.

If you want to be notified when a flag has changed, you can use an event listener for a specific flag:

```js
client.on('change:YOUR_FEATURE_KEY', function(newValue, oldValue) {
  console.log('The flag was ' + oldValue + ' and now it is ' + newValue);
});
```

Or, you can listen for all feature flag changes:

```js
client.on('change', function(allFlagChanges)) {
  Object.keys(allFlagChanges).forEach(function(key) {
    console.log('Flag ' + key + ' is now ' + allFlagChanges[key]);
  });
});
```

Subscribing to `change` events will automatically turn on streaming mode too, unless you have explicitly set `streaming` to `false`.

### Logging

By default, the SDK uses the `winston` package. There are four logging levels: `debug`, `info`, `warn`, and `error`; by default, `debug` and `info` messages are hidden. See the [TypeScript definitions](https://github.com/launchdarkly/js-client/tree/master/packages/ldclient-js-common/typings.d.ts) for `LDLogger`, `LDOptions`, and `createConsoleLogger` for more details.

## Node SDK compatibility mode

For developers who are porting LaunchDarkly-enabled Node.js code to Electron, there are differences between the APIs that can be inconvenient. For instance, in the LaunchDarkly Node SDK, `variation()` is an asynchronous call that takes a callback, whereas in the client-side SDKs it is synchronous.

To make this transition easier, the LaunchDarkly Electron SDK provides an optional wrapper that emulates the Node SDK. When creating the main-process client, after calling `initializeInMain`, pass the client object to `createNodeSdkAdapter`. The resulting object will use the Node-style API.

```js
var realClient = LDElectron.initializeInMain('YOUR_CLIENT_SIDE_ID', user, options);
var wrappedClient = LDElectron.createNodeSdkAdapter(realClient);
wrappedClient.waitForInitialization().then(function() {
    wrappedClient.variation(flagKey, user, defaultValue, function(err, result) {
        console.log('flag value is ' + result);
    });
});
```

Keep in mind that the underlying implementation is still the client-side SDK, which has a single-current-user model. Therefore, when you call `client.variation(flagKey, user, defaultValue)` it is really calling `client.identify(user)` first, obtaining flag values for that user, and then evaluating the flag. This will perform poorly if you attempt to evaluate flags for a variety of different users in rapid succession.

## Development information

The basic client logic that is shared by the Electron SDK and the browser SDK is in the `ldclient-js-common` package within [js-client](https://github.com/launchdarkly/js-client), which is published separately to NPM.

To build and test the project, from the project root directory:
* `npm install`
* `npm test`

## Community

Here are resources from our awesome community:

* [TrueCar/react-launch-darkly](https://github.com/TrueCar/react-launch-darkly/): A set of component helpers to add support for LaunchDarkly to your React.js app
* [yusinto/ld-redux](https://github.com/yusinto/ld-redux/): A library to integrate LaunchDarkly with React and Redux
* [tdeekens/flopflip](https://github.com/tdeekens/flopflip): A flexible feature-toggling library that integrates with LaunchDarkly

## About LaunchDarkly

* LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  * Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  * Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  * Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  * Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan). Disable parts of your application to facilitate maintenance, without taking everything offline.
* LaunchDarkly provides feature flag SDKs for
  * [Java](http://docs.launchdarkly.com/docs/java-sdk-reference 'Java SDK')
  * [JavaScript](http://docs.launchdarkly.com/docs/js-sdk-reference 'LaunchDarkly JavaScript SDK')
  * [PHP](http://docs.launchdarkly.com/docs/php-sdk-reference 'LaunchDarkly PHP SDK')
  * [Python](http://docs.launchdarkly.com/docs/python-sdk-reference 'LaunchDarkly Python SDK')
  * [Go](http://docs.launchdarkly.com/docs/go-sdk-reference 'LaunchDarkly Go SDK')
  * [Node.JS](http://docs.launchdarkly.com/docs/node-sdk-reference 'LaunchDarkly Node SDK')
  * [Electron](http://docs.launchdarkly.com/docs/electron-sdk-reference 'LaunchDarkly Electron SDK')
  * [.NET](http://docs.launchdarkly.com/docs/dotnet-sdk-reference 'LaunchDarkly .Net SDK')
  * [Ruby](http://docs.launchdarkly.com/docs/ruby-sdk-reference 'LaunchDarkly Ruby SDK')
  * [iOS](http://docs.launchdarkly.com/docs/ios-sdk-reference 'LaunchDarkly iOS SDK')
  * [Android](http://docs.launchdarkly.com/docs/android-sdk-reference 'LaunchDarkly Android SDK')
* Explore LaunchDarkly
  * [launchdarkly.com](http://www.launchdarkly.com/ 'LaunchDarkly Main Website')
    for more information
  * [docs.launchdarkly.com](http://docs.launchdarkly.com/ 'LaunchDarkly Documentation')
    for our documentation and SDKs
  * [apidocs.launchdarkly.com](http://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation')
    for our API documentation
  * [blog.launchdarkly.com](http://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation')
    for the latest product updates
  * [Feature Flagging Guide](https://github.com/launchdarkly/featureflags/ 'Feature Flagging Guide')
    for best practices and strategies
