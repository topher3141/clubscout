import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.lcliquidations.clubscout",
  appName: "ClubScout",
  webDir: "public", // must exist
  server: {
    url: "https://clubscout-lilac.vercel.app/",
    androidScheme: "https"
  }
};

export default config;
