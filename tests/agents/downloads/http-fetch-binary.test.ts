import { describe, it, expect } from "vitest";
import { isBlockedHost } from "@/lib/agents/tools/downloads/http-fetch-binary";

describe("isBlockedHost", () => {
  it.each([
    ["localhost", true],
    ["127.0.0.1", true],
    ["10.0.0.5", true],
    ["192.168.1.1", true],
    ["172.16.0.1", true],
    ["172.31.255.254", true],
    ["169.254.169.254", true],
    ["printer.local", true],
    ["example.com", false],
    ["nsearchives.nseindia.com", false],
    ["api.canva.com", false],
    ["172.15.0.1", false],
    ["172.32.0.1", false],
    // IPv6: bracketed (as Node's URL parser returns them)
    ["[::1]", true],
    ["[::]", true],
    ["[fe80::1]", true],
    ["[fc00::1]", true],
    ["[fd12:3456:789a::1]", true],
    ["[::ffff:127.0.0.1]", true],
    ["[::ffff:10.0.0.1]", true],
    ["[2001:db8::1]", false],
    ["[2606:4700:4700::1111]", false],
    // IPv6: unbracketed (defense-in-depth for callers that strip their own brackets)
    ["::1", true],
    ["fe80::1", true],
    ["2001:db8::1", false],
  ])("isBlockedHost(%s) === %s", (host, expected) => {
    expect(isBlockedHost(host)).toBe(expected);
  });
});
