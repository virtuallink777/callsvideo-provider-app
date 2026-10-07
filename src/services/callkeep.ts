// src/services/callkeep.ts

import RNCallKeep from "react-native-callkeep";
import { Platform } from "react-native";
import { displayFullNotification } from "./notifee";

// Estado de la llamada actual
//
let currentCallUUID: string | null = null;

/** * Genera un UUID único para la llamada */

const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/** * Inicializa CallKeep con las opciones de Android e iOS. *
 * * Aunque actualmente usamos Android, la versión instalada de * react-native-callkeep exige que exista la propiedad "ios". */

export const initCallKeep = async (): Promise<boolean> => {
  if (Platform.OS !== "android") return false;
  const options = {
    ios: { appName: "CallsVideo" },
    android: {
      alertTitle: "Permisos de llamada requeridos",
      alertDescription:
        "Esta aplicación necesita permisos para mostrar llamadas entrantes",
      cancelButton: "Cancelar",
      okButton: "Permitir",
      foregroundService: {
        className: "CallsVideoCallService",
        heading: "CallsVideo Provider",
        description: "Esperando llamadas entrantes",
      },
      additionalPermissions: [],
    },
  };
  try {
    const initialized = await RNCallKeep.setup(options as any);
    console.log("📞 CallKeep inicializado:", initialized);
    return initialized;
  } catch (error) {
    console.error("❌ Error inicializando CallKeep:", error);
    return false;
  }
};
/** * Muestra una llamada entrante mediante la UI nativa de Android. */ export const displayIncomingCall =
  async (data: {
    callSessionId: string;
    clientEmail: string;
    typeCall: "video" | "audio";
  }): Promise<void> => {
    const uuid = generateUUID();
    currentCallUUID = uuid;
    console.log("📞 Mostrando llamada entrante:", {
      uuid,
      clientEmail: data.clientEmail,
      typeCall: data.typeCall,
    });
    try {
      RNCallKeep.displayIncomingCall(
        uuid,
        data.clientEmail,
        data.clientEmail,
        "email",
        data.typeCall === "video",
      );
      console.log("✅ Llamada mostrada con CallKeep");
    } catch (error) {
      console.error("❌ Error con CallKeep, usando Notifee:", error);
      await displayFullNotification({
        callSessionId: data.callSessionId,
        clientEmail: data.clientEmail,
        typeCall: data.typeCall,
      });
    }
  };
/** * Termina la llamada actual. */ export const endCall = async (
  callSessionId?: string,
): Promise<void> => {
  if (!currentCallUUID) {
    return;
  }
  const uuid = currentCallUUID;
  try {
    RNCallKeep.endCall(uuid);
    console.log("📴 Llamada terminada:", uuid);
  } catch (error) {
    console.error("❌ Error terminando llamada:", error);
  }
  currentCallUUID = null;
};
/** * Registra los listeners de CallKeep. * * IMPORTANTE: * La versión instalada de react-native-callkeep no expone * "rejectCall" como NativeEvent. * * En Android, una llamada rechazada desde la UI de CallKeep * llega mediante "endCall". */ export const setupCallKeepListeners =
  (handlers: {
    onAnswer: (callUUID: string) => void;
    onReject: (callUUID: string) => void;
    onEndCall: (callUUID: string) => void;
  }): (() => void) => {
    const onAnswerCall = ({ callUUID }: { callUUID: string }) => {
      console.log("🟢 Usuario contestó llamada:", callUUID);
      handlers.onAnswer(callUUID);
    };
    const onEndCall = ({ callUUID }: { callUUID: string }) => {
      console.log("📴 Usuario terminó/rechazó llamada:", callUUID);
      /* * Si tu lógica necesita distinguir entre: * * - rechazar una llamada entrante * - terminar una llamada ya contestada * * habrá que mantener estado adicional de la llamada. * * Por ahora notificamos ambos callbacks para que la capa * superior decida qué hacer. */ handlers.onEndCall(
        callUUID,
      );
    };
    RNCallKeep.addEventListener("answerCall", onAnswerCall);
    RNCallKeep.addEventListener("endCall", onEndCall);
    return () => {
      RNCallKeep.removeEventListener("answerCall");
      RNCallKeep.removeEventListener("endCall");
    };
  };
