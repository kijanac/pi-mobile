import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

type AuthModule = typeof import("../src/auth.ts");

// Each test gets a fresh module instance backed by an empty owner DB, so claim
// and owner state can't leak between behaviors. config.ts requires PICO_HOST_DB
// and PICO_WORKSPACES_DIR, so both are set before the (re-)import.
async function freshAuth(opts: { insecure?: boolean } = {}): Promise<AuthModule> {
  vi.resetModules();
  const dir = mkdtempSync(join(tmpdir(), "pico-auth-"));
  process.env.PICO_HOST_DB = join(dir, "host.db");
  process.env.PICO_WORKSPACES_DIR = dir;
  if (opts.insecure) process.env.PICO_HOST_INSECURE_NO_AUTH = "1";
  else delete process.env.PICO_HOST_INSECURE_NO_AUTH;
  delete process.env.PICO_PAIRING_TOKEN;
  delete process.env.PICO_HOST_PAIRING_TOKEN;
  return import("../src/auth.ts");
}

function thrownCode(fn: () => unknown): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    return (error as { hostErrorCode?: string }).hostErrorCode;
  }
}

describe("a host gates every request on a Tailscale identity", () => {
  it("rejects a request that carries no identity", async () => {
    const auth = await freshAuth();
    expect(auth.authorizeHeaders({})).toMatchObject({
      ok: false,
      status: 401,
      error: "missing_tailscale_identity",
    });
  });

  it("admits any identity while the host is still unclaimed", async () => {
    const auth = await freshAuth();
    expect(auth.authorizeHeaders({ "tailscale-user-login": "alice@example.test" })).toEqual({
      ok: true,
      user: "alice@example.test",
      claimed: false,
    });
  });

  it("once claimed, admits the owner and refuses everyone else", async () => {
    const auth = await freshAuth();
    auth.claimPicoHostOwner("alice@example.test");

    expect(auth.authorizeHeaders({ "tailscale-user-login": "alice@example.test" })).toMatchObject({
      ok: true,
      claimed: true,
    });
    expect(auth.authorizeHeaders({ "tailscale-user-login": "mallory@evil.test" })).toMatchObject({
      ok: false,
      status: 403,
      error: "tailscale_user_not_pico_host_owner",
    });
  });

  it("identifies the owner regardless of case or surrounding whitespace", async () => {
    const auth = await freshAuth();
    auth.claimPicoHostOwner("Alice@Example.Test");
    expect(auth.authorizeHeaders({ "tailscale-user-login": "  ALICE@EXAMPLE.TEST  " }).ok).toBe(true);
  });

  it("admits no impostor: any login that isn't the owner is refused", async () => {
    const auth = await freshAuth();
    auth.claimPicoHostOwner("owner@example.test");
    const impostors = [
      "",
      "owner",
      "owner@example.tes",
      "owner@example.test.evil",
      "not-the-owner@example.test",
      "ówner@example.test",
    ];
    for (const login of impostors) {
      expect(auth.authorizeHeaders({ "tailscale-user-login": login }).ok).toBe(false);
    }
  });

  it("opens fully only under the explicit insecure dev flag", async () => {
    const auth = await freshAuth({ insecure: true });
    expect(auth.authorizeHeaders({}).ok).toBe(true);
  });
});

describe("claiming a host is first-come and owner-exclusive", () => {
  it("makes the first identity the owner", async () => {
    const auth = await freshAuth();
    expect(auth.claimPicoHostOwner("alice@example.test")).toEqual({ claimed: true, owner: "alice@example.test" });
    expect(auth.picoHostOwnerLogins()).toEqual(["alice@example.test"]);
  });

  it("is idempotent for the same identity (case-insensitive) and never adds a second owner", async () => {
    const auth = await freshAuth();
    auth.claimPicoHostOwner("alice@example.test");
    expect(auth.claimPicoHostOwner("ALICE@Example.Test").claimed).toBe(true);
    expect(auth.picoHostOwnerLogins()).toEqual(["alice@example.test"]);
  });

  it("refuses a different identity once an owner exists", async () => {
    const auth = await freshAuth();
    auth.claimPicoHostOwner("alice@example.test");
    expect(thrownCode(() => auth.claimPicoHostOwner("bob@example.test"))).toBe("pico_host_already_claimed");
  });
});

describe("a pairing token guards the very first claim", () => {
  it("rejects a first claim with a missing or wrong token and accepts the right one", async () => {
    const auth = await freshAuth();
    auth.setPairingToken("s3cret-token");
    expect(thrownCode(() => auth.claimPicoHostOwner("alice@example.test"))).toBe("invalid_pairing_token");
    expect(thrownCode(() => auth.claimPicoHostOwner("alice@example.test", "wrong"))).toBe("invalid_pairing_token");
    expect(auth.claimPicoHostOwner("alice@example.test", "s3cret-token")).toMatchObject({ claimed: true });
  });

  it("stops requiring the token once the host is claimed", async () => {
    const auth = await freshAuth();
    auth.setPairingToken("s3cret-token");
    auth.claimPicoHostOwner("alice@example.test", "s3cret-token");
    expect(auth.claimPicoHostOwner("alice@example.test").claimed).toBe(true);
  });
});
