# Change log

All notable changes to the LaunchDarkly Electron SDK will be documented in this file.

## [1.0.1] - 2019-03-25
### Fixed:
- Improved TypeScript documentation comments throughout. This is the only change in the `ldclient-electron` package. However, the following fixes were made in the 2.9.5 release of `ldclient-js-common` (which will be picked up automatically by `ldclient-electron` even if you are using the previous release, since its dependency version is "^2.9.0"):
- The user attributes `secondary` and `privateAttributeNames` were not included in the TypeScript declarations and therefore could not be used from TypeScript code.
- Corrected the TypeScript declaration for the `identify` method to indicate that its asynchronous result type is `LDFlagSet`, not `void`.
- If the SDK received streaming updates out of order (rare, but possible) such that it received "flag X was deleted" prior to "flag X was created", an uncaught exception would be logged (but would not otherwise affect anything).

## [1.0.0] - 2019-02-01
First full release.

Note that there is an old beta release of this package on NPM with the version "2.9.0-beta1". This is because the `ldclient-electron` package originally used the same versioning as the `ldclient-js` package.
