import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "dev.pi.mobile",
  appName: "pi",
  webDir: "dist",
  backgroundColor: "#0a0a0a",
  ios: {
    contentInset: "always",
    backgroundColor: "#0a0a0a",
  },
  android: {
    backgroundColor: "#0a0a0a",
  },
  server: {
    // Set this to your LAN IP during dev for live reload on a real device.
    // url: "http://192.168.1.42:5173",
    // cleartext: true,
    androidScheme: "https",
  },
};

export default config;
