-- OnlyGym SaaS control plane (Deploy V4)
-- Brings the production database in sync with the Prisma schema for
-- SuperAdmin, commercial plans, subscriptions and platform payments.

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "plan_saas_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "fecha_alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "fecha_vencimiento" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "superadmins" (
  "id" SERIAL NOT NULL,
  "email" VARCHAR(120) NOT NULL,
  "password" VARCHAR(255) NOT NULL,
  "nombre" VARCHAR(100) NOT NULL,
  "rol" TEXT NOT NULL DEFAULT 'superadmin',
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "superadmins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "superadmins_email_key" ON "superadmins"("email");

CREATE TABLE IF NOT EXISTS "planes_saas" (
  "id" SERIAL NOT NULL,
  "codigo" VARCHAR(50) NOT NULL,
  "nombre" VARCHAR(100) NOT NULL,
  "descripcion" TEXT,
  "precio_mensual" DECIMAL(10,2) NOT NULL,
  "limite_usuarios" INTEGER NOT NULL DEFAULT 5,
  "limite_sucursales" INTEGER NOT NULL DEFAULT 1,
  "limite_socios" INTEGER DEFAULT 500,
  "modulos" JSONB,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "planes_saas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "planes_saas_codigo_key" ON "planes_saas"("codigo");

CREATE TABLE IF NOT EXISTS "suscripciones_saas" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "plan_id" INTEGER NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'activa',
  "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
  "monto" DECIMAL(10,2) NOT NULL,
  "intervalo" TEXT NOT NULL DEFAULT 'mensual',
  "metodo_pago" TEXT,
  "notas" TEXT,
  "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "suscripciones_saas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "suscripciones_saas_tenant_id_estado_idx"
  ON "suscripciones_saas"("tenant_id", "estado");

CREATE TABLE IF NOT EXISTS "pagos_plataforma" (
  "id" SERIAL NOT NULL,
  "suscripcion_id" INTEGER NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "monto" DECIMAL(10,2) NOT NULL,
  "metodo_pago" TEXT NOT NULL,
  "referencia" VARCHAR(100),
  "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "comprobante" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'completado',
  CONSTRAINT "pagos_plataforma_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pagos_plataforma_tenant_id_fecha_pago_idx"
  ON "pagos_plataforma"("tenant_id", "fecha_pago");

DO $$ BEGIN
  ALTER TABLE "tenants"
    ADD CONSTRAINT "tenants_plan_saas_id_fkey"
    FOREIGN KEY ("plan_saas_id") REFERENCES "planes_saas"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "suscripciones_saas"
    ADD CONSTRAINT "suscripciones_saas_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "suscripciones_saas"
    ADD CONSTRAINT "suscripciones_saas_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "planes_saas"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "pagos_plataforma"
    ADD CONSTRAINT "pagos_plataforma_suscripcion_id_fkey"
    FOREIGN KEY ("suscripcion_id") REFERENCES "suscripciones_saas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
