import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lcliquidations.clubscout',     // e.g. com.lcliquidations.lpnfinder
  appName: 'clubSCOUT',                  // e.g. LPNFinder
  webDir: 'public',                          // not used in Option B, but required
  server: {
    url: 'https://https://clubscout-lilac.vercel.app/',           // e.g. https://lpnfinder.vercel.app
    androidScheme: 'https'
    // DO NOT set cleartext=true for production HTTPS
  }
};

export default config;
