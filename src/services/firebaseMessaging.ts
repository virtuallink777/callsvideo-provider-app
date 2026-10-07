// src/services/firebaseMessaging.ts

import {
  getMessaging,
  requestPermission,
  getToken,
  onTokenRefresh,
  onMessage,
  setBackgroundMessageHandler,
  AuthorizationStatus,
} from "@react-native-firebase/messaging";

import { Platform } from "react-native";
import { BACKEND_URL } from "../config/backend";

import { displayIncomingCall, endCall } from "./callkeep";

import { startForegroundService } from "./notifee";

type FCMData = {
  [key: string]: string | object | undefined;
};

type FCMMessage = {
  data?: FCMData;
};

/**
 * Instancia de Firebase Messaging.
 *
 * En @react-native-firebase/messaging 26.x
 * se utiliza la API modular.
 */
const messaging = getMessaging();

/**
 * Pide permiso de notificaciones.
 *
 * Android 13+ requiere permiso POST_NOTIFICATIONS.
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
 *
 * Esta función recibe directamente el token para evitar
 * llamar getToken() nuevamente cuando Firebase lo refresca.
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
 *
 * Se llama normalmente después del login del provider.
 */
export const registerFCMToken = async (
  providerEmail: string,
): Promise<void> => {
  try {
    const token = await getToken(messaging);

    if (!token) {
      console.error("❌ Firebase no devolvió un token FCM");

      return;
    }

    await registerTokenInBackend(providerEmail, token);
  } catch (error) {
    console.error("❌ Error obteniendo token FCM:", error);
  }
};

/**
 * Escucha cuando Firebase genera un nuevo token.
 *
 * Esto puede ocurrir, por ejemplo, cuando Firebase
 * rota el token del dispositivo.
 */
export const listenTokenRefresh = (providerEmail: string): (() => void) => {
  const unsubscribe = onTokenRefresh(messaging, async (newToken: string) => {
    console.log("🔄 Token FCM refrescado, re-registrando...");

    await registerTokenInBackend(providerEmail, newToken);
  });

  return unsubscribe;
};

/**
 * Maneja mensajes FCM cuando la aplicación está
 * en PRIMER PLANO.
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
        /*
         * Firebase define data como:
         *
         * { [key: string]: string | object }
         *
         * Para nuestro protocolo CALLVIDEO sabemos que
         * los datos que vienen del backend son strings.
         */
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
 *
 * Se ejecuta cuando la aplicación está en segundo plano
 * o terminada, siempre que el mensaje FCM sea apropiado
 * para procesamiento en background.
 *
 * ESTE ES EL CAMINO CRÍTICO PARA LAS LLAMADAS CUANDO
 * EL TELÉFONO ESTÁ DORMIDO.
 */
export const setupBackgroundMessageHandler = (): void => {
  setBackgroundMessageHandler(messaging, async (remoteMessage: FCMMessage) => {
    console.log("🌙 Mensaje FCM en BACKGROUND:", remoteMessage.data);

    const data = remoteMessage.data;

    if (!data) {
      return;
    }

    /**
     * ============================================
     * LLAMADA ENTRANTE
     * ============================================
     */
    if (data.type === "incoming_call") {
      console.log("📞 Llamada entrante recibida en background");

      /*
       * Primero iniciamos el foreground service.
       */
      await startForegroundService();

      /*
       * Después mostramos la UI nativa de llamada.
       */
      await displayIncomingCall({
        callSessionId:
          typeof data.callSessionId === "string" ? data.callSessionId : "",

        clientEmail:
          typeof data.clientEmail === "string" ? data.clientEmail : "",

        typeCall: data.typeCall === "audio" ? "audio" : "video",
      });

      return;
    }

    /**
     * ============================================
     * CANCELAR LLAMADA
     * ============================================
     *
     * Ejemplo:
     *
     * El cliente contestó desde otro dispositivo.
     *
     * El backend envía:
     *
     * type = cancel_call
     */
    if (data.type === "cancel_call") {
      console.log("📴 Cancelando llamada:", data.callSessionId);

      await endCall(
        typeof data.callSessionId === "string" ? data.callSessionId : undefined,
      );

      return;
    }
  });
};
