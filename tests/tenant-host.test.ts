import { describe, expect, it } from "vitest";
import { parseTenantHostMap, resolveTenantSlugForHost } from "../src/lib/tenant-host";

describe("resolución de tenant por host", () => {
  it("prioriza un dominio explícitamente autorizado", () => {
    expect(resolveTenantSlugForHost({ hostname: "mi-gym.com", hostMap: "mi-gym.com=gym-uno", production: true })).toBe("gym-uno");
  });

  it("resuelve un subdominio simple del dominio base", () => {
    expect(resolveTenantSlugForHost({ hostname: "norte.onlygym.com", baseDomain: "onlygym.com", production: true })).toBe("norte");
  });

  it("no usa un tenant predeterminado en producción", () => {
    expect(resolveTenantSlugForHost({ hostname: "dominio-desconocido.com", localDefaultSlug: "onlygym-demo", production: true })).toBeNull();
  });

  it("permite un fallback sólo en localhost de desarrollo", () => {
    expect(resolveTenantSlugForHost({ hostname: "localhost", localDefaultSlug: "onlygym-demo", production: false })).toBe("onlygym-demo");
  });

  it("ignora entradas inválidas del mapa", () => {
    expect(parseTenantHostMap("inválida, gym.test=gym-test").get("gym.test")).toBe("gym-test");
  });
});
