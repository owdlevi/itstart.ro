import { describe, expect, test } from "vitest";
import { isBlocked } from "./blocked-addresses";

describe("isBlocked (rule 9's link check)", () => {
  test("lets public addresses through, IPv4 included", () => {
    expect(isBlocked("140.82.121.3")).toBe(false);
    expect(isBlocked("93.184.215.14")).toBe(false);
    expect(isBlocked("2606:4700::6812:1a78")).toBe(false);
  });

  test("refuses loopback, private, link-local and mapped ones", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "::",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "not an address",
    ]) {
      expect(isBlocked(address), address).toBe(true);
    }
  });
});
