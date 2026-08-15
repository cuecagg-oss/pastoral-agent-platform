import { afterEach, describe, expect, it } from "vitest";
import type { Request } from "express";
import { getSessionCookieOptions } from "./cookies";

const initialNodeEnv = process.env.NODE_ENV;

function requestFrom(protocol: string, forwardedProto?: string): Request {
  return {
    protocol,
    headers: forwardedProto ? { "x-forwarded-proto": forwardedProto } : {},
  } as Request;
}

afterEach(() => {
  process.env.NODE_ENV = initialNodeEnv;
});

describe("getSessionCookieOptions", () => {
  it("preserves a secure first-party session behind a production TLS proxy", () => {
    process.env.NODE_ENV = "production";

    expect(getSessionCookieOptions(requestFrom("http"))).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it("marks the cookie secure when a development request reports HTTPS forwarding", () => {
    process.env.NODE_ENV = "development";

    expect(getSessionCookieOptions(requestFrom("http", "https"))).toMatchObject({
      sameSite: "lax",
      secure: true,
    });
  });
});
