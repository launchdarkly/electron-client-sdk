# LaunchDarkly Client-Side Electron SDK

[![Circle CI](https://circleci.com/gh/launchdarkly/electron-client-sdk.svg?style=svg)](https://circleci.com/gh/launchdarkly/electron-client-sdk)

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves over 100 billion feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/docs/getting-started) using LaunchDarkly today!
 
[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

## Getting started

Refer to the [SDK documentation](https://docs.launchdarkly.com/docs/electron-sdk-reference) for instructions on getting started with using the SDK.

Please note that the Electron SDK, like the [browser Javascript SDK](https://docs.launchdarkly.com/docs/js-sdk-reference), has two special requirements in terms of your LaunchDarkly environment. First, in terms of the credentials for your environment that appear on your [Account Settings](https://app.launchdarkly.com/settings/projects) dashboard, the JavaScript SDK uses the "Client-side ID" (also called the environment ID)-- not the "SDK key" or the "Mobile key". Second, for any feature flag that you will be using in Electron, you must check the "Make this flag available to client-side SDKs" box on that flag's Settings page.

## Implementation notes

### Logging

By default, the SDK uses the `winston` package. There are four logging levels: `debug`, `info`, `warn`, and `error`; by default, `debug` and `info` messages are hidden. See [`LDOptions.logger`](https://launchdarkly.github.io/electron-client-sdk/interfaces/_ldclient_js_.ldoptions.html#logger) and [`createConsoleLogger`](https://launchdarkly.github.io/electron-client-sdk/index.html#createconsolelogger)` for more details.

### Node SDK compatibility mode

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

## Learn more

Check out our [documentation](https://docs.launchdarkly.com) for in-depth instructions on configuring and using LaunchDarkly. You can also head straight to the [complete reference guide for this SDK](https://docs.launchdarkly.com/docs/electron-sdk-reference). Additionally, the authoritative full description of all properties, types, and methods is the [online TypeScript documentation](https://launchdarkly.github.io/electron-client-sdk/). If you are not using TypeScript, then the types are only for your information and are not enforced, although the properties and methods are still the same as described in the documentation.

For an example of using the SDK in a simple Electron application, see [`hello-electron`](https://github.com/launchdarkly/hello-electron).

## Testing

We run integration tests for all our SDKs using a centralized test harness. This approach gives us the ability to test for consistency across SDKs, as well as test networking behavior in a long-running application. These tests cover each method in the SDK, and verify that event sending, flag evaluation, stream reconnection, and other aspects of the SDK all behave correctly.

## Contributing

We encourage pull requests and other contributions from the community. Check out our [contributing guidelines](CONTRIBUTING.md) for instructions on how to contribute to this SDK.

## About LaunchDarkly

* LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard.  With LaunchDarkly, you can:
    * Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
    * Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
    * Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
    * Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan). Disable parts of your application to facilitate maintenance, without taking everything offline.
* LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Check out [our documentation](https://docs.launchdarkly.com/docs) for a complete list.
* Explore LaunchDarkly
    * [launchdarkly.com](https://www.launchdarkly.com/ "LaunchDarkly Main Website") for more information
    * [docs.launchdarkly.com](https://docs.launchdarkly.com/  "LaunchDarkly Documentation") for our documentation and SDK reference guides
    * [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/  "LaunchDarkly API Documentation") for our API documentation
    * [blog.launchdarkly.com](https://blog.launchdarkly.com/  "LaunchDarkly Blog Documentation") for the latest product updates
    * [Feature Flagging Guide](https://github.com/launchdarkly/featureflags/  "Feature Flagging Guide") for best practices and strategies
