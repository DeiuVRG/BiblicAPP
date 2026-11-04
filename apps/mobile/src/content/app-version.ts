import Constants from 'expo-constants';

import packageJson from '../../package.json';

function readable(version: unknown): version is string {
  return typeof version === 'string' && /^\d+\.\d+\.\d+/.test(version);
}

/**
 * The running app version: the one in the Expo config (app.config.ts), with the version of
 * package.json (kept equal to it by a test) as the fallback when the config is unavailable at
 * runtime. Undefined only if neither is readable, in which case `verifyPack` fails closed.
 */
export function getAppVersion(): string | undefined {
  try {
    const fromConfig: unknown = Constants.expoConfig?.version;
    if (readable(fromConfig)) return fromConfig;
  } catch {
    // fall through to the bundled version
  }
  return readable(packageJson.version) ? packageJson.version : undefined;
}
