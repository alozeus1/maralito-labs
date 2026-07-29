import { type KmsProvider, KmsProviderUnavailableError } from './provider';
import { LocalDevKmsProvider } from './local-provider';

/**
 * KMS provider factory (Phase 8B, ADR-0017). Chooses the provider from env. DEV builds use the local
 * provider (fail-closed in production). AWS/GCP adapters are documented seams that must be implemented +
 * wired before storing real PII in production — they intentionally throw here so a prod misconfig fails loud.
 */
export interface KmsEnv {
  provider?: string | undefined; // MARALITO_KMS_PROVIDER: local | supabase | aws | gcp
  keyId?: string | undefined; // MARALITO_KMS_KEY_ID
  localKeyMaterial?: string | undefined; // BORDERPASS_KMS_KEY (dev only)
  appEnv?: string | undefined; // BORDERPASS_ENV / APP_ENV / NODE_ENV
}

export function readKmsEnv(env: NodeJS.ProcessEnv = process.env): KmsEnv {
  return {
    provider: env.MARALITO_KMS_PROVIDER,
    keyId: env.MARALITO_KMS_KEY_ID,
    localKeyMaterial: env.BORDERPASS_KMS_KEY,
    appEnv: env.BORDERPASS_ENV ?? env.APP_ENV ?? env.NODE_ENV,
  };
}

export function isKmsConfigured(env: KmsEnv = readKmsEnv()): boolean {
  const p = (env.provider ?? 'local').toLowerCase();
  if (p === 'aws' || p === 'gcp') return Boolean(env.keyId);
  return Boolean(env.localKeyMaterial); // local/supabase dev
}

/** Build the configured KMS provider. Throws (fail-closed) on missing config or unimplemented adapters. */
export function getKmsProvider(env: KmsEnv = readKmsEnv()): KmsProvider {
  const provider = (env.provider ?? 'local').toLowerCase();
  const isProduction = (env.appEnv ?? '').toLowerCase() === 'production';

  switch (provider) {
    case 'local':
    case 'supabase': // dev alias — supabase-hosted dev uses the local key stand-in
      return new LocalDevKmsProvider({
        keyMaterial: env.localKeyMaterial ?? '',
        keyRef: env.keyId ?? 'local-dev',
        isProduction,
      });
    case 'aws':
    case 'gcp':
      throw new KmsProviderUnavailableError(
        `KMS provider '${provider}' is not wired in this build. Implement packages/crypto/src/kms/${provider}-provider.ts and configure MARALITO_KMS_KEY_ID before storing real PII.`,
      );
    default:
      throw new KmsProviderUnavailableError(`Unknown MARALITO_KMS_PROVIDER '${provider}'.`);
  }
}
