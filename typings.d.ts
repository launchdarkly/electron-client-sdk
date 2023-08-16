/**
 * This is the API reference for the LaunchDarkly SDK for Electron.
 *
 * In typical usage, you will call [[initializeInMain]] in the main process at startup time to obtain
 * an instance of [[LDElectronMainClient]]-- and, optionally, call [[initializeInRenderer]] in a
 * renderer process to obtain a corresponding instance of [[LDElectronRendererClient]].
 *
 * For more information, see the [SDK reference guide](https://docs.launchdarkly.com/sdk/client-side/electron).
 */
declare module 'launchdarkly-electron-client-sdk' {

//// DOCBUILD-START-REPLACE  (see docs/Makefile)
  export * from 'launchdarkly-js-sdk-common';

  import {
    LDEvaluationDetail,
    LDEvaluationReason,
    LDFlagSet,
    LDFlagValue,
    LDClientBase,
    LDOptionsBase,
    LDUser
  } from 'launchdarkly-js-sdk-common';
//// DOCBUILD-END-REPLACE

  /**
   * Creates an instance of the LaunchDarkly Electron client to be used in the main process.
   *
   * Applications should instantiate a single instance for the lifetime of the application.
   * The client will begin attempting to connect to LaunchDarkly as soon as it is created. To
   * determine when it is ready to use, call [[LDElectronMainClient.waitForInitialization]], or register an
   * event listener for the `"ready"` event using [[LDElectronMainClient.on]].
   *
   * @param envKey
   *   The LaunchDarkly environment ID.
   * @param user
   *   The initial user properties. These can be changed later with [[LDElectronMainClient.identify]].
   * @param options
   *   Optional configuration settings.
   */
  export function initializeInMain(envKey: string, user: LDUser, options?: LDOptions): LDElectronMainClient;

  /**
   * Creates an instance of the LaunchDarkly Electron client to be used in a renderer process, which
   * will receive all of its state from a client in the main process.
   *
   * @param envKey
   *   The LaunchDarkly environment ID. This can usually be omitted because it can be obtained from the
   *   [[LDElectronMainClient]] instance in the main process. You only need to specify it here if there
   *   are multiple client instances with different environment IDs.
   * @param options
   *   Optional configuration settings. Since the main process client controls all communication with
   *   LaunchDarkly, the only options that can actually be set for the renderer client are the ones that
   *   control event generation: `sendEvents`, `allAttributesPrivate`, `privateAttributeNames`,
   *   `inlineUsersInEvents, `allowFrequentDuplicateEvents`, and `sendEventsOnlyForVariation`.
   */
  export function initializeInRenderer(envKey?: string, options?: LDOptions): LDElectronRendererClient;

  /**
   * Initialization options for the LaunchDarkly Electron SDK.
   */
  export interface LDOptions extends LDOptionsBase {
  }

  /**
   * The LaunchDarkly SDK client object for use in an Electron main process.
   *
   * Applications should configure the client at startup time with [[initializeInMain]], and reuse the same instance.
   *
   * For more information, see the [SDK Reference Guide](https://docs.launchdarkly.com/sdk/client-side/electron).
   */
  export interface LDElectronMainClient extends LDClientBase {
    /**
     * Builds an object that encapsulates the state of all feature flags for a given user.
     * This includes the flag values and also metadata that can be used on the front end. This
     * method does not send analytics events back to LaunchDarkly.
     *
     * The most common use case for this method is to bootstrap a set of client-side
     * feature flags from a back-end service. Call the `toJSON()` method of the returned object
     * to convert it to the data structure used by the client-side SDK.
     *
     * Note that in an Electron application, it is normally unnecessary to use this method to
     * pass flags to a client in a renderer process. Instead, the standard way to do this is to
     * use [[initializeInRenderer]] to create a client that automatically synchronizes itself with
     * the main process client. However, this method is still provided for compatibility in case
     * you are adapting code that used this mechanism with one of the server-side SDKs.
     *
     * @returns the state object
     */
    allFlagsState(): LDFlagsState;
  }

  /**
   * The LaunchDarkly SDK client object for use in an Electron renderer process.
   *
   * Applications should configure the client at page load time with [[initializeInRenderer]]. It is basically a
   * proxy for the client instance in the main process, and is automatically kept in sync with the main client's state.
   *
   * For more information, see the [SDK Reference Guide](https://docs.launchdarkly.com/sdk/client-side/electron).
   */
  export interface LDElectronRendererClient extends LDClientBase {
  }

  /**
   * An object that contains the state of all feature flags, generated by the
   * [[LDElectronMainClient.allFlagsState]] method.
   */
  export interface LDFlagsState {
    /**
     * True if this object contains a valid snapshot of feature flag state, or false if the
     * state could not be computed (for instance, because the client was offline or there
     * was no user).
     */
    valid: boolean;

    /**
     * Returns the value of an individual feature flag at the time the state was recorded.
     * It will be null if the flag returned the default value, or if there was no such flag.
     *
     * @param key
     *   The flag key.
     */
    getFlagValue(key: string): LDFlagValue;

    /**
     * Returns the evaluation reason for a feature flag at the time the state was recorded.
     * It will be null if reasons were not recorded, or if there was no such flag.
     *
     * @param key
     *   The flag key.
     */
    getFlagReason(key: string): LDEvaluationReason;

    /**
     * Returns a map of feature flag keys to values. If a flag would have evaluated to the
     * default value, its value will be null.
     *
     * Do not use this method if you are passing data to the front end to "bootstrap" the
     * JavaScript client. Instead, use [[toJSON]].
     */
    allValues(): LDFlagSet;

    /**
     * Returns a Javascript representation of the entire state map, in the format used by
     * the Javascript browser SDK. Use this method if you are passing data to the front end in
     * order to "bootstrap" the JavaScript client.
     *
     * Do not rely on the exact shape of this data, as it may change in future to support
     * the needs of the JavaScript client.
     */
    toJSON(): object;
  }

  /**
   * Wraps an instance of the LaunchDarkly Electron main-process client with an alternate interface
   * that is the same as the LaunchDarkly Node SDK. This is intended to make it easier to port
   * LaunchDarkly-enabled Node.js code to Electron.
   *
   * @param client
   *   An instance of [[LDElectronMainClient]] created with [[initializeInMain]].
   * @returns
   *   An instance of [[LDElectronNodeAdapterClient]] that controls the same SDK client.
   */
  export function createNodeSdkAdapter(client: LDElectronMainClient): LDElectronNodeAdapterClient;

  /**
   * Interface for the Node SDK compatibility wrapper returned by [[createNodeSdkAdapter]].
   *
   * Keep in mind that the underlying implementation is still the client-side SDK, which has a
   * single-current-user model. Therefore, when you call `variation(flagKey, user, defaultValue)`,
   * it is really calling `identify(user)` first, obtaining flag values for that user, and then
   * evaluating the flag. This will perform poorly if you attempt to evaluate flags for a variety
   * of different users in rapid succession.
   */
  export interface LDElectronNodeAdapterClient {
    /**
     * Tests whether the client has completed initialization.
     *
     * If this returns false, it means that the client has not yet successfully connected to LaunchDarkly.
     * It might still be in the process of starting up, or it might be attempting to reconnect after an
     * unsuccessful attempt, or it might have received an unrecoverable error (such as an invalid SDK key)
     * and given up.
     *
     * @returns
     *   True if the client has successfully initialized.
     */
    initialized(): boolean;

    /**
     * Returns a Promise that tracks the client's initialization state.
     *
     * **Deprecated**: please use [[waitForInitialization]] instead. The difference between that method
     * and this one is that `waitUntilReady` never rejects the Promise, even if initialization fails.
     *
     * @returns
     *   A Promise that will be resolved if the client initializes successfully.
     */
    waitUntilReady(): Promise<void>;

    /**
     * Returns a Promise that tracks the client's initialization state.
     *
     * The Promise will be resolved if the client successfully initializes, or rejected if client
     * initialization has irrevocably failed (for instance, if it detects that the SDK key is invalid).
     *
     * Note that you can also use event listeners ([[on]]) for the same purpose: the event `"ready"`
     * indicates success, and `"failed"` indicates failure.
     *
     * @returns
     *   A Promise that will be resolved if the client initializes successfully, or rejected if it
     *   fails. If successful, the result is the same client object.
     */
    waitForInitialization(): Promise<LDElectronNodeAdapterClient>;

    /**
     * Determines the variation of a feature flag for a user.
     *
     * @param key
     *   The unique key of the feature flag.
     * @param user
     *   The end user requesting the flag. The client will generate an analytics event to register
     *   this user with LaunchDarkly if the user does not already exist.
     * @param defaultValue
     *   The default value of the flag, to be used if the value is not available from LaunchDarkly.
     * @param callback
     *   A Node-style callback to receive the result value. If omitted, you will receive a Promise instead.
     * @returns
     *   If you provided a callback, then nothing. Otherwise, a Promise which will be resolved
     *   with the result value.
     */
    variation(
      key: string,
      user: LDUser,
      defaultValue: LDFlagValue,
      callback?: (err: any, res: LDFlagValue) => void
    ): Promise<LDFlagValue>;

    /**
     * Determines the variation of a feature flag for a user, along with information about how it was
     * calculated.
     *
     * The `reason` property of the result will also be included in analytics events, if you are
     * capturing detailed event data for this flag.
     *
     * For more information, see the [SDK reference guide](https://docs.launchdarkly.com/sdk/concepts/evaluation-reasons).
     *
     * @param key
     *   The unique key of the feature flag.
     * @param user
     *   The end user requesting the flag. The client will generate an analytics event to register
     *   this user with LaunchDarkly if the user does not already exist.
     * @param defaultValue
     *   The default value of the flag, to be used if the value is not available from LaunchDarkly.
     * @param callback
     *   A Node-style callback to receive the result (as an [[LDEvaluationDetail]]). If omitted, you
     *   will receive a Promise instead.
     * @returns
     *   If you provided a callback, then nothing. Otherwise, a Promise which will be resolved
     *   with the result (as an [[LDEvaluationDetail]]).
     */
    variationDetail(
      key: string,
      user: LDUser,
      defaultValue: LDFlagValue,
      callback?: (err: any, res: LDEvaluationDetail) => void
    ): Promise<LDEvaluationDetail>;

    /**
     * Retrieves the set of all flag values for a user.
     *
     * **Deprecated**: use [[allFlagsState]] instead. Current versions of the client-side
     * SDK will not generate analytics events correctly if you pass the result of `allFlags()`.
     *
     * @param user
     *   The end user requesting the feature flags.
     * @param callback
     *   A Node-style callback to receive the result (as an [[LDFlagSet]]). If omitted, you
     *   will receive a Promise instead.
     * @returns
     *   If you provided a callback, then nothing. Otherwise, a Promise which will be resolved
     *   with the result as an [[LDFlagSet]].
     */
    allFlags(
      user: LDUser,
      callback?: (err: any, res: LDFlagSet) => void
    ): Promise<LDFlagSet>;

    /**
     * Builds an object that encapsulates the state of all feature flags for a given user.
     * This includes the flag values and also metadata that can be used on the front end. This
     * method does not send analytics events back to LaunchDarkly.
     *
     * The most common use case for this method is to bootstrap a set of client-side
     * feature flags from a back-end service. Call the `toJSON()` method of the returned object
     * to convert it to the data structure used by the client-side SDK.
     *
     * @param user
     *   The end user requesting the feature flags.
     * @param options
     *   Optional [[LDFlagsStateOptions]] to determine how the state is computed.
     * @param callback
     *   A Node-style callback to receive the result (as an [[LDFlagsState]]). If omitted, you
     *   will receive a Promise instead.
     * @returns
     *   If you provided a callback, then nothing. Otherwise, a Promise which will be resolved
     *   with the result as an [[LDFlagsState]].
     */
    allFlagsState(
      user: LDUser,
      options?: object,
      callback?: (err: any, res: LDFlagsState) => void
    ): Promise<LDFlagsState>;

    /**
     * In the Node SDK, `secureModeHash` computes an HMAC signature of a user signed with the
     * client's SDK key. This is not possible in Electron because the SDK key is not available,
     * so `secureModeHash` will always return an empty string.
     *
     * @param user
     *
     * @returns An empty string.
     */
    secureModeHash(user: LDUser): string;

    /**
     * Discards all network connections, background tasks, and other resources held by the client.
     *
     * Do not attempt to use the client after calling this method.
     */
    close(): void;

    /**
     * Tests whether the client is configured in offline mode.
     *
     * @returns
     *   True if the `offline` property is true in your [[LDOptions]].
     */
    isOffline(): boolean;

    /**
     * Tracks that a user performed an event.
     *
     * LaunchDarkly automatically tracks pageviews and clicks that are specified in the Metricss
     * section of the dashboard. This can be used to track custom metrics (goals) or other events that do
     * not currently have metrics.
     *
     * @param key
     *   The name of the event, which may correspond to a metric in experiments.
     * @param user
     *   The user to track.
     * @param data
     *   Optional additional information to associate with the event.
     */
    track(key: string, user: LDUser, data?: any): void;

    /**
     * Associates two users for analytics purposes.
     *
     * This can be helpful in the situation where a person is represented by multiple
     * LaunchDarkly users. This may happen, for example, when a person initially logs into
     * an application-- the person might be represented by an anonymous user prior to logging
     * in and a different user after logging in, as denoted by a different user key.
     *
     * @param user
     *   The newly identified user.
     * @param previousUser
     *   The previously identified user.
     */
    alias(user: LDUser, previousUser: LDUser): void;

    /**
     * Identifies a user to LaunchDarkly.
     *
     * This simply creates an analytics event that will transmit the given user properties to
     * LaunchDarkly, so that the user will be visible on your dashboard even if you have not
     * evaluated any flags for that user. It has no other effect.
     *
     * @param user
     *   The user properties. Must contain at least the `key` property.
     */
    identify(user: LDUser): void;

    /**
     * Flushes all pending analytics events.
     *
     * Normally, batches of events are delivered in the background at intervals determined by the
     * `flushInterval` property of [[LDOptions]]. Calling `flush()` triggers an immediate delivery.
     *
     * @param callback
     *   A function which will be called when the flush completes. If omitted, you
     *   will receive a Promise instead.
     *
     * @returns
     *   If you provided a callback, then nothing. Otherwise, a Promise which resolves once
     *   flushing is finished. Note that the Promise will be rejected if the HTTP request
     *   fails, so be sure to attach a rejection handler to it.
     */
    flush(callback?: (err: any, res: boolean) => void): Promise<void>;
  }
}
