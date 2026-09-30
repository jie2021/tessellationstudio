import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tessellationstudio.app',
  appName: 'Tessellation Studio',
  // Must match Next's static export directory in next.config.mjs.
  webDir: 'out',
};

export default config;
