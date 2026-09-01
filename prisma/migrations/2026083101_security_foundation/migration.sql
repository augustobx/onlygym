-- Remove transitional tenant defaults. Every tenant-owned write must now
-- provide the tenant resolved from the authenticated server context.
ALTER TABLE "sucursales" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "clientes" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "membresias" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "pagos" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "productos" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "ventas" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "ingresos" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "usuarios_clientes" ALTER COLUMN "tenant_id" DROP DEFAULT;

CREATE TABLE "auditorias" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER,
    "actor_user_id" VARCHAR(191),
    "actor_cliente_id" INTEGER,
    "accion" VARCHAR(100) NOT NULL,
    "entidad" VARCHAR(100),
    "entidad_id" VARCHAR(191),
    "resultado" VARCHAR(30) NOT NULL DEFAULT 'exito',
    "metadata" JSONB,
    "ip" VARCHAR(80),
    "user_agent" VARCHAR(255),
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auditorias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditorias_tenant_id_creada_en_idx" ON "auditorias"("tenant_id", "creada_en");
CREATE INDEX "auditorias_actor_user_id_creada_en_idx" ON "auditorias"("actor_user_id", "creada_en");
CREATE INDEX "auditorias_accion_creada_en_idx" ON "auditorias"("accion", "creada_en");

ALTER TABLE "auditorias"
ADD CONSTRAINT "auditorias_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
