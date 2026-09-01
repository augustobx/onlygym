# OnlyGym

SaaS multi-tenant para administrar gimnasios y conectar la operación diaria con la experiencia móvil del socio.

## Qué incluye

- Gestión por gimnasio y múltiples sedes con roles `OWNER`, `ADMIN`, `RECEPCION` y `ENTRENADOR`.
- Socios, membresías, cobros, cuenta corriente, inventario, POS, accesos y aforo.
- Biblioteca de ejercicios, rutinas reutilizables, planes y sesiones con registro de series.
- Planificación progresiva por fases, asignaciones con historial y objetivos trazables del socio.
- Entrenamiento móvil guiado por día, registro por serie, descansos, historial y progresión de cargas.
- Clases con cupos reales, reservas, cancelación y lista de espera.
- Mediciones corporales, objetivos, puntos, premios, beneficios y notificaciones.
- Portal PWA móvil para el socio, con sesión opaca y contraseñas cifradas.
- Módulos habilitables por tenant y validación obligatoria en backend.
- Selección segura de gimnasio para usuarios multi-tenant, auditoría y revocación de sesiones.
- Recuperación de contraseña por correo con cierre automático de sesiones anteriores.

## Inicio local con Docker

Requiere Docker Desktop. El entorno usa solamente `127.0.0.1:3001` y `127.0.0.1:55432`; no incluye proxy inverso ni publica la base en la red.

```bash
docker compose up -d
```

Abrir [http://localhost:3001](http://localhost:3001). El contenedor aplica las migraciones y carga una semilla idempotente antes de iniciar la web. Los correos locales se consultan en [http://localhost:8025](http://localhost:8025).

Credenciales demo:

- Administración: `admin` / `OnlyGym2026!`
- Entrenador: `lucas` / `OnlyGym2026!`
- Portal de socio: `30111222` / `Socio2026!`

El administrador demo pertenece a `OnlyGym Demo` y `OnlyGym Sandbox`, lo que permite probar el selector multi-gimnasio.

Para detenerlo:

```bash
docker compose down
```

Los datos locales persisten en el volumen `onlygym-local_onlygym_pgdata`. Para una instalación limpia de desarrollo, eliminar ese volumen de forma explícita después de detener el proyecto.

## Desarrollo sin Docker para la web

Crear `.env` desde `.env.example`, apuntar `DATABASE_URL` a PostgreSQL y ejecutar:

```bash
npm install
npm run db:deploy
npm run db:seed
npm run dev -- --webpack
```

Comprobaciones principales:

```bash
npx prisma validate
npx tsc --noEmit
npm test
npm run build
```

## Migraciones y actualización desde GymLink

Las migraciones están versionadas en `prisma/migrations`. Una base nueva aplica primero el esquema heredado y luego la base SaaS de OnlyGym.

Para adoptar una base GymLink existente: hacer backup, verificar que corresponde exactamente al esquema heredado, marcar únicamente la migración baseline como aplicada y después ejecutar `npm run db:deploy`. No usar `prisma db push` en producción. El procedimiento detallado está en [docs/operations.md](docs/operations.md).

## Producción

`docker-compose.prod.yml` exige contraseñas y secretos explícitos; no contiene valores productivos de respaldo ni carga datos demo. La web escucha en loopback para quedar detrás del proxy HTTPS administrado por el hosting.

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Antes de desplegar, revisar [docs/operations.md](docs/operations.md), guardar un backup verificable y ejecutar el despliegue desde una copia controlada del repositorio.
