import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ueat.app",
  appName: "ueat",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
