const { withAndroidManifest } = require("@expo/config-plugins");

const withCallKeep = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];

    if (!application.service) {
      application.service = [];
    }

    const serviceName = "io.wazo.callkeep.VoiceConnectionService";

    const hasCallKeepService = application.service.some(
      (service) =>
        service.$ &&
        service.$["android:name"] === serviceName
    );

    if (!hasCallKeepService) {
      application.service.push({
        $: {
          "android:name": serviceName,
          "android:label": "phone",
          "android:permission":
            "android.permission.BIND_TELECOM_CONNECTION_SERVICE",
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
