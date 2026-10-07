// App.tsx
import React, { useEffect, useState, useRef } from "react";
import { Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { io, Socket } from "socket.io-client";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { BACKEND_URL } from "./src/config/backend";
import {
  requestNotificationPermission,
  setupForegroundMessageHandler,
} from "./src/services/firebaseMessaging";
import {
  initCallKeep,
  endCall,
  setupCallKeepListeners,
} from "./src/services/callkeep";
import {
  createNotificationChannel,
  startForegroundService,
} from "./src/services/notifee";

import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import IncomingCallScreen from "./src/screens/IncomingCallScreen";

const Stack = createNativeStackNavigator();

// ═══════════════════════════════════════════════════════════════════════
// App interior — maneja auth, socket y navegación
// ═══════════════════════════════════════════════════════════════════════
function AppContent() {
  const { isLoggedIn, isLoading, providerEmail, logout } = useAuth();
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const socketRef = useRef<Socket | null>(null);

  // ─────────────────────────────────────────────────────────────────
  // INIT: permisos + canal + callkeep (una sola vez al arrancar)
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. Pedir permiso de notificaciones (Android 13+)
        await requestNotificationPermission();

        // 2. Crear canal de notificaciones
        await createNotificationChannel();

        // 3. Iniciar Callkeep (UI nativa de llamada)
        if (Platform.OS === "android") {
          await initCallKeep();
        }

        console.log("✅ App inicializada correctamente");
      } catch (error) {
        console.error("❌ Error inicializando app:", error);
      }
    };

    initializeApp();
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // SOCKET.IO: conectar cuando el provider está logueado
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn || !providerEmail) {
      // Desconectar si se cerró sesión
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    console.log("🔌 Conectando socket para:", providerEmail);

    const socket = io(BACKEND_URL, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket conectado:", socket.id);
      socket.emit("register_user", providerEmail);
    });

    socket.on("reconnect", () => {
      console.log("🔄 Socket reconectado");
      socket.emit("register_user", providerEmail);
    });

    // Llamada entrante vía socket (cuando la app está abierta)
    socket.on("incoming_call", (data: any) => {
      console.log("📞 Llamada entrante (socket):", data);
      setIncomingCall(data);
    });

    // Llamada terminada
    socket.on("call_ended", () => {
      console.log("📴 Llamada terminada");
      setIncomingCall(null);
      endCall();
    });

    socket.on("call_rejected", () => {
      setIncomingCall(null);
      endCall();
    });

    socket.on("call_answered_elsewhere", () => {
      console.log("📞 Llamada contestada en otro dispositivo");
      setIncomingCall(null);
      endCall();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isLoggedIn, providerEmail]);

  // ─────────────────────────────────────────────────────────────────
  // FOREGROUND: manejar mensajes FCM cuando la app está abierta
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = setupForegroundMessageHandler((data) => {
      console.log("📨 FCM en foreground:", data);

      if (data.type === "incoming_call") {
        setIncomingCall({
          callSessionId: data.callSessionId,
          clientEmail: data.clientEmail,
          typeCall: data.typeCall,
        });
      }

      if (data.type === "cancel_call") {
        setIncomingCall(null);
        endCall(data.callSessionId as string);
      }
    });

    return unsubscribe;
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // CALLKEEP LISTENERS: qué hacer cuando el usuario contesta/rechaza
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = setupCallKeepListeners({
      onAnswer: async (callUUID) => {
        console.log("🟢 Usuario contestó desde UI nativa:", callUUID);
        // Aquí deberíamos emitir accept_call al socket
        // pero necesitamos el callSessionId, que viene del foreground message
        // Esto lo completaremos cuando integremos IncomingCallScreen
      },
      onReject: async (callUUID) => {
        console.log("🔴 Usuario rechazó desde UI nativa:", callUUID);
        setIncomingCall(null);
        if (incomingCall && socketRef.current) {
          socketRef.current.emit("reject_call", {
            clientEmail: incomingCall.clientEmail,
            callSessionId: incomingCall.callSessionId,
          });
        }
      },
      onEndCall: (callUUID) => {
        console.log("📴 Llamada terminada:", callUUID);
        setIncomingCall(null);
      },
    });

    return unsubscribe;
  }, [incomingCall]);

  // ─────────────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    if (socketRef.current) {
      socketRef.current.emit("logout", providerEmail);
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    await logout();
    setIncomingCall(null);
  };

  if (isLoading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Dashboard">
              {(props) => (
                <DashboardScreen
                  {...props}
                  providerEmail={providerEmail!}
                  onLogout={handleLogout}
                  incomingCall={incomingCall}
                  onClearIncomingCall={() => setIncomingCall(null)}
                  backendUrl={BACKEND_URL}
                  socket={socketRef.current}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="IncomingCall">
              {(props) => (
                <IncomingCallScreen
                  {...props}
                  callData={incomingCall}
                  providerEmail={providerEmail!}
                  backendUrl={BACKEND_URL}
                  socket={socketRef.current}
                  onClose={() => {
                    setIncomingCall(null);
                    endCall();
                  }}
                  ratePerMinute={incomingCall?.ratePerMinute ?? 0}
                />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// App principal envuelto en AuthProvider
// ═══════════════════════════════════════════════════════════════════════
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
