export type DashboardArea = "inicio" | "socios" | "entrenamiento" | "operacion" | "gestion" | "entrenador";

export const DASHBOARD_AREA_PREFIXES: Record<Exclude<DashboardArea, "inicio">, string[]> = {
  socios: ["/dashboard/clientes", "/dashboard/pagos", "/dashboard/cuentas", "/dashboard/recompensas"],
  entrenamiento: ["/dashboard/entrenamiento", "/dashboard/clases", "/dashboard/entrenadores", "/dashboard/mediciones"],
  operacion: ["/dashboard/caja", "/dashboard/productos", "/dashboard/aforo"],
  gestion: ["/dashboard/reportes", "/dashboard/empleados", "/dashboard/configuracion", "/dashboard/seguridad"],
  entrenador: ["/dashboard/entrenador"],
};

export function pathnameMatchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function resolveDashboardArea(pathname: string): DashboardArea {
  if (pathname === "/dashboard") return "inicio";

  // El área personal del entrenador se evalúa antes de /dashboard/entrenamiento.
  for (const area of ["entrenador", "socios", "entrenamiento", "operacion", "gestion"] as const) {
    if (DASHBOARD_AREA_PREFIXES[area].some((prefix) => pathnameMatchesPrefix(pathname, prefix))) return area;
  }

  return "inicio";
}

export function isDashboardArea(pathname: string, area: Exclude<DashboardArea, "inicio">) {
  return DASHBOARD_AREA_PREFIXES[area].some((prefix) => pathnameMatchesPrefix(pathname, prefix));
}
