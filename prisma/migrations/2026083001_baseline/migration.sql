-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "sucursales" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "direccion" VARCHAR(255),
    "estado" TEXT NOT NULL DEFAULT 'activo',

    CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "displayUsername" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nivel" TEXT NOT NULL DEFAULT 'cajero',
    "estado" TEXT NOT NULL DEFAULT 'activo',

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "issuer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "documento" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,
    "telefono" VARCHAR(20),
    "email" VARCHAR(100),
    "direccion" VARCHAR(255),
    "foto" TEXT,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'activo',

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membresias" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "dias_duracion" INTEGER NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',

    CONSTRAINT "membresias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "membresia_id" INTEGER NOT NULL,
    "sucursal_id" INTEGER,
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" DATE NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "metodo_pago" TEXT DEFAULT 'efectivo',
    "estado" TEXT NOT NULL DEFAULT 'pagado',
    "notas" TEXT,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(50),
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 5,
    "categoria" VARCHAR(50),
    "imagen" VARCHAR(255),
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" SERIAL NOT NULL,
    "sucursal_id" INTEGER,
    "cliente_id" INTEGER,
    "tipo_pago" TEXT NOT NULL DEFAULT 'efectivo',
    "estado_pago" TEXT NOT NULL DEFAULT 'pagado',
    "metodo_pago" TEXT,
    "fecha_venta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(10,2) NOT NULL,
    "user_id" TEXT,
    "notas" TEXT,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta_items" (
    "id" SERIAL NOT NULL,
    "venta_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "venta_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingresos" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "sucursal_id" INTEGER,
    "documento" VARCHAR(20) NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hora_salida" TIMESTAMP(3),
    "duracion_minutos" INTEGER,
    "dias_vencido" INTEGER,
    "estado" TEXT NOT NULL,
    "motivo" VARCHAR(255),

    CONSTRAINT "ingresos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_clientes" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "usuario" VARCHAR(20) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "debe_cambiar_password" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),

    CONSTRAINT "usuarios_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuenta_corriente" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "saldo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "limite_credito" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "cuenta_corriente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuenta_movimientos" (
    "id" SERIAL NOT NULL,
    "cuenta_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "concepto" VARCHAR(255),
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_admin_id" TEXT,

    CONSTRAINT "cuenta_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_horarios" (
    "id" SERIAL NOT NULL,
    "sucursal_id" INTEGER,
    "dia_semana" INTEGER NOT NULL,
    "tipo_apertura" TEXT NOT NULL DEFAULT 'completo',
    "hora_apertura_1" VARCHAR(10),
    "hora_cierre_1" VARCHAR(10),
    "hora_apertura_2" VARCHAR(10),
    "hora_cierre_2" VARCHAR(10),
    "capacidad_maxima" INTEGER DEFAULT 50,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "configuracion_horarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SucursalToUser" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SucursalToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ClienteToSucursal" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ClienteToSucursal_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_MembresiaToSucursal" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_MembresiaToSucursal_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ProductoToSucursal" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ProductoToSucursal_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_documento_key" ON "clientes"("documento");

-- CreateIndex
CREATE INDEX "clientes_documento_idx" ON "clientes"("documento");

-- CreateIndex
CREATE INDEX "clientes_nombre_apellido_idx" ON "clientes"("nombre", "apellido");

-- CreateIndex
CREATE INDEX "pagos_cliente_id_idx" ON "pagos"("cliente_id");

-- CreateIndex
CREATE INDEX "pagos_fecha_vencimiento_idx" ON "pagos"("fecha_vencimiento");

-- CreateIndex
CREATE INDEX "pagos_sucursal_id_idx" ON "pagos"("sucursal_id");

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigo_key" ON "productos"("codigo");

-- CreateIndex
CREATE INDEX "productos_codigo_idx" ON "productos"("codigo");

-- CreateIndex
CREATE INDEX "productos_nombre_idx" ON "productos"("nombre");

-- CreateIndex
CREATE INDEX "ventas_fecha_venta_idx" ON "ventas"("fecha_venta");

-- CreateIndex
CREATE INDEX "ventas_sucursal_id_idx" ON "ventas"("sucursal_id");

-- CreateIndex
CREATE INDEX "ventas_cliente_id_idx" ON "ventas"("cliente_id");

-- CreateIndex
CREATE INDEX "venta_items_venta_id_idx" ON "venta_items"("venta_id");

-- CreateIndex
CREATE INDEX "ingresos_fecha_hora_idx" ON "ingresos"("fecha_hora");

-- CreateIndex
CREATE INDEX "ingresos_hora_salida_idx" ON "ingresos"("hora_salida");

-- CreateIndex
CREATE INDEX "ingresos_cliente_id_idx" ON "ingresos"("cliente_id");

-- CreateIndex
CREATE INDEX "ingresos_sucursal_id_idx" ON "ingresos"("sucursal_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_clientes_cliente_id_key" ON "usuarios_clientes"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_clientes_usuario_key" ON "usuarios_clientes"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "cuenta_corriente_cliente_id_key" ON "cuenta_corriente"("cliente_id");

-- CreateIndex
CREATE INDEX "cuenta_movimientos_cuenta_id_idx" ON "cuenta_movimientos"("cuenta_id");

-- CreateIndex
CREATE INDEX "cuenta_movimientos_fecha_idx" ON "cuenta_movimientos"("fecha");

-- CreateIndex
CREATE INDEX "configuracion_horarios_sucursal_id_idx" ON "configuracion_horarios"("sucursal_id");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_horarios_sucursal_id_dia_semana_key" ON "configuracion_horarios"("sucursal_id", "dia_semana");

-- CreateIndex
CREATE INDEX "_SucursalToUser_B_index" ON "_SucursalToUser"("B");

-- CreateIndex
CREATE INDEX "_ClienteToSucursal_B_index" ON "_ClienteToSucursal"("B");

-- CreateIndex
CREATE INDEX "_MembresiaToSucursal_B_index" ON "_MembresiaToSucursal"("B");

-- CreateIndex
CREATE INDEX "_ProductoToSucursal_B_index" ON "_ProductoToSucursal"("B");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_membresia_id_fkey" FOREIGN KEY ("membresia_id") REFERENCES "membresias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_clientes" ADD CONSTRAINT "usuarios_clientes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_corriente" ADD CONSTRAINT "cuenta_corriente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_movimientos" ADD CONSTRAINT "cuenta_movimientos_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuenta_corriente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_movimientos" ADD CONSTRAINT "cuenta_movimientos_usuario_admin_id_fkey" FOREIGN KEY ("usuario_admin_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion_horarios" ADD CONSTRAINT "configuracion_horarios_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SucursalToUser" ADD CONSTRAINT "_SucursalToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "sucursales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SucursalToUser" ADD CONSTRAINT "_SucursalToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClienteToSucursal" ADD CONSTRAINT "_ClienteToSucursal_A_fkey" FOREIGN KEY ("A") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClienteToSucursal" ADD CONSTRAINT "_ClienteToSucursal_B_fkey" FOREIGN KEY ("B") REFERENCES "sucursales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MembresiaToSucursal" ADD CONSTRAINT "_MembresiaToSucursal_A_fkey" FOREIGN KEY ("A") REFERENCES "membresias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MembresiaToSucursal" ADD CONSTRAINT "_MembresiaToSucursal_B_fkey" FOREIGN KEY ("B") REFERENCES "sucursales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductoToSucursal" ADD CONSTRAINT "_ProductoToSucursal_A_fkey" FOREIGN KEY ("A") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductoToSucursal" ADD CONSTRAINT "_ProductoToSucursal_B_fkey" FOREIGN KEY ("B") REFERENCES "sucursales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
