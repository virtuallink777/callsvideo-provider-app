// src/services/notifee.ts
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
} from "react-native-notify-kit";

import { Platform } from "react-native";
import { displayIncomingCall } from "./callkeep";

const CHANNEL_CALLS = "incoming_calls";
const CHANNEL_SERVICE = "service_keepalive";
const FOREGROUND_SERVICE_ID = "callsvideo_service";

/**
 * Crea los 2 canales de notificaciones:
 * 1. incoming_calls: para llamadas entrantes (suena + vibra + full-screen)
 * 2. service_keepalive: para el foreground service (silencioso)
 */
export const createNotificationChannels = async (): Promise<void> => {
  if (Platform.OS !== "android") return;

  // Canal de llamadas (ALERTA: suena + vibra + full-screen)
  await notifee.createChannel({
    id: CHANNEL_CALLS,
    name: "Llamadas Entrantes",
    importance: AndroidImportance.HIGH,
    sound: "ringtone",
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
    lights: true,
    lightColor: "#4f8ef7",
    bypassDnd: true,
  });

  // Canal del servicio (SILENCIOSO: solo mantiene la app viva)
  await notifee.createChannel({
    id: CHANNEL_SERVICE,
    name: "Servicio en Segundo Plano",
    importance: AndroidImportance.LOW,
    sound: undefined,
    vibration: false,
    lights: false,
  });

  console.log("📢 Canales de notificaciones creados");
};

/**
 * Inicia el foreground service para mantener la app viva en background.
 * Usa el canal SILENCIOSO para no interferir con las llamadas.
 */
export const startForegroundService = async (): Promise<void> => {
  if (Platform.OS !== "android") return;

  try {
    await notifee.displayNotification({
      id: FOREGROUND_SERVICE_ID,
      title: "CallsVideo Provider",
      body: "🟢 Esperando llamadas entrantes...",
      android: {
        channelId: CHANNEL_SERVICE,
        asForegroundService: true,
        ongoing: true,
      },
    });
    console.log("🔋 Foreground service iniciado");
  } catch (error) {
    console.error("❌ Error iniciando foreground service:", error);
  }
};

/**
 * Muestra la notificación de llamada entrante (full-screen + sonido + vibración).
 * NO usa ongoing: true porque las notificaciones ongoing son silenciosas.
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
      channelId: CHANNEL_CALLS,
      category: AndroidCategory.CALL,
      fullScreenAction: {
        id: "incoming_call_screen",
      },
      ongoing: false,
      autoCancel: true,
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
 * Muestra notificación de llamada con CallKeep + sonido + vibración.
 * CallKeep muestra la UI nativa, pero necesitamos asegurar que suene.
 */
export const displayCallWithSound = async (data: {
  callSessionId: string;
  clientEmail: string;
  typeCall: "video" | "audio";
}): Promise<void> => {
  // Primero mostrar CallKeep (UI nativa)
  await displayIncomingCall(data);

  // Después mostrar notificación con sonido (respaldo)
  await displayFullNotification(data);
};
