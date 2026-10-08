// src/services/ringtone.ts
// v2.0.0: el sonido de llamada lo maneja el canal NATIVO de Notifee
// (ringtone.mp3 empaquetado en res/raw + canal "incoming_calls").
// Estas funciones quedan como no-op por compatibilidad con los screens de v1.

export const startRingtone = async (): Promise<void> => {
  console.log("🔊 [ringtone] El sonido lo pone el canal nativo de Notifee");
};

export const stopRingtone = async (): Promise<void> => {
  console.log("🔕 [ringtone] Detenido (canal nativo)");
};

export const startVibration = async (): Promise<void> => {
  console.log("📳 [vibration] El canal nativo ya vibra");
};

export const stopVibration = async (): Promise<void> => {
  console.log("📳 [vibration] Detenida");
};
