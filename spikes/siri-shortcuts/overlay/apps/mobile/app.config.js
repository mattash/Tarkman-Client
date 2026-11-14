// Used only in the prepared external clone. Isolation is unconditional.
module.exports = ({ config }) => {
  const baseline = false; // Replaced only by prepare.mjs --baseline.
  // Never inherit the production EAS project or its OTA update endpoint.
  // A separate EAS project must be provisioned explicitly before a cloud build.
  const extra = { ...config.extra };
  delete extra.eas;

  return {
    ...config,
    name: 'Tarkman Siri Spike',
    slug: 'tarkman-siri-spike',
    scheme: 'tarkman-siri-spike',
    platforms: ['ios'],
    ios: {
      ...config.ios,
      bundleIdentifier: 'app.tarkman.sirispike',
      associatedDomains: [],
    },
    android: {
      ...config.android,
      package: 'app.tarkman.sirispike',
      intentFilters: [],
    },
    extra: { ...extra, siriSpike: !baseline },
    updates: { enabled: false },
    plugins: baseline ? config.plugins : [...(config.plugins ?? []), 'expo-app-intents'],
    experiments: baseline ? config.experiments : {
      ...config.experiments,
      inlineModules: {
        ...config.experiments?.inlineModules,
        watchedDirectories: [
          ...(config.experiments?.inlineModules?.watchedDirectories ?? []),
          'app-intents',
        ],
      },
    },
  };
};
