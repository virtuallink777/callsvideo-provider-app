const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withNotificationChannelFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Por si el template no lo trae declarado
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    const app = manifest.application[0];
    const target = (app["meta-data"] || []).find(
      (m) =>
        m.$["android:name"] ===
        "com.google.firebase.messaging.default_notification_channel_id",
    );

    if (target) {
      target.$["tools:replace"] = "android:value";
    } else {
      console.warn(
        "[withNotificationChannelFix] No se encontró el meta-data de Firebase — revisá el orden de plugins en app.json.",
      );
    }

    return config;
  });
};