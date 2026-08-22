/**
 * Utilidad para serializar de forma segura objetos devueltos por Prisma hacia componentes cliente (React Server Actions)
 * Convierte instancias de Prisma.Decimal a números estándar de JavaScript para evitar el error de Next.js
 * "Only plain objects can be passed to Client Components from Server Components. Decimal objects are not supported."
 */
export function serializeData<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      // Detectar instancias de Decimal (objetos que tienen toFixed o estructura Decimal.js)
      if (
        value !== null &&
        typeof value === "object" &&
        (typeof value.toFixed === "function" || (value.d !== undefined && value.e !== undefined && value.s !== undefined))
      ) {
        return Number(value);
      }
      return value;
    })
  );
}
