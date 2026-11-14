// Native Siri spike only. Normal builds retain app.json unchanged.
module.exports = ({ config }) => {
  if (process.env.TARKMAN_SIRI_SPIKE !== '1') {
    return config;
  }

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
    extra: { ...extra, siriSpike: true },
    updates: { enabled: false },
    plugins: [...(config.plugins ?? []), 'expo-app-intents'],
    experiments: {
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
