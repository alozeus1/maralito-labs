/** Stable, client-safe auth error codes (mirror contracts/02 error model). */
export type AuthErrorCode =
  | 'unauthenticated' // 401
  | 'forbidden' // 403
  | 'not_found'; // 404 (out-of-scope — never reveal existence)

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message = 'Authorization error',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
