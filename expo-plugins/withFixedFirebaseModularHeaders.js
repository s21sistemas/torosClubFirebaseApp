const { withPodfile } = require("@expo/config-plugins");

module.exports = function withFixedFirebaseModularHeaders(config) {
  return withPodfile(config, (config) => {
    const podfile = config.modResults.contents;

    console.log("🔧 Ejecutando plugin withFixedFirebaseModularHeaders...");

    // Verifica si ya existe la línea
    if (podfile.includes("use_modular_headers!")) {
      console.log("✅ use_modular_headers! ya está presente.");
      return config;
    }

    // Inserta justo antes del bloque 'target ... do'
    config.modResults.contents = podfile.replace(
      /target\s+['"].+['"]\s+do/,
      "use_modular_headers!\n\n$&"
    );

    console.log("✅ use_modular_headers! insertado correctamente.");

    return config;
  });
};
