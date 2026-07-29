/**
 * @maralito/crypto — envelope encryption + KMS provider abstraction (Phase 8B, ADR-0017). Development-only.
 *
 * Server-only. Provides the seam that MUST protect real customer PII (address / RFC / KYC / documents)
 * before any of it is stored. The local provider is a dev stand-in (fail-closed in production); real
 * environments supply a cloud-KMS provider. No real PII is collected until this is validated + owner-signed.
 */
export type { KmsProvider } from './kms/provider';
export { KmsProviderUnavailableError } from './kms/provider';
export { LocalDevKmsProvider } from './kms/local-provider';
/**
 * AWS KMS provider — the production KEK custodian. Exported so it can be constructed and smoke-tested,
 * but NOT yet selected by `getKmsProvider`: `kms/config.ts` still throws for
 * `MARALITO_KMS_PROVIDER=aws`. Wiring the factory is a deliberate, owner-approved step — see
 * `docs/production-readiness/kms-production-plan.md` §5 "Wire the factory".
 */
export {
  AwsKmsProvider,
  createAwsKmsProvider,
  readAwsKmsEnv,
  isAwsKmsConfigured,
  signAwsRequestV4,
  toAmzDate,
  regionFromKeyArn,
  AWS_KMS_ENCRYPTION_CONTEXT,
  type AwsKmsProviderOptions,
  type AwsSigV4Input,
  type AwsSigV4Result,
} from './kms/aws-provider';
export {
  readKmsEnv,
  isKmsConfigured,
  getKmsProvider,
  type KmsEnv,
} from './kms/config';
export { encryptField, decryptField, type EncryptedField } from './envelope';
export { encryptPII, decryptPII } from './pii';
