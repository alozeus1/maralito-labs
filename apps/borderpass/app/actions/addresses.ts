'use server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { withTenant, addresses, customerProfiles, newId } from '@maralito/db';
import { requireCustomerAccess } from '@maralito/auth';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';
import { isKmsConfigured, sealPii, sealOptional, openPii, openOptional } from '@/server/kms';

type Result<T = void> =
  { ok: true; data?: T } | { ok: false; error: { code: string; message: string } };

const guard = async () => {
  const s = await getAppSession();
  if (!s) return { s: null, err: { code: 'unauthenticated', message: 'Sign in required.' } };
  try {
    requireCustomerAccess(s);
  } catch {
    return { s: null, err: { code: 'forbidden', message: 'Not allowed.' } };
  }
  if (!getServerEnv().DATABASE_URL)
    return { s: null, err: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return { s, err: null };
};

const AddressInput = z.object({
  recipient: z.string().trim().min(1).max(200),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120),
  postal: z.string().trim().min(1).max(20),
  phone: z.string().trim().max(40).optional(),
  country: z.enum(['MX', 'US']).default('MX'),
  label: z.string().trim().max(60).optional(),
  kind: z.enum(['delivery', 'hub']).default('delivery'),
});

export interface AddressView {
  id: string;
  label: string | null;
  kind: 'delivery' | 'hub';
  country: string | null;
  recipient: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal: string;
  phone: string | null;
}

/** Create an address for the caller, sealing all PII fields (KMS). Fails closed without KMS. */
export async function createMyAddress(input: unknown): Promise<Result<{ id: string }>> {
  const { s, err } = await guard();
  if (!s) return { ok: false, error: err! };
  if (!isKmsConfigured())
    return {
      ok: false,
      error: { code: 'kms_unavailable', message: 'Secure address storage is not configured.' },
    };
  const parsed = AddressInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: { code: 'validation_failed', message: 'Invalid address.' } };
  const a = parsed.data;
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const profile = await tx.query.customerProfiles.findFirst({
      where: eq(customerProfiles.authUserId, s.sub),
    });
    if (!profile) return { ok: false, error: { code: 'not_found', message: 'Profile missing.' } };
    const id = newId('adr');
    await tx.insert(addresses).values({
      id,
      orgId: s.orgId,
      customerId: profile.id,
      kind: a.kind,
      label: a.label ?? null,
      country: a.country,
      recipientEnc: sealPii(a.recipient),
      line1Enc: sealPii(a.line1),
      line2Enc: sealOptional(a.line2),
      cityEnc: sealPii(a.city),
      stateEnc: sealPii(a.state),
      postalEnc: sealPii(a.postal),
      phoneEnc: sealOptional(a.phone),
    });
    return { ok: true as const, data: { id } };
  });
}

/** List the caller's addresses, decrypting PII for the owner (RLS-scoped). */
export async function listMyAddresses(): Promise<Result<AddressView[]>> {
  const { s, err } = await guard();
  if (!s) return { ok: false, error: err! };
  if (!isKmsConfigured()) return { ok: true, data: [] };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const profile = await tx.query.customerProfiles.findFirst({
      where: eq(customerProfiles.authUserId, s.sub),
    });
    if (!profile) return { ok: true as const, data: [] };
    const rows = await tx
      .select()
      .from(addresses)
      .where(eq(addresses.customerId, profile.id))
      .orderBy(asc(addresses.createdAt));
    return {
      ok: true as const,
      data: rows.map((r) => ({
        id: r.id,
        label: r.label,
        kind: r.kind,
        country: r.country,
        recipient: openPii(r.recipientEnc),
        line1: openPii(r.line1Enc),
        line2: openOptional(r.line2Enc),
        city: openPii(r.cityEnc),
        state: openPii(r.stateEnc),
        postal: openPii(r.postalEnc),
        phone: openOptional(r.phoneEnc),
      })),
    };
  });
}
