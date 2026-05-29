
export class SessionNotFound extends Error {
  readonly _tag = "SessionNotFound";
  constructor(readonly id: string) {
    super(`session not found: ${id}`);
  }
}
