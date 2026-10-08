const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withNotificationChannelFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Asegurar namespace de tools
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    const app = manifest.application[0];

    if (!app["meta-data"]) {
      app["meta-data"] = [];
    }

    const metaData = app["meta-data"];

    const channelName =
      "com.google.firebase.messaging.default_notification_channel_id";

    let target = metaData.find(
      (m) => m.$ && m.$["android:name"] === channelName
    );

    if (target) {
      target.$["android:value"] = "incoming_calls";
      target.$["tools:replace"] = "android:value";

      console.log(
        "[withNotificationChannelFix] Firebase notification channel corregido."
      );
    } else {
      target = {
        $: {
          "android:name": channelName,
          "android:value": "incoming_calls",
          "tools:replace": "android:value",
        },
      };

      metaData.push(target);

      console.log(
        "[withNotificationChannelFix] Firebase notification channel creado."
      );
    }

    return config;
  });
};
