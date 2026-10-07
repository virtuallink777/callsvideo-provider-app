// src/components/CallSetupPanel.tsx
// Muestra si el celular está listo para recibir llamadas con la pantalla apagada
// y ayuda a activar lo que falte.

import { useCallback, useEffect, useState } from "react";
import {
  AppState,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import notifee, {
  AndroidNotificationSetting,
  AuthorizationStatus,
} from "react-native-notify-kit";
import { registerDeviceFromStorage } from "../services/deviceRegistration";

interface Status {
  notifications: boolean;
  fullScreen: boolean;
  batteryFree: boolean;
}

export default function CallSetupPanel() {
  const [status, setStatus] = useState<Status | null>(null);

  const refresh = useCallback(async () => {
    try {
      const settings = await notifee.getNotificationSettings();
      const optimized = await notifee.isBatteryOptimizationEnabled();
      setStatus({
        notifications:
          settings.authorizationStatus === AuthorizationStatus.AUTHORIZED,
        fullScreen:
          settings.android.fullScreenIntent !==
          AndroidNotificationSetting.DISABLED,
        batteryFree: !optimized,
      });
    } catch (e) {
      console.log("⚠️ No se pudo leer el estado de permisos:", e);
    }
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (!status) return null;

  const allOk = status.notifications && status.fullScreen && status.batteryFree;

  const askNotifications = async () => {
    await notifee.requestPermission();
    await registerDeviceFromStorage();
    refresh();
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {allOk ? "✅ Listo para recibir llamadas" : "⚠️ Falta configurar"}
      </Text>

      <Row ok={status.notifications} label="Notificaciones" />
      <Row ok={status.fullScreen} label="Pantalla completa sobre el bloqueo" />
      <Row ok={status.batteryFree} label="Sin restricciones de batería" />

      {!status.notifications && (
        <Btn text="Permitir notificaciones" onPress={askNotifications} />
      )}
      {!status.fullScreen && (
        <Btn
          text="Abrir ajustes de la app (activa pantalla completa)"
          onPress={() => Linking.openSettings()}
        />
      )}
      {!status.batteryFree && (
        <Btn
          text="Quitar restricciones de batería"
          onPress={() => notifee.openBatteryOptimizationSettings()}
        />
      )}
      <Btn
        text="Inicio automático / segundo plano (según tu marca)"
        onPress={() => notifee.openPowerManagerSettings()}
      />
    </View>
  );
}

const Row = ({ ok, label }: { ok: boolean; label: string }) => (
  <Text style={[styles.row, ok ? styles.ok : styles.bad]}>
    {ok ? "✔" : "✖"} {label}
  </Text>
);

const Btn = ({ text, onPress }: { text: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.btn} onPress={onPress}>
    <Text style={styles.btnText}>{text}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 6,
  },
  title: { color: "#ffffff", fontSize: 15, fontWeight: "800", marginBottom: 6 },
  row: { fontSize: 13, fontWeight: "600" },
  ok: { color: "#22c55e" },
  bad: { color: "#f59e0b" },
  btn: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  btnText: { color: "#4f8ef7", fontSize: 13, fontWeight: "700" },
});
