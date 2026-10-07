// src/services/notifee.ts
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
} from "@notifee/react-native";

import { Platform } from "react-native";

const CHANNEL_ID = "incoming_calls";
const FOREGROUND_SERVICE_ID = "callsvideo_service";

/**
 * Crea el canal de notificaciones para llamadas entrantes
 */
export const createNotificationChannel = async (): Promise<string> => {
  if (Platform.OS !== "android") return CHANNEL_ID;

  const channelId = await notifee.createChannel({
    id: CHANNEL_ID,
    name: "Llamadas Entrantes",
    importance: AndroidImportance.HIGH,
    sound: "ringtone", // usa el ringtone.mp3 de assets
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
    lights: true,
    lightColor: "#4f8ef7",
    bypassDnd: true, // ignora "No molestar"
  });

  console.log("📢 Canal de notificaciones creado:", channelId);
  return channelId;
};

/**
 * Inicia el foreground service para mantener la app viva en background
 */
export const startForegroundService = async (): Promise<void> => {
  if (Platform.OS !== "android") return;

  try {
    await notifee.displayNotification({
      id: FOREGROUND_SERVICE_ID,
      title: "CallsVideo Provider",
      body: "🟢 Esperando llamadas entrantes...",
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true, // ← ESTO mantiene la app viva
        ongoing: true, // no se puede deslizar para cerrar
        color: "#4f8ef7",
        smallIcon: "ic_notification",
        visibility: AndroidVisibility.PUBLIC,
      },
    });
    console.log("🔔 Foreground service iniciado");
  } catch (error) {
    console.error("❌ Error iniciando foreground service:", error);
  }
};

/**
 * Detiene el foreground service
 */
export const stopForegroundService = async (): Promise<void> => {
  try {
    await notifee.cancelNotification(FOREGROUND_SERVICE_ID);
    console.log("🔕 Foreground service detenido");
  } catch (error) {
    console.error("❌ Error deteniendo foreground service:", error);
  }
};

/**
 * Muestra una notificación full-screen (fallback si Callkeep falla)
 */
export const displayFullNotification = async (data: {
  callSessionId: string;
  clientEmail: string;
  typeCall: "video" | "audio";
}): Promise<void> => {
  await notifee.displayNotification({
    id: data.callSessionId,
    title: `📞 Llamada entrante de ${data.clientEmail}`,
    body: data.typeCall === "video" ? "Videollamada" : "Llamada de voz",
    data: {
      callSessionId: data.callSessionId,
      clientEmail: data.clientEmail,
      typeCall: data.typeCall,
    },
    android: {
      channelId: CHANNEL_ID,
      category: AndroidCategory.CALL,
      fullScreenAction: {
        id: "incoming_call_screen", // ← abre la pantalla de llamada a pantalla completa
      },
      ongoing: true,
      autoCancel: false,
      color: "#4f8ef7",
      smallIcon: "ic_notification",
      visibility: AndroidVisibility.PUBLIC,
      actions: [
        {
          title: "🟢 Contestar",
          pressAction: { id: "answer" },
        },
        {
          title: "🔴 Rechazar",
          pressAction: { id: "reject" },
        },
      ],
    },
  });
  console.log("📱 Notificación full-screen mostrada");
};

/**
 * Cancela una notificación específica
 */
export const cancelNotification = async (id: string): Promise<void> => {
  await notifee.cancelNotification(id);
};
