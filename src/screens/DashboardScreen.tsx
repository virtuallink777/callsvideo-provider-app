// src/screens/DashboardScreen.tsx

import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Vibration,
} from "react-native";
import { Socket } from "socket.io-client";
import { stopRingtone } from "../services/ringtone";
import { mediaDevices } from "react-native-webrtc";
import CallSetupPanel from "../components/CallSetupPanel";

interface DashboardScreenProps {
  providerEmail: string;
  onLogout: () => void;
  incomingCall: any;
  onClearIncomingCall: () => void;
  backendUrl: string;
  navigation: any;
  socket: Socket | null; // ✅ Socket global desde App.tsx
}

export default function DashboardScreen({
  providerEmail,
  onLogout,
  incomingCall,
  onClearIncomingCall,
  backendUrl,
  navigation,
  socket,
}: DashboardScreenProps) {
  const [profileData, setProfileData] = useState<any>(null);
  const [answered, setAnswered] = useState(false);
  const callId = incomingCall?.callSessionId ?? null;

  // Reiniciar cuando la llamada termina
  useEffect(() => {
    if (!incomingCall) setAnswered(false);
  }, [incomingCall]);

  // Vibrar solo mientras la llamada suena y no se ha contestado
  useEffect(() => {
    if (callId && !answered) {
      Vibration.vibrate([500, 200, 500, 200, 500, 200, 500], true);
    } else {
      Vibration.cancel();
    }
    return () => Vibration.cancel();
  }, [callId, answered]);

  // ═══════════════════════════════════════════════════════════
  // 🔐 PRE-CARGA DE PERMISOS (cámara + micrófono)
  // Al pedirlos al montar el dashboard, las llamadas siguientes
  // no pierden tiempo en prompts y el stream se obtiene al instante.
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const requestMediaPermissions = async () => {
      try {
        // Cámara
        const cam = await mediaDevices.getUserMedia({ video: true });
        cam.getTracks().forEach((t) => t.stop()); // libera la cámara inmediatamente
        console.log("📸 Permiso de cámara concedido");
      } catch (e) {
        console.warn("⚠️ Permiso de cámara denegado:", e);
      }
      try {
        // Micrófono
        const mic = await mediaDevices.getUserMedia({ audio: true });
        mic.getTracks().forEach((t) => t.stop()); // libera el mic inmediatamente
        console.log("🎤 Permiso de micrófono concedido");
      } catch (e) {
        console.warn("⚠️ Permiso de micrófono denegado:", e);
      }
    };
    requestMediaPermissions();
  }, []); // solo al montar

  // Cargar perfil
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(
          `${backendUrl}/api/profile/get-profile/${providerEmail}`,
        );
        const data = await res.json();
        setProfileData(data);
      } catch (e) {
        console.log("Error cargando perfil:", e);
      }
    };
    fetchProfile();
  }, [providerEmail]);

  const handleAcceptCall = () => {
    stopRingtone(); // 👈 también aquí
    Vibration.cancel();
    if (!socket) {
      Alert.alert("Error", "Sin conexión al servidor.");
      return;
    }
    // ✅ Emitir por socket global
    socket.emit("accept_call", {
      clientEmail: incomingCall.clientEmail,
      providerEmail,
      callSessionId: incomingCall.callSessionId,
      typeCall: incomingCall.typeCall,
    });
    console.log("✅ accept_call emitido");
    setAnswered(true);
    navigation.navigate("IncomingCall");
  };

  const handleRejectCall = () => {
    stopRingtone(); // 👈 AGREGA
    Vibration.cancel();
    if (socket) {
      socket.emit("reject_call", {
        clientEmail: incomingCall.clientEmail,
        callSessionId: incomingCall.callSessionId,
      });
    }
    onClearIncomingCall();
  };

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: onLogout },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola 👋</Text>
          <Text style={styles.email}>{providerEmail}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, styles.online]} />
          <Text style={styles.statusText}>Disponible para llamadas</Text>
        </View>
        <Text style={styles.statusSub}>Los clientes pueden llamarte ahora</Text>
      </View>
      <CallSetupPanel />

      {profileData && (
        <View style={styles.ratesCard}>
          <Text style={styles.ratesTitle}>Tus tarifas</Text>
          <View style={styles.ratesRow}>
            <View style={styles.rateItem}>
              <Text style={styles.rateIcon}>🎥</Text>
              <Text style={styles.rateValue}>${profileData.rate_video}</Text>
              <Text style={styles.rateLabel}>USD/min video</Text>
            </View>
            <View style={styles.rateDivider} />
            <View style={styles.rateItem}>
              <Text style={styles.rateIcon}>📞</Text>
              <Text style={styles.rateValue}>${profileData.rate_audio}</Text>
              <Text style={styles.rateLabel}>USD/min audio</Text>
            </View>
          </View>
        </View>
      )}

      <Text style={styles.hint}>
        Mantén la app abierta para recibir llamadas.{"\n"}
        Las notificaciones te avisarán cuando alguien te llame.
      </Text>

      {/* MODAL DE LLAMADA ENTRANTE */}
      <Modal
        visible={!!incomingCall && !answered}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>
              {incomingCall?.typeCall === "video" ? "🎥" : "📞"}
            </Text>
            <Text style={styles.modalTitle}>¡Llamada Entrante!</Text>
            <Text style={styles.modalType}>
              {incomingCall?.typeCall === "video"
                ? "Videollamada"
                : "Llamada de voz"}
            </Text>
            <Text style={styles.modalClient}>{incomingCall?.clientEmail}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={handleRejectCall}
              >
                <Text style={styles.rejectText}>🔴 Rechazar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.answerBtn}
                onPress={handleAcceptCall}
              >
                <Text style={styles.answerText}>🟢 Contestar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    padding: 24,
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  greeting: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  email: { color: "#ffffff", fontSize: 16, fontWeight: "800", marginTop: 2 },
  logoutBtn: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: { color: "#94a3b8", fontWeight: "700", fontSize: 13 },
  statusCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  online: { backgroundColor: "#22c55e" },
  statusText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  statusSub: { color: "#64748b", fontSize: 13, lineHeight: 18 },
  ratesCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  ratesTitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  ratesRow: { flexDirection: "row", alignItems: "center" },
  rateItem: { flex: 1, alignItems: "center", gap: 4 },
  rateIcon: { fontSize: 24 },
  rateValue: { color: "#4f8ef7", fontSize: 24, fontWeight: "800" },
  rateLabel: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  rateDivider: { width: 1, height: 60, backgroundColor: "#1e293b" },
  hint: {
    color: "#475569",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 16,
  },
  modalIcon: { fontSize: 56, marginBottom: 12 },
  modalTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  modalType: {
    color: "#4f8ef7",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  modalClient: { color: "#94a3b8", fontSize: 14, marginBottom: 32 },
  modalButtons: { flexDirection: "row", gap: 12, width: "100%" },
  rejectBtn: {
    flex: 1,
    backgroundColor: "#1e293b",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  rejectText: { color: "#ef4444", fontWeight: "800", fontSize: 15 },
  answerBtn: {
    flex: 1,
    backgroundColor: "#22c55e",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  answerText: { color: "#ffffff", fontWeight: "800", fontSize: 15 },
});
