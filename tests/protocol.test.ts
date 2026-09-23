import { describe, expect, test } from "bun:test";
import { parseRange } from "../src/main/protocol";

describe("protocol parseRange", () => {
  const SIZE = 1000;

  test("parses standard byte range", () => {
    expect(parseRange("bytes=0-499", SIZE)).toEqual({ start: 0, end: 499 });
    expect(parseRange("bytes=500-999", SIZE)).toEqual({ start: 500, end: 999 });
  });

  test("parses start-only range (to end of file)", () => {
    expect(parseRange("bytes=500-", SIZE)).toEqual({ start: 500, end: 999 });
  });

  test("parses suffix range (last N bytes)", () => {
    expect(parseRange("bytes=-200", SIZE)).toEqual({ start: 800, end: 999 });
  });

  test("rejects invalid or unsatisfiable ranges", () => {
    expect(parseRange(null, SIZE)).toBeNull();
    expect(parseRange("invalid", SIZE)).toBeNull();
    expect(parseRange("bytes=1000-", SIZE)).toBeNull();
    expect(parseRange("bytes=500-400", SIZE)).toBeNull();
    expect(parseRange("bytes=-0", SIZE)).toBeNull();
  });
});
