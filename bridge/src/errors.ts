/**
 * Shared error types.
 *
 * Lives in its own module so both `pi.ts` (which can fail to resume a
 * session) and `session.ts` (which can fail to look up a session by
 * id) can throw and catch the same class without forcing one to
 * import the other.
 */

/**
 * Raised when a session id refers to nothing the bridge can act on:
 * either no row in the SQLite store, or a row exists but pi's on-disk
 * session file (under `~/.pi/agent/sessions/...`) is missing.
 *
 * Tagged so Effect's typed-error machinery can branch on it cleanly.
 */
export class SessionNotFound extends Error {
  readonly _tag = "SessionNotFound";
  constructor(readonly id: string) {
    super(`session not found: ${id}`);
  }
}
