import { z } from 'zod';
/** Canonical error/success envelopes (contracts/02 §2). No internal leakage. */
export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ field: z.string(), issue: z.string() })).optional(),
    request_id: z.string().optional(),
    trace_id: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

export const apiSuccess = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ ok: z.literal(true), data });
export type ApiSuccess<T> = { ok: true; data: T };
