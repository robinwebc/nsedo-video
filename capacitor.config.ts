import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.nsedo.video",
  appName: "nSedo Video",
  webDir: "dist",
  android: {
    allowMixedContent: false,
    adjustMarginsForEdgeToEdge: "auto",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
