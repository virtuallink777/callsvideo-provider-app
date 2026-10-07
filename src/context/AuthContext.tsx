// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  registerFCMToken,
  listenTokenRefresh,
} from "../services/firebaseMessaging";

interface AuthContextType {
  isLoggedIn: boolean;
  isLoading: boolean;
  providerEmail: string | null;
  login: (email: string, token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [providerEmail, setProviderEmail] = useState<string | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const email = await AsyncStorage.getItem("userEmail");
        if (token && email) {
          setProviderEmail(email);
          setIsLoggedIn(true);
          // Registrar token FCM al restaurar sesión
          await registerFCMToken(email);
        }
      } catch (e) {
        console.log("Error cargando sesión:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (email: string, token: string) => {
    try {
      await AsyncStorage.setItem("token", token);
      await AsyncStorage.setItem("userEmail", email);
      setProviderEmail(email);
      setIsLoggedIn(true);
      // Registrar token FCM al iniciar sesión
      await registerFCMToken(email);
      // Escuchar refrescos de token
      listenTokenRefresh(email);
    } catch (e) {
      console.error("Error guardando sesión:", e);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("userEmail");
      setProviderEmail(null);
      setIsLoggedIn(false);
    } catch (e) {
      console.error("Error cerrando sesión:", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, isLoading, providerEmail, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
};
