// src/services/firebaseMessaging.ts

import {
  getMessaging,
  requestPermission,
  getToken,
  onTokenRefresh,
  onMessage,
  deleteToken,
  setBackgroundMessageHandler,
  AuthorizationStatus,
} from "@react-native-firebase/messaging";

import { Platform } from "react-native";
import { BACKEND_URL } from "../config/backend";

import { displayCallWithSound } from "./notifee";
import { startForegroundService } from "./notifee";
import { endCall } from "./callkeep"; // ← AGREGAR ESTE IMPORT

type FCMData = {
  [key: string]: string | object | undefined;
};

type FCMMessage = {
  data?: FCMData;
};

/**
 * Instancia de Firebase Messaging.
 */
const messaging = getMessaging();

/**
 * Pide permiso de notificaciones.
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    const authStatus = await requestPermission(messaging);

    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    console.log("🔔 Permiso de notificaciones:", enabled);

    return enabled;
  } catch (error) {
    console.error("❌ Error solicitando permiso de notificaciones:", error);

    return false;
  }
};

/**
 * Registra un token FCM específico en nuestro backend.
 */
const registerTokenInBackend = async (
  providerEmail: string,
  token: string,
): Promise<void> => {
  try {
    console.log("📲 Registrando token FCM:", token.substring(0, 30) + "...");

    const response = await fetch(`${BACKEND_URL}/api/push/subscribe-fcm`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        providerEmail,
        fcmToken: token,
        deviceInfo: `${Platform.OS} ${Platform.Version}`,
      }),
    });

    if (response.ok) {
      console.log("✅ Token FCM registrado en backend");
    } else {
      console.error("❌ Error registrando token FCM:", response.status);
    }
  } catch (error) {
    console.error("❌ Error registrando token FCM en backend:", error);
  }
};

/**
 * Obtiene el token FCM actual y lo registra.
 */
export const registerFCMToken = async (
  providerEmail: string,
): Promise<void> => {
  try {
    try {
      await deleteToken(messaging);
      console.log("🗑️ Token FCM viejo eliminado");
    } catch (e) {
      console.log("ℹ️ No había token viejo para eliminar");
    }

    const token = await getToken(messaging);

    if (!token) {
      console.error("❌ Firebase no devolvió un token FCM");
      return;
    }

    console.log("🔑 Nuevo token FCM generado:", token.substring(0, 30) + "...");
    await registerTokenInBackend(providerEmail, token);
  } catch (error) {
    console.error("❌ Error obteniendo token FCM:", error);
  }
};

/**
 * Escucha cuando Firebase genera un nuevo token.
 */
export const listenTokenRefresh = (providerEmail: string): (() => void) => {
  const unsubscribe = onTokenRefresh(messaging, async (newToken: string) => {
    console.log("🔄 Token FCM refrescado, re-registrando...");

    await registerTokenInBackend(providerEmail, newToken);
  });

  return unsubscribe;
};

/**
 * Maneja mensajes FCM cuando la aplicación está en PRIMER PLANO.
 */
export const setupForegroundMessageHandler = (
  onIncomingCall: (data: Record<string, string>) => void,
): (() => void) => {
  const unsubscribe = onMessage(
    messaging,
    async (remoteMessage: FCMMessage) => {
      console.log("📨 Mensaje FCM en primer plano:", remoteMessage.data);

      const data = remoteMessage.data;

      if (!data) {
        return;
      }

      if (data.type === "incoming_call") {
        const callData: Record<string, string> = {};

        Object.entries(data).forEach(([key, value]) => {
          if (typeof value === "string") {
            callData[key] = value;
          }
        });

        onIncomingCall(callData);
      }
    },
  );

  return unsubscribe;
};

/**
 * Handler de mensajes FCM en BACKGROUND.
 */
export const setupBackgroundMessageHandler = (): void => {
  setBackgroundMessageHandler(messaging, async (remoteMessage: FCMMessage) => {
    console.log("🌙 Mensaje FCM en BACKGROUND:", remoteMessage.data);

    const data = remoteMessage.data;

    if (!data) {
      return;
    }

    if (data.type === "incoming_call") {
      console.log("📞 Llamada entrante recibida en background");

      // ✅ CORRECCIÓN: validar tipos antes de pasar a displayCallWithSound
      const callSessionId =
        typeof data.callSessionId === "string" ? data.callSessionId : "";
      const clientEmail =
        typeof data.clientEmail === "string" ? data.clientEmail : "";
      const typeCall = data.typeCall === "audio" ? "audio" : "video";

      await displayCallWithSound({
        callSessionId,
        clientEmail,
        typeCall,
      });

      await startForegroundService();

      return;
    }

    if (data.type === "cancel_call") {
      console.log("📴 Cancelando llamada:", data.callSessionId);

      await endCall(
        typeof data.callSessionId === "string" ? data.callSessionId : undefined,
      );

      return;
    }
  });
};
