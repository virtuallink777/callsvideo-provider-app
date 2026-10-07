import { Audio } from "expo-av";

let sound: Audio.Sound | null = null;
let starting = false;
let wantRing = false;

export async function startRingtone() {
  wantRing = true;
  if (sound || starting) return;
  starting = true;
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound: s } = await Audio.Sound.createAsync(
      require("../../assets/ringtone.mp3"),
      { shouldPlay: true, isLooping: true, volume: 1.0 },
    );
    if (!wantRing) {
      await s.unloadAsync(); // se pidió detener mientras cargaba
      return;
    }
    sound = s;
    console.log("🔔 Timbre sonando");
  } catch (e) {
    console.log("❌ Error ringtone:", e);
  } finally {
    starting = false;
  }
}

export async function stopRingtone() {
  wantRing = false;
  try {
    if (sound) {
      const s = sound;
      sound = null;
      await s.stopAsync();
      await s.unloadAsync();
      console.log("🔕 Timbre detenido");
    }
  } catch {}
}
