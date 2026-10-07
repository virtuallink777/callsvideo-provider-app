// src/services/deviceRegistration.ts
// Registra este celular en el backend para recibir llamadas por Firebase.
// El correo NO se envía: el servidor lo toma de la sesión (token de login).

import { PermissionsAndroid, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getMessaging,
  getToken,
  deleteToken,
} from "@react-native-firebase/messaging";
import * as Device from "expo-device";
import { BACKEND_URL } from "../config/backend";

export type RegisterResult = "ok" | "permission_denied" | "error";

const hasNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== "android") return true;
  // Antes de Android 13 el permiso se concede al instalar
  if (typeof Platform.Version !== "number" || Platform.Version < 33)
    return true;

  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) return true;
  const result = await PermissionsAndroid.request(permission);
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

export const registerDevice = async (
  authToken: string,
): Promise<RegisterResult> => {
  try {
    // Sin permiso de notificaciones no podemos mostrar la llamada:
    // mejor NO registrar, para que la web siga recibiendo las llamadas.
    if (!(await hasNotificationPermission())) {
      console.log(
        "⚠️ Permiso de notificaciones denegado: no se registra la APK",
      );
      return "permission_denied";
    }

    const fcmToken = await getToken(getMessaging());
    const label = [Device.manufacturer, Device.modelName]
      .filter(Boolean)
      .join(" ");

    const res = await fetch(`${BACKEND_URL}/api/devices/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ fcmToken, label }),
    });

    if (!res.ok) {
      console.log("❌ Registro de dispositivo rechazado:", res.status);
      return "error";
    }
    console.log("✅ Dispositivo registrado para recibir llamadas");
    return "ok";
  } catch (e) {
    console.log("❌ Error registrando dispositivo:", e);
    return "error";
  }
};

export const registerDeviceFromStorage = async (): Promise<RegisterResult> => {
  const token = await AsyncStorage.getItem("token");
  if (!token) return "error";
  return registerDevice(token);
};

// Al cerrar sesión: se da de baja y la web vuelve a recibir las llamadas.
export const unregisterDevice = async (): Promise<void> => {
  try {
    const authToken = await AsyncStorage.getItem("token");
    const fcmToken = await getToken(getMessaging());
    if (authToken) {
      await fetch(`${BACKEND_URL}/api/devices/unregister`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ fcmToken }),
      });
    }
    await deleteToken(getMessaging());
  } catch (e) {
    console.log("⚠️ No se pudo dar de baja el dispositivo:", e);
  }
};
