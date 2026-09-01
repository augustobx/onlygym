-- CreateEnum
CREATE TYPE "RolTenant" AS ENUM ('OWNER', 'ADMIN', 'RECEPCION', 'ENTRENADOR');

-- DropIndex
DROP INDEX "clientes_documento_key";

-- DropIndex
DROP INDEX "clientes_documento_idx";

-- DropIndex
DROP INDEX "clientes_nombre_apellido_idx";

-- DropIndex
DROP INDEX "productos_codigo_key";

-- DropIndex
DROP INDEX "productos_codigo_idx";

-- DropIndex
DROP INDEX "productos_nombre_idx";

-- DropIndex
DROP INDEX "usuarios_clientes_usuario_key";

-- AlterTable
ALTER TABLE "sucursales" ADD COLUMN     "capacidad" INTEGER,
ADD COLUMN     "telefono" VARCHAR(30),
ADD COLUMN     "tenant_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "contacto_emergencia" VARCHAR(180),
ADD COLUMN     "entrenador_id" INTEGER,
ADD COLUMN     "fecha_nacimiento" DATE,
ADD COLUMN     "sucursal_habitual_id" INTEGER,
ADD COLUMN     "tenant_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "membresias" ADD COLUMN     "tenant_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "tenant_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "tenant_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "tenant_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ingresos" ADD COLUMN     "tenant_id" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "usuarios_clientes" ADD COLUMN     "tenant_id" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "tenants" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "plan" TEXT NOT NULL DEFAULT 'profesional',
    "modulos" JSONB,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- Preserve every legacy row by assigning it to the initial OnlyGym tenant.
-- The explicit id matches the transitional defaults added above.
INSERT INTO "tenants" (
    "id", "nombre", "slug", "estado", "plan", "modulos", "creado_en", "actualizado_en"
) VALUES (
    1,
    'OnlyGym Demo',
    'onlygym-demo',
    'activo',
    'profesional',
    '{"entrenamiento":true,"progreso":true,"clases":true,"puntos":true}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;

SELECT setval(pg_get_serial_sequence('"tenants"', 'id'), GREATEST((SELECT MAX("id") FROM "tenants"), 1));

-- CreateTable
CREATE TABLE "tenant_usuarios" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "rol" "RolTenant" NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_usuarios_pkey" PRIMARY KEY ("id")
);

-- Convert legacy staff access into explicit tenant memberships.
INSERT INTO "tenant_usuarios" ("tenant_id", "user_id", "rol", "estado", "creado_en")
SELECT
    1,
    "id",
    CASE
        WHEN "nivel" = 'admin' THEN 'OWNER'::"RolTenant"
        WHEN "nivel" = 'supervisor' THEN 'ADMIN'::"RolTenant"
        ELSE 'RECEPCION'::"RolTenant"
    END,
    "estado",
    CURRENT_TIMESTAMP
FROM "user"
ON CONFLICT DO NOTHING;

-- CreateTable
CREATE TABLE "sesiones_socios" (
    "id" TEXT NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_uso_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" VARCHAR(255),

    CONSTRAINT "sesiones_socios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfiles_entrenador" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "bio" TEXT,
    "especialidades" TEXT[],
    "foto" TEXT,
    "horarios" JSONB,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfiles_entrenador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetivos_socios" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "entrenador_id" INTEGER,
    "tipo" VARCHAR(80) NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "fecha_inicio" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "objetivos_socios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ejercicios" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" TEXT,
    "grupo_muscular" VARCHAR(60) NOT NULL,
    "categoria" VARCHAR(60),
    "equipamiento" VARCHAR(100),
    "dificultad" VARCHAR(40),
    "instrucciones" TEXT,
    "video_url" TEXT,
    "imagen_url" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ejercicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rutinas" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "nombre" VARCHAR(140) NOT NULL,
    "descripcion" TEXT,
    "objetivo" VARCHAR(100),
    "nivel" VARCHAR(40),
    "duracion_minutos" INTEGER,
    "dias_cantidad" INTEGER,
    "entrenador_id" INTEGER,
    "recomendaciones" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rutinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rutina_ejercicios" (
    "id" SERIAL NOT NULL,
    "rutina_id" INTEGER NOT NULL,
    "ejercicio_id" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL DEFAULT 1,
    "orden" INTEGER NOT NULL,
    "series" INTEGER,
    "repeticiones" VARCHAR(30),
    "peso_sugerido" DECIMAL(8,2),
    "descanso_segundos" INTEGER,
    "tiempo_segundos" INTEGER,
    "observaciones" TEXT,

    CONSTRAINT "rutina_ejercicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes_entrenamiento" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "nombre" VARCHAR(140) NOT NULL,
    "descripcion" TEXT,
    "objetivo" VARCHAR(100),
    "duracion_semanas" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planes_entrenamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fases_plan" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "rutina_id" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "semana_inicio" INTEGER NOT NULL,
    "semana_fin" INTEGER NOT NULL,

    CONSTRAINT "fases_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_entrenamiento" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "plan_id" INTEGER,
    "rutina_id" INTEGER,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "notas" TEXT,

    CONSTRAINT "asignaciones_entrenamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_entrenamiento" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "asignacion_id" INTEGER,
    "rutina_id" INTEGER,
    "iniciada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizada_en" TIMESTAMP(3),
    "duracion_minutos" INTEGER,
    "cumplimiento" DECIMAL(5,2),
    "comentario" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'en_curso',

    CONSTRAINT "sesiones_entrenamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ejercicios_sesion" (
    "id" SERIAL NOT NULL,
    "sesion_id" INTEGER NOT NULL,
    "ejercicio_id" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "observaciones" TEXT,

    CONSTRAINT "ejercicios_sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series_entrenamiento" (
    "id" SERIAL NOT NULL,
    "ejercicio_sesion_id" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "peso" DECIMAL(8,2),
    "repeticiones" INTEGER,
    "esfuerzo_percibido" INTEGER,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "comentario" VARCHAR(255),

    CONSTRAINT "series_entrenamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mediciones_corporales" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "entrenador_id" INTEGER,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "peso" DECIMAL(6,2),
    "altura" DECIMAL(5,2),
    "imc" DECIMAL(5,2),
    "grasa" DECIMAL(5,2),
    "masa_muscular" DECIMAL(5,2),
    "cintura" DECIMAL(6,2),
    "pecho" DECIMAL(6,2),
    "brazo_izquierdo" DECIMAL(6,2),
    "brazo_derecho" DECIMAL(6,2),
    "pierna_izquierda" DECIMAL(6,2),
    "pierna_derecha" DECIMAL(6,2),
    "cadera" DECIMAL(6,2),
    "extras" JSONB,
    "observaciones" TEXT,

    CONSTRAINT "mediciones_corporales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos_progreso" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" VARCHAR(20) NOT NULL,
    "object_key" TEXT NOT NULL,
    "mime_type" VARCHAR(80) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_progreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_clase" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "color" VARCHAR(20),
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipos_clase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clases" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "tipo_clase_id" INTEGER NOT NULL,
    "entrenador_id" INTEGER,
    "sucursal_id" INTEGER NOT NULL,
    "sala" VARCHAR(80),
    "inicio" TIMESTAMP(3) NOT NULL,
    "duracion_minutos" INTEGER NOT NULL,
    "cupo_maximo" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'programada',

    CONSTRAINT "clases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_clase" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "clase_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'confirmada',
    "posicion_espera" INTEGER,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelada_en" TIMESTAMP(3),
    "asistencia_en" TIMESTAMP(3),

    CONSTRAINT "reservas_clase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_puntos" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "puntos" INTEGER NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "concepto" VARCHAR(180) NOT NULL,
    "referencia" VARCHAR(120),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_puntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "premios" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" TEXT,
    "puntos" INTEGER NOT NULL,
    "stock" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "premios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canjes_premio" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "premio_id" INTEGER NOT NULL,
    "puntos" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregado_en" TIMESTAMP(3),

    CONSTRAINT "canjes_premio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficios" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "titulo" VARCHAR(140) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "comercio" VARCHAR(120),
    "imagen_url" TEXT,
    "vigente_desde" DATE,
    "vigente_hasta" DATE,
    "condiciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "beneficios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "tipo" VARCHAR(60) NOT NULL,
    "titulo" VARCHAR(140) NOT NULL,
    "mensaje" TEXT NOT NULL,
    "datos" JSONB,
    "leida_en" TIMESTAMP(3),
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PerfilEntrenadorToSucursal" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PerfilEntrenadorToSucursal_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenant_usuarios_user_id_estado_idx" ON "tenant_usuarios"("user_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_usuarios_tenant_id_user_id_key" ON "tenant_usuarios"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_socios_token_hash_key" ON "sesiones_socios"("token_hash");

-- CreateIndex
CREATE INDEX "sesiones_socios_tenant_id_cliente_id_expira_en_idx" ON "sesiones_socios"("tenant_id", "cliente_id", "expira_en");

-- CreateIndex
CREATE UNIQUE INDEX "perfiles_entrenador_user_id_key" ON "perfiles_entrenador"("user_id");

-- CreateIndex
CREATE INDEX "perfiles_entrenador_tenant_id_estado_idx" ON "perfiles_entrenador"("tenant_id", "estado");

-- CreateIndex
CREATE INDEX "objetivos_socios_tenant_id_cliente_id_activo_idx" ON "objetivos_socios"("tenant_id", "cliente_id", "activo");

-- CreateIndex
CREATE INDEX "ejercicios_tenant_id_grupo_muscular_activo_idx" ON "ejercicios"("tenant_id", "grupo_muscular", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "ejercicios_tenant_id_nombre_key" ON "ejercicios"("tenant_id", "nombre");

-- CreateIndex
CREATE INDEX "rutinas_tenant_id_estado_nombre_idx" ON "rutinas"("tenant_id", "estado", "nombre");

-- CreateIndex
CREATE INDEX "rutina_ejercicios_ejercicio_id_idx" ON "rutina_ejercicios"("ejercicio_id");

-- CreateIndex
CREATE UNIQUE INDEX "rutina_ejercicios_rutina_id_dia_orden_key" ON "rutina_ejercicios"("rutina_id", "dia", "orden");

-- CreateIndex
CREATE INDEX "planes_entrenamiento_tenant_id_estado_idx" ON "planes_entrenamiento"("tenant_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "fases_plan_plan_id_orden_key" ON "fases_plan"("plan_id", "orden");

-- CreateIndex
CREATE INDEX "asignaciones_entrenamiento_tenant_id_cliente_id_estado_idx" ON "asignaciones_entrenamiento"("tenant_id", "cliente_id", "estado");

-- CreateIndex
CREATE INDEX "sesiones_entrenamiento_tenant_id_cliente_id_iniciada_en_idx" ON "sesiones_entrenamiento"("tenant_id", "cliente_id", "iniciada_en");

-- CreateIndex
CREATE UNIQUE INDEX "ejercicios_sesion_sesion_id_orden_key" ON "ejercicios_sesion"("sesion_id", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "series_entrenamiento_ejercicio_sesion_id_numero_key" ON "series_entrenamiento"("ejercicio_sesion_id", "numero");

-- CreateIndex
CREATE INDEX "mediciones_corporales_tenant_id_cliente_id_fecha_idx" ON "mediciones_corporales"("tenant_id", "cliente_id", "fecha");

-- CreateIndex
CREATE INDEX "fotos_progreso_tenant_id_cliente_id_fecha_idx" ON "fotos_progreso"("tenant_id", "cliente_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_clase_tenant_id_nombre_key" ON "tipos_clase"("tenant_id", "nombre");

-- CreateIndex
CREATE INDEX "clases_tenant_id_sucursal_id_inicio_idx" ON "clases"("tenant_id", "sucursal_id", "inicio");

-- CreateIndex
CREATE INDEX "reservas_clase_tenant_id_cliente_id_estado_idx" ON "reservas_clase"("tenant_id", "cliente_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_clase_clase_id_cliente_id_key" ON "reservas_clase"("clase_id", "cliente_id");

-- CreateIndex
CREATE INDEX "movimientos_puntos_tenant_id_cliente_id_creado_en_idx" ON "movimientos_puntos"("tenant_id", "cliente_id", "creado_en");

-- CreateIndex
CREATE INDEX "premios_tenant_id_activo_idx" ON "premios"("tenant_id", "activo");

-- CreateIndex
CREATE INDEX "canjes_premio_tenant_id_cliente_id_creado_en_idx" ON "canjes_premio"("tenant_id", "cliente_id", "creado_en");

-- CreateIndex
CREATE INDEX "beneficios_tenant_id_activo_vigente_hasta_idx" ON "beneficios"("tenant_id", "activo", "vigente_hasta");

-- CreateIndex
CREATE INDEX "notificaciones_tenant_id_cliente_id_leida_en_creada_en_idx" ON "notificaciones"("tenant_id", "cliente_id", "leida_en", "creada_en");

-- CreateIndex
CREATE INDEX "_PerfilEntrenadorToSucursal_B_index" ON "_PerfilEntrenadorToSucursal"("B");

-- CreateIndex
CREATE INDEX "sucursales_tenant_id_estado_idx" ON "sucursales"("tenant_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "sucursales_tenant_id_nombre_key" ON "sucursales"("tenant_id", "nombre");

-- CreateIndex
CREATE INDEX "clientes_tenant_id_nombre_apellido_idx" ON "clientes"("tenant_id", "nombre", "apellido");

-- CreateIndex
CREATE INDEX "clientes_tenant_id_estado_idx" ON "clientes"("tenant_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_tenant_id_documento_key" ON "clientes"("tenant_id", "documento");

-- CreateIndex
CREATE INDEX "membresias_tenant_id_estado_idx" ON "membresias"("tenant_id", "estado");

-- CreateIndex
CREATE INDEX "pagos_tenant_id_fecha_pago_idx" ON "pagos"("tenant_id", "fecha_pago");

-- CreateIndex
CREATE INDEX "productos_tenant_id_nombre_idx" ON "productos"("tenant_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "productos_tenant_id_codigo_key" ON "productos"("tenant_id", "codigo");

-- CreateIndex
CREATE INDEX "ventas_tenant_id_fecha_venta_idx" ON "ventas"("tenant_id", "fecha_venta");

-- CreateIndex
CREATE INDEX "ingresos_tenant_id_fecha_hora_idx" ON "ingresos"("tenant_id", "fecha_hora");

-- CreateIndex
CREATE INDEX "usuarios_clientes_tenant_id_idx" ON "usuarios_clientes"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_clientes_tenant_id_usuario_key" ON "usuarios_clientes"("tenant_id", "usuario");

-- AddForeignKey
ALTER TABLE "tenant_usuarios" ADD CONSTRAINT "tenant_usuarios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_usuarios" ADD CONSTRAINT "tenant_usuarios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sucursales" ADD CONSTRAINT "sucursales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_sucursal_habitual_id_fkey" FOREIGN KEY ("sucursal_habitual_id") REFERENCES "sucursales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_entrenador_id_fkey" FOREIGN KEY ("entrenador_id") REFERENCES "perfiles_entrenador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresias" ADD CONSTRAINT "membresias_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_clientes" ADD CONSTRAINT "usuarios_clientes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_socios" ADD CONSTRAINT "sesiones_socios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_socios" ADD CONSTRAINT "sesiones_socios_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfiles_entrenador" ADD CONSTRAINT "perfiles_entrenador_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfiles_entrenador" ADD CONSTRAINT "perfiles_entrenador_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivos_socios" ADD CONSTRAINT "objetivos_socios_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivos_socios" ADD CONSTRAINT "objetivos_socios_entrenador_id_fkey" FOREIGN KEY ("entrenador_id") REFERENCES "perfiles_entrenador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejercicios" ADD CONSTRAINT "ejercicios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutinas" ADD CONSTRAINT "rutinas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutinas" ADD CONSTRAINT "rutinas_entrenador_id_fkey" FOREIGN KEY ("entrenador_id") REFERENCES "perfiles_entrenador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutina_ejercicios" ADD CONSTRAINT "rutina_ejercicios_rutina_id_fkey" FOREIGN KEY ("rutina_id") REFERENCES "rutinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutina_ejercicios" ADD CONSTRAINT "rutina_ejercicios_ejercicio_id_fkey" FOREIGN KEY ("ejercicio_id") REFERENCES "ejercicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_entrenamiento" ADD CONSTRAINT "planes_entrenamiento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fases_plan" ADD CONSTRAINT "fases_plan_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "planes_entrenamiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fases_plan" ADD CONSTRAINT "fases_plan_rutina_id_fkey" FOREIGN KEY ("rutina_id") REFERENCES "rutinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_entrenamiento" ADD CONSTRAINT "asignaciones_entrenamiento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_entrenamiento" ADD CONSTRAINT "asignaciones_entrenamiento_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_entrenamiento" ADD CONSTRAINT "asignaciones_entrenamiento_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "planes_entrenamiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_entrenamiento" ADD CONSTRAINT "asignaciones_entrenamiento_rutina_id_fkey" FOREIGN KEY ("rutina_id") REFERENCES "rutinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_entrenamiento" ADD CONSTRAINT "sesiones_entrenamiento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_entrenamiento" ADD CONSTRAINT "sesiones_entrenamiento_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_entrenamiento" ADD CONSTRAINT "sesiones_entrenamiento_asignacion_id_fkey" FOREIGN KEY ("asignacion_id") REFERENCES "asignaciones_entrenamiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_entrenamiento" ADD CONSTRAINT "sesiones_entrenamiento_rutina_id_fkey" FOREIGN KEY ("rutina_id") REFERENCES "rutinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejercicios_sesion" ADD CONSTRAINT "ejercicios_sesion_sesion_id_fkey" FOREIGN KEY ("sesion_id") REFERENCES "sesiones_entrenamiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejercicios_sesion" ADD CONSTRAINT "ejercicios_sesion_ejercicio_id_fkey" FOREIGN KEY ("ejercicio_id") REFERENCES "ejercicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_entrenamiento" ADD CONSTRAINT "series_entrenamiento_ejercicio_sesion_id_fkey" FOREIGN KEY ("ejercicio_sesion_id") REFERENCES "ejercicios_sesion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mediciones_corporales" ADD CONSTRAINT "mediciones_corporales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mediciones_corporales" ADD CONSTRAINT "mediciones_corporales_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mediciones_corporales" ADD CONSTRAINT "mediciones_corporales_entrenador_id_fkey" FOREIGN KEY ("entrenador_id") REFERENCES "perfiles_entrenador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_progreso" ADD CONSTRAINT "fotos_progreso_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_progreso" ADD CONSTRAINT "fotos_progreso_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_clase" ADD CONSTRAINT "tipos_clase_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases" ADD CONSTRAINT "clases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases" ADD CONSTRAINT "clases_tipo_clase_id_fkey" FOREIGN KEY ("tipo_clase_id") REFERENCES "tipos_clase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases" ADD CONSTRAINT "clases_entrenador_id_fkey" FOREIGN KEY ("entrenador_id") REFERENCES "perfiles_entrenador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases" ADD CONSTRAINT "clases_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_clase" ADD CONSTRAINT "reservas_clase_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_clase" ADD CONSTRAINT "reservas_clase_clase_id_fkey" FOREIGN KEY ("clase_id") REFERENCES "clases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_clase" ADD CONSTRAINT "reservas_clase_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_puntos" ADD CONSTRAINT "movimientos_puntos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_puntos" ADD CONSTRAINT "movimientos_puntos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "premios" ADD CONSTRAINT "premios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canjes_premio" ADD CONSTRAINT "canjes_premio_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canjes_premio" ADD CONSTRAINT "canjes_premio_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canjes_premio" ADD CONSTRAINT "canjes_premio_premio_id_fkey" FOREIGN KEY ("premio_id") REFERENCES "premios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficios" ADD CONSTRAINT "beneficios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PerfilEntrenadorToSucursal" ADD CONSTRAINT "_PerfilEntrenadorToSucursal_A_fkey" FOREIGN KEY ("A") REFERENCES "perfiles_entrenador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PerfilEntrenadorToSucursal" ADD CONSTRAINT "_PerfilEntrenadorToSucursal_B_fkey" FOREIGN KEY ("B") REFERENCES "sucursales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
