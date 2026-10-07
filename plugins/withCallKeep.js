// plugins/withCallKeep.js
const { withAndroidManifest } = require("@expo/config-plugins");

const withCallKeep = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    
    // Asegurar que la aplicación tenga el atributo name
    if (!androidManifest.manifest.application) {
      androidManifest.manifest.application = [{}];
    }
    
    const application = androidManifest.manifest.application[0];
    
    // Agregar la actividad de Callkeep si no existe
    if (!application.activity) {
      application.activity = [];
    }
    
    const hasCallKeepActivity = application.activity.some(
      (activity) => activity.$["android:name"] === "io.wazo.callkeep.VoiceConnectionService"
    );
    
    if (!hasCallKeepActivity) {
      application.activity.push({
        $: {
          "android:name": "io.wazo.callkeep.VoiceConnectionService",
          "android:label": "phone",
          "android:permission": "android.permission.BIND_TELECOM_CONNECTION_SERVICE",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name": "android.telecom.ConnectionService",
                },
              },
            ],
          },
        ],
      });
    }
    
    return config;
  });
};

module.exports = withCallKeep;