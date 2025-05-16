const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Si necesitas soporte para paquetes como `@react-native-firebase/*`
config.resolver.unstable_enablePackageExports = false;
config.resolver.sourceExts.push('cjs');

module.exports = config;

