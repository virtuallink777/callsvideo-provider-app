// src/screens/IncomingCallScreen.tsx

import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Socket } from "socket.io-client";
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  RTCView,
} from "react-native-webrtc";
import { stopRingtone } from "../services/ringtone";

interface IncomingCallScreenProps {
  callData: any;
  providerEmail: string;
  backendUrl: string;
  onClose: () => void;
  navigation: any;
  socket: Socket | null;
  ratePerMinute: number;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

export default function IncomingCallScreen({
  callData,
  providerEmail,
  backendUrl,
  onClose,
  navigation, // 👈 VUELVE A RECIBIRLO
  socket,
  ratePerMinute,
}: IncomingCallScreenProps) {
  // ─── Timer sincronizado con backend ───
  const [isGrace, setIsGrace] = useState(true);
  const [graceSeconds, setGraceSeconds] = useState(10);
  const [billingMinutes, setBillingMinutes] = useState(0);
  const [billingSeconds, setBillingSeconds] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const gracePhaseRef = useRef(true);

  // ─── WebRTC ───
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<any>(null);

  // ─── GUARDIAS ANTI-CONGELAMIENTO ───
  const endedRef = useRef(false); // la llamada ya terminó (bloquea re-entradas)
  const mediaStoppedRef = useRef(false); // los tracks ya se detuvieron

  // ─── Intercambio de cámaras ───
  const [swapCameras, setSwapCameras] = useState(false);

  // ─── Tarifa ───
  const [rate, setRate] = useState<number>(
    ratePerMinute || callData?.ratePerMinute || 0,
  );

  useEffect(() => {
    if (!socket || rate > 0) return;

    const handleRate = (data: any) => {
      const r =
        callData?.typeCall === "video" ? data.rate_video : data.rate_audio;
      if (r > 0) {
        setRate(r);
        console.log("💵 Tarifa cargada desde backend:", r);
      }
    };

    socket.on("provider_rate", handleRate);
    socket.emit("get_provider_rate", { providerEmail });

    return () => {
      socket.off("provider_rate", handleRate);
    };
  }, [socket, rate]);

  // ─────────────────────────────────────────────
  // DETENER MEDIA (solo refs → seguro incluso desmontado)
  // ─────────────────────────────────────────────
  const stopMedia = () => {
    if (mediaStoppedRef.current) return;
    mediaStoppedRef.current = true;
    try {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t: any) => t.stop());
        localStreamRef.current = null;
      }
    } catch (e) {
      console.log("⚠️ Error deteniendo media:", e);
    }
  };

  // 🚪 Salir del Stack de navegación (blindado)
  const closeScreen = () => {
    try {
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
      } else if (navigation?.navigate) {
        navigation.navigate("Home"); // 👈 si no hay atrás, ve al home
      }
    } catch (e) {
      console.log("⚠️ No se pudo cerrar pantalla:", e);
    }
  };

  // ─────────────────────────────────────────────
  // SALIDA ÚNICA DE LA LLAMADA (blindada)
  // ─────────────────────────────────────────────
  const endCall = () => {
    if (endedRef.current) return; // 👈 bloquea el call_ended duplicado
    endedRef.current = true;

    console.log("📴 endCall: cerrando pantalla");
    stopRingtone();
    onClose(); // 1️⃣ desmonta la pantalla (RTCView desaparecen)
    closeScreen(); // 👈 SALE DEL STACK (la pantalla se desmonta)
    setTimeout(stopMedia, 600); // 2️⃣ limpia media cuando el video ya no existe
  };

  // ─────────────────────────────────────────────
  // INICIALIZAR WEBRTC
  // ─────────────────────────────────────────────
  const callSessionId = callData?.callSessionId;

  useEffect(() => {
    if (!socket || !callSessionId) return;

    let cancelled = false;
    mediaStoppedRef.current = false; // ← resetear la guarda
    const pendingCandidates: any[] = [];

    const initWebRTC = async () => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      pc.ontrack = (event: any) => {
        if (event.streams && event.streams[0])
          setRemoteStream(event.streams[0]);
      };
      pc.onicecandidate = (event: any) => {
        if (event.candidate) {
          socket.emit("webrtc_ice_candidate", {
            callSessionId,
            candidate: event.candidate,
          });
        }
      };

      try {
        const stream = await mediaDevices.getUserMedia({
          video: callData.typeCall === "video",
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t: any) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));
      } catch (e) {
        console.log("⚠️ Error obteniendo cámara:", e);
        if (cancelled) return;
        try {
          const audioStream = await mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          if (cancelled) {
            audioStream.getTracks().forEach((t: any) => t.stop());
            return;
          }
          localStreamRef.current = audioStream;
          audioStream
            .getTracks()
            .forEach((t: any) => pc.addTrack(t, audioStream));
        } catch (audioErr) {
          console.log("❌ Sin audio tampoco:", audioErr);
        }
      }

      if (cancelled) return;
      socket.emit("provider_ready", {
        callSessionId,
        clientEmail: callData.clientEmail,
      });
    };

    initWebRTC();

    const handleOffer = async (data: { sdp: any }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      for (const c of pendingCandidates.splice(0)) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch {}
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc_answer", { callSessionId, sdp: answer });
    };

    const handleIce = async (data: { candidate: any }) => {
      const pc = pcRef.current;
      if (!pc) return;
      if (!pc.remoteDescription) {
        pendingCandidates.push(data.candidate); // llegó antes que la oferta
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.log("Error ICE:", e);
      }
    };

    socket.on("webrtc_offer", handleOffer);
    socket.on("webrtc_ice_candidate", handleIce);

    return () => {
      cancelled = true;
      socket.off("webrtc_offer", handleOffer);
      socket.off("webrtc_ice_candidate", handleIce);
      stopMedia();
    };
  }, [socket, callSessionId]);

  // ─────────────────────────────────────────────
  // TIMER via call_tick
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) {
      console.log("⚠️ No hay socket");
      return;
    }

    const handleTick = (data: any) => {
      if (data.phase === "grace") {
        setIsGrace(true);
        setGraceSeconds(data.graceSeconds);
      } else {
        if (gracePhaseRef.current) {
          gracePhaseRef.current = false;
          setTotalEarned(rate);
        }
        setIsGrace(false);
        setBillingMinutes(data.billingMinutes);
        setBillingSeconds(data.billingSeconds);

        if (data.billingSeconds === 0 && data.billingMinutes > 0) {
          setTotalEarned((prev) => prev + rate);
        }
      }
    };

    socket.on("call_tick", handleTick);
    return () => {
      socket.off("call_tick", handleTick);
    };
  }, [socket, rate]);

  // ─────────────────────────────────────────────
  // call_ended (blindado contra duplicados)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleCallEnded = () => {
      console.log("📴 call_ended recibido");
      endCall();
    };

    socket.on("call_ended", handleCallEnded);
    return () => {
      socket.off("call_ended", handleCallEnded);
    };
  }, [socket]);

  // ─────────────────────────────────────────────
  // COLGAR MANUALMENTE
  // ─────────────────────────────────────────────
  const handleHangUp = async () => {
    if (endedRef.current) return;

    if (socket) {
      socket.emit("terminate_call", {
        callSessionId: callData?.callSessionId,
        reason: "provider_hung_up",
      });
    }

    try {
      await fetch(`${backendUrl}/api/calls/terminate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callSessionId: callData?.callSessionId,
          reason: "provider_hung_up",
        }),
      });
    } catch (e) {
      console.log("Error terminando:", e);
    }

    endCall();
  };

  const formatTime = (min: number, sec: number) =>
    `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;

  const isVideo = callData?.typeCall === "video";
  const bigStream = swapCameras ? localStream : remoteStream;
  const smallStream = swapCameras ? remoteStream : localStream;

  return (
    <View style={styles.container}>
      {/* VIDEO */}
      {isVideo ? (
        <View style={styles.videoContainer}>
          {bigStream ? (
            <RTCView
              streamURL={bigStream.toURL()}
              style={styles.remoteVideo}
              objectFit="cover"
              zOrder={0}
            />
          ) : (
            <View style={styles.waitingVideo}>
              <Text style={styles.waitingText}>👤</Text>
              <Text style={styles.waitingLabel}>
                {swapCameras
                  ? "Esperando tu cámara..."
                  : "Esperando cámara del cliente..."}
              </Text>
            </View>
          )}

          {smallStream && (
            <View style={styles.localVideoContainer}>
              <RTCView
                streamURL={smallStream.toURL()}
                style={styles.localVideo}
                objectFit="cover"
                mirror={!swapCameras}
                zOrder={1}
              />
              {bigStream && (
                <TouchableOpacity
                  style={styles.swapButton}
                  onPress={() => setSwapCameras(!swapCameras)}
                >
                  <Text style={styles.swapButtonText}>🔄</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.audioContainer}>
          <Text style={styles.audioIcon}>📞</Text>
          <Text style={styles.audioLabel}>Llamada de voz en vivo</Text>
          <Text style={styles.audioClient}>{callData?.clientEmail}</Text>
        </View>
      )}

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>CONEXIÓN ACTIVA</Text>
          <Text style={styles.headerClient}>{callData?.clientEmail}</Text>
        </View>

        {isGrace ? (
          <View style={styles.graceBox}>
            <Text style={styles.graceLabel}>Gracia</Text>
            <Text style={styles.graceTime}>{graceSeconds}s</Text>
          </View>
        ) : (
          <View style={styles.billingBox}>
            <Text style={styles.billingLabel}>Tiempo</Text>
            <Text style={styles.billingTime}>
              {formatTime(billingMinutes, billingSeconds)}
            </Text>
          </View>
        )}
      </View>

      {/* FOOTER */}
      <View style={styles.footer}>
        <View style={styles.earningsBox}>
          <Text style={styles.earningsLabel}>Ganancia acumulada</Text>
          <Text style={styles.earningsValue}>
            +${totalEarned.toFixed(2)} USD
          </Text>
        </View>
        <TouchableOpacity style={styles.hangupBtn} onPress={handleHangUp}>
          <Text style={styles.hangupText}>🔴 Finalizar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },

  debugBox: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255, 255, 0, 0.9)",
    padding: 8,
    paddingTop: 40,
    zIndex: 9999,
    alignItems: "center",
  },
  debugText: {
    color: "#000",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "monospace",
  },

  videoContainer: { flex: 1 },
  remoteVideo: { width: "100%", height: "100%", backgroundColor: "#000" },

  localVideoContainer: {
    position: "absolute",
    bottom: 100,
    right: 16,
    width: 100,
    height: 140,
    zIndex: 999,
  },
  localVideo: {
    width: 100,
    height: 140,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "#1e293b",
  },

  swapButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  swapButtonText: { fontSize: 18, color: "#fff" },

  waitingVideo: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
  },
  waitingText: { fontSize: 64, marginBottom: 12 },
  waitingLabel: { color: "#64748b", fontSize: 14, fontWeight: "600" },

  audioContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
  },
  audioIcon: { fontSize: 80, marginBottom: 16 },
  audioLabel: {
    color: "#22c55e",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  audioClient: { color: "#94a3b8", fontSize: 14 },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 20,
  },
  headerLabel: {
    color: "#22c55e",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  headerClient: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },

  graceBox: {
    alignItems: "center",
    backgroundColor: "rgba(245,158,11,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  graceLabel: {
    color: "#f59e0b",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  graceTime: { color: "#f59e0b", fontSize: 24, fontWeight: "800" },

  billingBox: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  billingLabel: {
    color: "#22c55e",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  billingTime: { color: "#ffffff", fontSize: 24, fontWeight: "800" },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
  },
  hangupBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: "center",
  },
  hangupText: { color: "#ffffff", fontSize: 16, fontWeight: "800" },

  earningsBox: { alignItems: "center", marginBottom: 16 },
  earningsLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  earningsValue: { color: "#22c55e", fontSize: 28, fontWeight: "800" },
});
