# Operación y arquitectura de OnlyGym

## Límites de seguridad

Cada entidad operativa principal lleva `tenantId` sin valor predeterminado. El servidor obtiene el tenant desde la membresía del usuario autenticado o desde la sesión opaca del socio; nunca acepta un tenant enviado por el navegador. Si un empleado pertenece a varios gimnasios debe seleccionar uno y esa pertenencia se valida antes de emitir la cookie `onlygym_active_tenant`. La sucursal activa se guarda en otra cookie `httpOnly` y se vuelve a comprobar contra el tenant y el rol.

El portal de socios resuelve el tenant mediante `TENANT_HOST_MAP` o un subdominio directo de `TENANT_BASE_DOMAIN`. `DEFAULT_TENANT_SLUG` sólo funciona en localhost fuera de producción. Un host productivo desconocido falla cerrado.

Las credenciales administrativas usan el algoritmo de Better Auth. Las credenciales de socios usan bcrypt. La cookie del portal contiene un token aleatorio; la base guarda únicamente su SHA-256 y fecha de expiración. Las APIs físicas requieren `Authorization: Bearer <API_SECRET_KEY>` y no aceptan claves en la URL.

Los módulos configurables se guardan en `Tenant.modulos`. Las acciones de entrenamiento, clases, mediciones, puntos y otros dominios sensibles validan el módulo en backend, además de la navegación visual.

Las acciones sensibles registran auditoría sin tokens, cookies, secretos ni contraseñas. Owners y administradores pueden consultar el registro y cerrar sesiones desde `/dashboard/seguridad`.

La recuperación de contraseña usa tokens de un solo uso con una hora de vigencia y revoca las sesiones anteriores. Requiere `SMTP_HOST`, `SMTP_PORT` y `SMTP_FROM`; `SMTP_USER` y `SMTP_PASSWORD` son opcionales según el servidor. Docker local incluye Mailpit en `127.0.0.1:8025`.

## Adopción de una base heredada

1. Detener escrituras y generar un backup completo comprobable.
2. Comparar tablas y columnas con `prisma/migrations/2026083001_baseline/migration.sql`.
3. En la base correcta, marcar la baseline como aplicada: `npx prisma migrate resolve --applied 2026083001_baseline`.
4. Ejecutar `npm run db:deploy` para aplicar las migraciones SaaS y de seguridad posteriores.
5. Verificar tenant inicial, relaciones, conteos de socios/pagos/accesos y acceso de cada rol.
6. Ejecutar la semilla únicamente si se desean datos demo. No es un paso obligatorio para una migración real.

Nunca ejecutar este procedimiento sin confirmar host, puerto, nombre de base y backup. No usar `migrate reset` ni `db push` sobre datos reales.

## Checklist de despliegue

- Definir `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` y `API_SECRET_KEY` con valores únicos.
- Configurar `BETTER_AUTH_TRUSTED_ORIGINS`, `TENANT_BASE_DOMAIN`/`TENANT_HOST_MAP` y las variables SMTP.
- Validar `docker compose ... config` antes de arrancar.
- Confirmar que PostgreSQL no publique un puerto externo y que la app sólo escuche en loopback detrás del proxy.
- Aplicar migraciones mediante el servicio `migrate` y revisar sus logs antes de habilitar tráfico.
- Ejecutar `npm test` con `DATABASE_URL` para incluir los intentos IDOR contra PostgreSQL.
- Comprobar `/api/health`, login administrativo, selección de gimnasio y sede, recuperación de contraseña, portal del socio y una consulta de cada módulo habilitado.
- Mantener backups automáticos, rotación, restauración ensayada y monitoreo de disco, memoria, reinicios y respuestas 5xx.

## Plan de retorno

Si una versión falla, retirar tráfico de la web nueva y volver a la imagen anterior sin borrar el volumen. Las migraciones de estructura no deben revertirse de forma automática: restaurar el backup en una base separada, validar integridad y recién entonces cambiar la conexión. Registrar hora, versión, síntomas y decisión tomada.
