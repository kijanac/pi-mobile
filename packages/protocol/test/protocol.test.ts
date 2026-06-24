import { Arbitrary, FastCheck, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  AssistantMessage,
  CompactionEntry,
  MessageUsage,
  MIN_MOBILE_VERSION,
  PRODUCT_VERSION,
  PROTOCOL_VERSION,
  RECOMMENDED_MOBILE_VERSION,
  SendMode,
  SessionMeta,
  SessionStatus,
  ToolCallMessage,
  UserMessage,
} from "../src/index.ts";

// Representative messages spanning literals, structs, and unions.
const WIRE_SCHEMAS: ReadonlyArray<readonly [string, Schema.Schema<any>]> = [
  ["SendMode", SendMode],
  ["SessionStatus", SessionStatus],
  ["MessageUsage", MessageUsage],
  ["UserMessage", UserMessage],
  ["AssistantMessage", AssistantMessage],
  ["ToolCallMessage", ToolCallMessage],
  ["CompactionEntry", CompactionEntry],
  ["SessionMeta", SessionMeta],
];

describe("wire messages survive an encode/decode round-trip", () => {
  for (const [name, schema] of WIRE_SCHEMAS) {
    it(`${name}: decode(encode(x)) deep-equals x for any valid value`, () => {
      const arb = Arbitrary.make(schema);
      const encode = Schema.encodeSync(schema);
      const decode = Schema.decodeUnknownSync(schema);
      FastCheck.assert(
        FastCheck.property(arb, (value) => {
          expect(decode(encode(value))).toStrictEqual(value);
        }),
        { numRuns: 50 },
      );
    });
  }
});

describe("decoding rejects malformed input", () => {
  it("refuses values that don't match the schema", () => {
    expect(() => Schema.decodeUnknownSync(UserMessage)({ not: "a user message" })).toThrow();
    expect(() => Schema.decodeUnknownSync(SendMode)("sideways")).toThrow();
  });
});

describe("version constants hold their invariants across releases", () => {
  const isSemver = (v: string) => /^\d+\.\d+\.\d+$/.test(v);
  const cmp = (a: string, b: string): number => {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i] - pb[i];
    return 0;
  };

  it("PROTOCOL_VERSION is a positive integer", () => {
    expect(Number.isInteger(PROTOCOL_VERSION)).toBe(true);
    expect(PROTOCOL_VERSION).toBeGreaterThan(0);
  });

  it("product and minimum versions are semver, and recommended tracks product", () => {
    expect(isSemver(PRODUCT_VERSION)).toBe(true);
    expect(isSemver(MIN_MOBILE_VERSION)).toBe(true);
    expect(RECOMMENDED_MOBILE_VERSION).toBe(PRODUCT_VERSION);
  });

  it("the minimum supported mobile version never exceeds the current product", () => {
    expect(cmp(MIN_MOBILE_VERSION, PRODUCT_VERSION)).toBeLessThanOrEqual(0);
  });
});
