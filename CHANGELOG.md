# Change log

All notable changes to the LaunchDarkly Electron SDK will be documented in this file. This project adheres to [Semantic Versioning](http://semver.org).

## [1.4.1] - 2020-01-15
### Fixed:
- The SDK now specifies a uniquely identifiable request header when sending events to LaunchDarkly to ensure that events are only processed once, even if the SDK sends them two times due to a failed initial attempt.

## [1.4.0] - 2019-12-16
### Added:
- Configuration property `eventCapacity`: the maximum number of analytics events (not counting evaluation counters) that can be held at once, to prevent the SDK from consuming unexpected amounts of memory in case an application generates events unusually rapidly. In JavaScript code this would not normally be an issue, since the SDK flushes events every two seconds by default, but you may wish to increase this value if you will intentionally be generating a high volume of custom or identify events. The default value is 100.

### Changed:
- The SDK now logs a warning if any configuration property has an inappropriate type, such as `baseUri:3` or `sendEvents:"no"`. For boolean properties, the SDK will still interpret the value in terms of truthiness, which was the previous behavior. For all other types, since there's no such commonly accepted way to coerce the type, it will fall back to the default setting for that property; previously, the behavior was undefined but most such mistakes would have caused the SDK to throw an exception at some later point.

### Fixed:
- Removed development dependency on `typedoc` which caused some vulnerability warnings.

### Deprecated:
- The `samplingInterval` configuration property was deprecated in the code in the previous minor version release, and in the changelog, but the deprecation notice was accidentally omitted from the documentation comments. It is hereby deprecated again.

## [1.3.0] - 2019-11-05
### Changed:
- Changed the behavior of the warning message that is logged on failing to establish a streaming connection. Rather than the current behavior where the warning message appears upon each failed attempt, it will now only appear on the first failure in each series of attempts. Also, the message has been changed to mention that retries will occur.

### Deprecated:
- The `samplingInterval` configuration property is deprecated and will be removed in a future version. The intended use case for the `samplingInterval` feature was to reduce analytics event network usage in high-traffic applications. This feature is being deprecated in favor of summary counters, which are meant to track all events.


## [1.2.0] - 2019-10-10
### Added:
- Added support for upcoming LaunchDarkly experimentation features. See `LDClient.track()`.
- The `createConsoleLogger()` function now has an optional second parameter for customizing the log prefix.

### Changed:
- Log messages from `createConsoleLogger()` now include the level ("[warn]", "[error]", etc.) and have a prefix of "LD:" by default.


## [1.1.4] - 2019-07-08
### Added:
- The SDK now logs a message at `info` level when the stream connection is started or stopped. It also logs a message at `warn` level if it detects that the stream had to be restarted due to a connection failure.
- The CI build now includes integration tests of an entire Electron application, so front-end behavior now has test coverage.

### Fixed:
- The SDK failed to restart a streaming connection if it had already been dropped and restarted before.
- Renderer windows were making HTTP requests to LaunchDarkly for goals data. This was unnecessary because click and pageview goals currently do not work in Electron (due to the fact that LaunchDarkly expects them to have web URLs). Therefore these requests have been turned off.
- When calling `track()` to create a custom analytics event from a renderer window, the `url` property in the event was being set to the value of `window.location.href`, which in Electron is a file URL that starts with the absolute path of the application. Since that is dependent on where the user happened to install the application, it's not useful for analytics where you just want to know what page/window the event came from. This has been changed to a relative file path within the  application, such as `/static/main.html`.
- Calling `initializeInRenderer` with an `options` object and no `environment` parameter could cause flags not to load.
- Calling `initializeInRenderer` with no `environment` parameter could cause a confusing error message in the console ("Error fetching flags: 200").

## [1.1.3] - 2019-06-13
### Fixed:
- The `initializeInRenderer` method was broken in the 1.1.2 release, as a side effect of renaming the SDK package. This has been fixed.

## [1.1.2] - 2019-05-13
### Changed:
- Changed the package name from `ldclient-electron` to `launchdarkly-electron-client-sdk`.
 
There are no other changes in this release. Substituting `ldclient-electron` version 1.1.1 with `launchdarkly-electron-client-sdk` version 1.1.2 (and updating any `require` or `import` lines that referred to the old package name) will not affect functionality.

## [1.1.1] - 2019-05-10

**_Note: this is a replacement for the 1.1.0 release, which was broken and has been removed._**

### Added:
- Generated TypeDoc documentation for all types, properties, and methods is now available online at [https://launchdarkly.github.io/electron-client-sdk/](https://launchdarkly.github.io/electron-client-sdk/). Currently this will only be for the latest released version.
- The SDK now allows you to specify an anonymous user without a key (i.e. the `anonymous` property is `true`, and there is no `key` property). In that case, the SDK will generate a UUID and send that as the user key. It will also cache this generated key in local storage so that anonymous users will always get the same key when running under the same user account in the operating system.
- It is now possible to specify any of the TLS configuration parameters supported by Node's `https.request()` in the client configuration, so that they will apply to all HTTPS requests made by the SDK. In your client options, add a property called `tlsParams` whose value is an object containing those parameters, e.g. `tlsParams: { ca: 'my trusted CA certificate data' }`.

### Fixed:
- The `version` constant was incorrectly reporting the version string of the core JavaScript SDK package that is used internally. It is now the version string of the Electron SDK.
- Setting user attributes to non-string values when a string was expected would prevent evaluations and analytics events from working. The SDK will now convert attribute values to strings as needed.

# Note on future releases

The LaunchDarkly SDK repositories are being renamed for consistency. This repository is now `electron-client-sdk` rather than `electron-client`.

The package name will also change. In the 1.1.1 release, it is still `ldclient-electron`; in all future releases, it will be `launchdarkly-electron-client-sdk`. No further updates to the `ldclient-electron` package will be published after this release.

## [1.0.1] - 2019-03-25
### Fixed:
- Improved TypeScript documentation comments throughout. This is the only change in the `ldclient-electron` package. However, the following fixes were made in the 2.9.5 release of `ldclient-js-common` (which will be picked up automatically by `ldclient-electron` even if you are using the previous release, since its dependency version is "^2.9.0"):
- The user attributes `secondary` and `privateAttributeNames` were not included in the TypeScript declarations and therefore could not be used from TypeScript code.
- Corrected the TypeScript declaration for the `identify` method to indicate that its asynchronous result type is `LDFlagSet`, not `void`.
- If the SDK received streaming updates out of order (rare, but possible) such that it received "flag X was deleted" prior to "flag X was created", an uncaught exception would be logged (but would not otherwise affect anything).

## [1.0.0] - 2019-02-01
First full release.

Note that there is an old beta release of this package on NPM with the version "2.9.0-beta1". This is because the `ldclient-electron` package originally used the same versioning as the `ldclient-js` package.
