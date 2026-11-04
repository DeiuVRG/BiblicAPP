import Constants from 'expo-constants';

/** The running app version (from app.config.ts), or undefined when it cannot be read. */
export function getAppVersion(): string | undefined {
  try {
    const version = Constants.expoConfig?.version;
    return typeof version === 'string' && /^\d+\.\d+\.\d+/.test(version) ? version : undefined;
  } catch {
    return undefined;
  }
}
