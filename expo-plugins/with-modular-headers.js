const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.projectRoot, 'ios', 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf-8');

      if (!contents.includes('use_modular_headers!')) {
        const updatedContents = contents.replace(
          "platform :ios, '",
          "use_modular_headers!\n\nplatform :ios, '"
        );
        fs.writeFileSync(podfilePath, updatedContents);
      }

      return config;
    },
  ]);
};
