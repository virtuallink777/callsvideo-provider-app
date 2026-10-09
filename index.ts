import { registerRootComponent } from "expo";
import { setupBackgroundMessageHandler } from "./src/services/firebaseMessaging";
import App from "./App";

// ✅ CRÍTICO: registrar handler de FCM en background ANTES de montar la app
// Esto permite que el celular reciba llamadas con pantalla apagada
setupBackgroundMessageHandler();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
