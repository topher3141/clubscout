import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.lcliquidations.clubscout",   // change if you want
  appName: "ClubScout",                   // change if you want
  webDir: "public",                       // MUST exist in repo
  server: {
    url: "https://clubscout-lilac.vercel.app", // <-- your Vercel URL
    androidScheme: "https"
  }
};

export default config;
