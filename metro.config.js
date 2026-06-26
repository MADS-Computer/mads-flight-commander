const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Stub CSS imports — packages like mapbox-gl import their own stylesheet,
// which Metro cannot bundle. Return an empty module instead of failing.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith('.css')) {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
