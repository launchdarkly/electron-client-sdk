# Contributing to LaunchDarkly SDK for Electron

We encourage pull-requests and other contributions from the community. We've also published an [SDK contributor's guide](http://docs.launchdarkly.com/docs/sdk-contributors-guide) that provides a detailed explanation of how our SDKs work.

The basic client logic that is shared by the Electron SDK and the browser SDK is in the `ldclient-js-common` package within [js-client](https://github.com/launchdarkly/js-client), which is published separately to NPM.

To build and test the project, from the project root directory:
* `npm install`
* `npm test`
