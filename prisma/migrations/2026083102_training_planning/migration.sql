-- Preserve objective history with explicit lifecycle states.
ALTER TABLE "objetivos_socios"
ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'activo',
ADD COLUMN "fecha_fin" DATE,
ADD COLUMN "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX "objetivos_socios_tenant_id_cliente_id_activo_idx";
CREATE INDEX "objetivos_socios_tenant_id_cliente_id_estado_idx"
ON "objetivos_socios"("tenant_id", "cliente_id", "estado");
