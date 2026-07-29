import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import {
  withTenant,
  withPrivilegedDbAccess,
  consentRecords,
  newId,
  CONSENT_TYPES,
  type ConsentType,
  type ConsentSource,
} from '@maralito/db';
import {
  APP_CONSENT_TYPES,
  buildSignUpConsentDecisions,
  documentVersionForConsentType,
  signUpConsentIdempotencyKey,
  type AppConsentType,
  type ConsentDecision,
  type SignUpConsentInput,
} from '@/content/legal';
import { writeAudit } from './audit';

/**
 * ============================ LEGAL REVIEW REQUIRED ============================
 * Consent recording seam. Writes the auditable evidence that a user accepted a specific VERSION of
 * the Terms / Privacy Notice, in a specific LANGUAGE, at a specific TIME — plus their separate
 * transactional vs marketing notification choices.
 *
 * This is engineering plumbing for a legal requirement. Whether the fields captured here constitute
 * sufficient proof of consent under Mexico's LFPDPPP (or any U.S. rule) has NOT been reviewed by a
 * qualified lawyer. See docs/production-readiness/legal-consent.md.
 * ==============================================================================
 *
 * Invariants:
 *  - Writes are PRIVILEGED and server-only. consent_records grants the tenant role SELECT only
 *    (packages/db/src/rls/consents-policies.sql), so the browser has no insert path.
 *  - Rows are APPEND-ONLY. Withdrawal inserts a new row with granted:false; nothing is ever updated
 *    or deleted here.
 *  - NO PII is written: auth user id, org id, document version, locale, and the boolean decision.
 *    No IP address, no user agent, no free text (deliberate — those are personal data themselves and
 *    are deferred pending production KMS + a legal decision).
 *  - Reads of a user's own consent go through withTenant so RLS is exercised.
 */

// Compile-time guard: the pure app-side list and the DB schema list must not drift apart.
const _consentTypesAligned: readonly ConsentType[] = APP_CONSENT_TYPES;
const _consentTypesAlignedBack: readonly AppConsentType[] = CONSENT_TYPES;
void _consentTypesAligned;
void _consentTypesAlignedBack;

export interface ConsentSubject {
  readonly authUserId: string;
  readonly orgId: string;
  /** Language the documents were actually rendered in when the decision was made. */
  readonly locale: 'es' | 'en';
}

export type ConsentWriteResult =
  | { ok: true; recorded: number }
  | { ok: false; error: 'terms_not_accepted' | 'not_configured' | 'write_failed' };

interface PersistableConsent extends ConsentDecision {
  readonly idempotencyKey: string;
}

/** Low-level append. Idempotent per key; conflicting keys are silently skipped (retry-safe). */
async function insertConsentRows(
  subject: ConsentSubject,
  source: ConsentSource,
  rows: readonly PersistableConsent[],
): Promise<number> {
  if (rows.length === 0) return 0;
  return withPrivilegedDbAccess('consent.record', async (db) => {
    const inserted = await db
      .insert(consentRecords)
      .values(
        rows.map((r) => ({
          id: newId('csn'),
          orgId: subject.orgId,
          authUserId: subject.authUserId,
          consentType: r.consentType as ConsentType,
          documentVersion: r.documentVersion,
          documentLocale: subject.locale,
          granted: r.granted,
          source,
          idempotencyKey: r.idempotencyKey,
        })),
      )
      .onConflictDoNothing({ target: consentRecords.idempotencyKey })
      .returning({ id: consentRecords.id });
    return inserted.length;
  });
}

/**
 * Record the consent block captured at sign-up. Call this AFTER the user is authenticated and
 * provisioned (the record is keyed on the auth user id).
 *
 * Refuses to write anything — and reports `terms_not_accepted` — if the required Terms + Privacy
 * checkbox was not ticked. The caller MUST block account setup in that case rather than proceeding.
 *
 * Deterministic idempotency keys, so a retried sign-up submission cannot create duplicate evidence
 * rows for the same decision at the same document version.
 */
export async function recordSignUpConsent(
  subject: ConsentSubject,
  form: SignUpConsentInput,
): Promise<ConsentWriteResult> {
  const built = buildSignUpConsentDecisions(form);
  if (!built.ok) return { ok: false, error: 'terms_not_accepted' };
  if (!process.env.DATABASE_URL) return { ok: false, error: 'not_configured' };

  const rows: PersistableConsent[] = built.decisions.map((d) => ({
    ...d,
    idempotencyKey: signUpConsentIdempotencyKey(
      subject.authUserId,
      d.consentType,
      d.documentVersion,
    ),
  }));

  try {
    const recorded = await insertConsentRows(subject, 'sign_up', rows);
    await writeAudit({
      action: 'consent.recorded',
      orgId: subject.orgId,
      actorUserId: subject.authUserId,
      actorRole: 'customer',
      entityType: 'consent_record',
      entityId: subject.authUserId,
      // Metadata is decisions only — no PII, no free text.
      metadata: {
        source: 'sign_up',
        locale: subject.locale,
        recorded,
        decisions: built.decisions.map((d) => ({
          type: d.consentType,
          granted: d.granted,
          version: d.documentVersion,
        })),
      },
    });
    return { ok: true, recorded };
  } catch {
    return { ok: false, error: 'write_failed' };
  }
}

/**
 * Record a LATER change to a single consent (e.g. the user turns marketing off in Profile, or
 * re-accepts a new Terms version). Always APPENDS — a unique key is generated so a re-grant after a
 * withdrawal is never deduped away against the older, stale row.
 */
export async function recordConsentChange(
  subject: ConsentSubject,
  input: {
    readonly consentType: AppConsentType;
    readonly granted: boolean;
    readonly source: Exclude<ConsentSource, 'sign_up'>;
  },
): Promise<ConsentWriteResult> {
  if (!process.env.DATABASE_URL) return { ok: false, error: 'not_configured' };
  const documentVersion = documentVersionForConsentType(input.consentType);
  try {
    const recorded = await insertConsentRows(subject, input.source, [
      {
        consentType: input.consentType,
        granted: input.granted,
        documentVersion,
        idempotencyKey: `${input.source}:${subject.authUserId}:${input.consentType}:${newId('evt')}`,
      },
    ]);
    await writeAudit({
      action: input.granted ? 'consent.granted' : 'consent.withdrawn',
      orgId: subject.orgId,
      actorUserId: subject.authUserId,
      actorRole: 'customer',
      entityType: 'consent_record',
      entityId: subject.authUserId,
      metadata: {
        source: input.source,
        locale: subject.locale,
        type: input.consentType,
        version: documentVersion,
      },
    });
    return { ok: true, recorded };
  } catch {
    return { ok: false, error: 'write_failed' };
  }
}

export interface ConsentStateEntry {
  readonly consentType: AppConsentType;
  readonly granted: boolean;
  readonly documentVersion: string;
  readonly documentLocale: 'es' | 'en';
  readonly recordedAt: Date;
}

/**
 * The caller's OWN latest decision per consent type, read under RLS (withTenant). Missing types mean
 * "never asked" and must be treated as NOT granted.
 */
export async function getMyLatestConsents(
  authUserId: string,
  orgId: string,
): Promise<readonly ConsentStateEntry[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    return await withTenant({ authUserId, orgId }, async (tx) => {
      const rows = await tx
        .select({
          consentType: consentRecords.consentType,
          granted: consentRecords.granted,
          documentVersion: consentRecords.documentVersion,
          documentLocale: consentRecords.documentLocale,
          recordedAt: consentRecords.recordedAt,
        })
        .from(consentRecords)
        .where(eq(consentRecords.authUserId, authUserId))
        .orderBy(desc(consentRecords.recordedAt));
      const latest = new Map<AppConsentType, ConsentStateEntry>();
      for (const r of rows) {
        const type = r.consentType as AppConsentType;
        if (!latest.has(type)) {
          latest.set(type, {
            consentType: type,
            granted: r.granted,
            documentVersion: r.documentVersion,
            documentLocale: r.documentLocale,
            recordedAt: r.recordedAt,
          });
        }
      }
      return [...latest.values()];
    });
  } catch {
    return [];
  }
}

/**
 * Has this user accepted the CURRENT version of both required documents? Fail-closed: any read
 * failure, missing row, withdrawal, or stale version returns false. Use it to gate a re-consent
 * prompt after a version bump.
 */
export async function hasAcceptedCurrentLegalDocuments(
  authUserId: string,
  orgId: string,
): Promise<boolean> {
  const latest = await getMyLatestConsents(authUserId, orgId);
  const accepted = (type: AppConsentType): boolean => {
    const entry = latest.find((e) => e.consentType === type);
    return (
      !!entry && entry.granted && entry.documentVersion === documentVersionForConsentType(type)
    );
  };
  return accepted('terms_of_service') && accepted('privacy_notice');
}

/**
 * Compliance/ARCO retrieval of a user's FULL consent history via the privileged, audited path.
 * Staff have no RLS policy on consent_records by design, so this is the only staff-side route.
 * Callers must have already authorized the request (compliance role) and should audit the access.
 */
export async function readConsentHistoryForCompliance(
  authUserId: string,
): Promise<readonly ConsentStateEntry[]> {
  if (!process.env.DATABASE_URL) return [];
  return withPrivilegedDbAccess('consent.compliance_read', async (db) => {
    const rows = await db
      .select({
        consentType: consentRecords.consentType,
        granted: consentRecords.granted,
        documentVersion: consentRecords.documentVersion,
        documentLocale: consentRecords.documentLocale,
        recordedAt: consentRecords.recordedAt,
      })
      .from(consentRecords)
      .where(and(eq(consentRecords.authUserId, authUserId)))
      .orderBy(desc(consentRecords.recordedAt));
    return rows.map((r) => ({
      consentType: r.consentType as AppConsentType,
      granted: r.granted,
      documentVersion: r.documentVersion,
      documentLocale: r.documentLocale,
      recordedAt: r.recordedAt,
    }));
  });
}
