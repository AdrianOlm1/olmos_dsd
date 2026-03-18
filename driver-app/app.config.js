// Disable New Architecture to avoid TurboModuleRegistry PlatformConstants errors
// when using Expo Go or development builds with SDK 52–54.
module.exports = {
  expo: {
    ...require('./app.json').expo,
    newArchEnabled: false,
  },
};
