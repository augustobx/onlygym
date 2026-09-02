import { describe, expect, it } from "vitest";
import { getAuthoritativeRequestHost, normalizeRequestHost } from "../src/lib/request-host";

describe("host autoritativo del request", () => {
  it("ignora X-Forwarded-Host aunque contradiga al Host real", () => {
    const headers = new Headers({
      host: "onlygym.nanoapps.ar",
      "x-forwarded-host": "toti.nanoapps.ar",
    });
    expect(getAuthoritativeRequestHost(headers)).toBe("onlygym.nanoapps.ar");
  });

  it("normaliza puerto y punto final", () => {
    expect(normalizeRequestHost("Toti.NanoApps.Ar:443.")).toBe("toti.nanoapps.ar");
    expect(normalizeRequestHost("Toti.NanoApps.Ar:443")).toBe("toti.nanoapps.ar");
  });

  it("rechaza listas de hosts en vez de confiar en el primero", () => {
    expect(normalizeRequestHost("toti.nanoapps.ar, test.nanoapps.ar")).toBe("");
  });
});
