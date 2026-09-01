import { PrismaClient, RolTenant } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash as hashMemberPassword } from "bcryptjs";
import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const modulos = { socios: true, membresias: true, accesos: true, caja: true, entrenamiento: true, clases: true, mediciones: true, puntos: true, reportes: true };
const horarioLucas = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, activo: dia >= 1 && dia <= 5, desde: "08:00", hasta: "16:00" }));
const horarioMora = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, activo: dia >= 2 && dia <= 6, desde: "14:00", hasta: "22:00" }));

async function staff(email: string, name: string, username: string, nivel: string, rol: RolTenant, tenantId: number, sucursalIds: number[]) {
  const user = await prisma.user.upsert({ where: { email }, update: { name, username, nivel, estado: "activo" }, create: { email, name, username, nivel, estado: "activo", emailVerified: true } });
  const password = await hashPassword("OnlyGym2026!");
  const account = await prisma.account.findFirst({ where: { userId: user.id, providerId: "credential" } });
  if (account) await prisma.account.update({ where: { id: account.id }, data: { password, issuer: "local:credential" } });
  else await prisma.account.create({ data: { accountId: user.id, providerId: "credential", userId: user.id, password, issuer: "local:credential" } });
  await prisma.tenantUsuario.upsert({ where: { tenantId_userId: { tenantId, userId: user.id } }, update: { rol, estado: "activo" }, create: { tenantId, userId: user.id, rol } });
  await prisma.user.update({ where: { id: user.id }, data: { sucursales: { set: sucursalIds.map((id) => ({ id })) } } });
  return user;
}

async function main() {
  const tenant = await prisma.tenant.upsert({ where: { slug: "onlygym-demo" }, update: { nombre: "OnlyGym Demo", estado: "activo", plan: "profesional", modulos }, create: { nombre: "OnlyGym Demo", slug: "onlygym-demo", plan: "profesional", modulos } });
  const centro = await prisma.sucursal.upsert({ where: { tenantId_nombre: { tenantId: tenant.id, nombre: "Sede Centro" } }, update: { direccion: "Av. Corrientes 1234", capacidad: 90, estado: "activo" }, create: { tenantId: tenant.id, nombre: "Sede Centro", direccion: "Av. Corrientes 1234", capacidad: 90 } });
  const norte = await prisma.sucursal.upsert({ where: { tenantId_nombre: { tenantId: tenant.id, nombre: "Sede Norte" } }, update: { direccion: "Av. Maipú 2450", capacidad: 60, estado: "activo" }, create: { tenantId: tenant.id, nombre: "Sede Norte", direccion: "Av. Maipú 2450", capacidad: 60 } });
  const owner = await staff("admin@onlygym.local", "Martina Owner", "admin", "admin", RolTenant.OWNER, tenant.id, [centro.id, norte.id]);
  const sandboxTenant = await prisma.tenant.upsert({ where: { slug: "onlygym-sandbox" }, update: { nombre: "OnlyGym Sandbox", estado: "activo", modulos }, create: { nombre: "OnlyGym Sandbox", slug: "onlygym-sandbox", plan: "inicial", modulos } });
  await prisma.sucursal.upsert({ where: { tenantId_nombre: { tenantId: sandboxTenant.id, nombre: "Sede Sandbox" } }, update: { estado: "activo" }, create: { tenantId: sandboxTenant.id, nombre: "Sede Sandbox", direccion: "Entorno local de validación" } });
  await prisma.tenantUsuario.upsert({ where: { tenantId_userId: { tenantId: sandboxTenant.id, userId: owner.id } }, update: { rol: RolTenant.OWNER, estado: "activo" }, create: { tenantId: sandboxTenant.id, userId: owner.id, rol: RolTenant.OWNER } });
  await staff("recepcion@onlygym.local", "Sofía Recepción", "recepcion", "cajero", RolTenant.RECEPCION, tenant.id, [centro.id]);
  const coachUser = await staff("lucas@onlygym.local", "Lucas Entrenador", "lucas", "entrenador", RolTenant.ENTRENADOR, tenant.id, [centro.id]);
  const moraUser = await staff("mora@onlygym.local", "Mora Entrenadora", "mora", "entrenador", RolTenant.ENTRENADOR, tenant.id, [norte.id]);
  const coach = await prisma.perfilEntrenador.upsert({ where: { userId: coachUser.id }, update: { tenantId: tenant.id, bio: "Especialista en fuerza, hipertrofia y recomposición corporal.", especialidades: ["Fuerza", "Hipertrofia"], horarios: horarioLucas, estado: "activo", sucursales: { set: [{ id: centro.id }] } }, create: { tenantId: tenant.id, userId: coachUser.id, bio: "Especialista en fuerza, hipertrofia y recomposición corporal.", especialidades: ["Fuerza", "Hipertrofia"], horarios: horarioLucas, sucursales: { connect: [{ id: centro.id }] } } });
  const mora = await prisma.perfilEntrenador.upsert({ where: { userId: moraUser.id }, update: { tenantId: tenant.id, bio: "Entrenamiento funcional, movilidad y acompañamiento para principiantes.", especialidades: ["Movilidad", "Funcional"], horarios: horarioMora, estado: "activo", sucursales: { set: [{ id: norte.id }] } }, create: { tenantId: tenant.id, userId: moraUser.id, bio: "Entrenamiento funcional, movilidad y acompañamiento para principiantes.", especialidades: ["Movilidad", "Funcional"], horarios: horarioMora, sucursales: { connect: [{ id: norte.id }] } } });

  const planRows = [{ nombre: "Mensual", diasDuracion: 30, precio: 32000 }, { nombre: "Trimestral", diasDuracion: 90, precio: 85000 }, { nombre: "Pase diario", diasDuracion: 1, precio: 4500 }];
  const memberships = [];
  for (const row of planRows) {
    const found = await prisma.membresia.findFirst({ where: { tenantId: tenant.id, nombre: row.nombre } });
    memberships.push(found ? await prisma.membresia.update({ where: { id: found.id }, data: { ...row, estado: "activo" } }) : await prisma.membresia.create({ data: { tenantId: tenant.id, ...row, estado: "activo", sucursales: { connect: [{ id: centro.id }, { id: norte.id }] } } }));
  }

  const password = await hashMemberPassword("Socio2026!", 12);
  const memberRows = [["30111222", "Valentina", "Rossi"], ["32222333", "Tomás", "Paz"], ["34444555", "Camila", "Suárez"], ["36666777", "Julián", "Díaz"]] as const;
  const members: Array<{ id: number; documento: string }> = [];
  for (let memberIndex = 0; memberIndex < memberRows.length; memberIndex++) {
    const [documento, nombre, apellido] = memberRows[memberIndex]; const assignedTrainer = memberIndex < 2 ? coach : mora; const assignedBranch = memberIndex < 2 ? centro : norte;
    const member = await prisma.cliente.upsert({ where: { tenantId_documento: { tenantId: tenant.id, documento } }, update: { nombre, apellido, estado: "activo", entrenadorId: assignedTrainer.id, sucursalHabitualId: assignedBranch.id, sucursales: { set: [{ id: assignedBranch.id }] } }, create: { tenantId: tenant.id, documento, nombre, apellido, email: `${nombre.toLowerCase()}@example.com`, estado: "activo", entrenadorId: assignedTrainer.id, sucursalHabitualId: assignedBranch.id, sucursales: { connect: [{ id: assignedBranch.id }] } } });
    await prisma.usuarioCliente.upsert({ where: { clienteId: member.id }, update: { tenantId: tenant.id, usuario: documento, password, debeCambiarPassword: false }, create: { tenantId: tenant.id, clienteId: member.id, usuario: documento, password, debeCambiarPassword: false } });
    await prisma.cuentaCorriente.upsert({ where: { clienteId: member.id }, update: {}, create: { clienteId: member.id, limiteCredito: 15000 } });
    members.push(member);
  }
  const expiration = new Date(); expiration.setDate(expiration.getDate() + 24);
  for (const member of members) if (!await prisma.pago.findFirst({ where: { tenantId: tenant.id, clienteId: member.id } })) await prisma.pago.create({ data: { tenantId: tenant.id, clienteId: member.id, membresiaId: memberships[0].id, sucursalId: centro.id, monto: memberships[0].precio, fechaVencimiento: expiration, metodoPago: "transferencia" } });

  const exerciseRows = [["Sentadilla goblet", "Piernas", "Mancuerna", "Mantené el pecho alto y descendé controlando las rodillas."], ["Press de pecho", "Pecho", "Mancuernas", "Apoyá la espalda y empujá sin bloquear los codos."], ["Remo sentado", "Espalda", "Polea", "Llevá los codos hacia atrás sin elevar los hombros."], ["Peso muerto rumano", "Posterior", "Barra", "Mové la cadera hacia atrás manteniendo la espalda neutra."], ["Plancha frontal", "Core", "Peso corporal", "Alineá hombros, cadera y talones durante todo el tiempo."]] as const;
  const exercises = [];
  for (const [nombre, grupoMuscular, equipamiento, instrucciones] of exerciseRows) exercises.push(await prisma.ejercicio.upsert({ where: { tenantId_nombre: { tenantId: tenant.id, nombre } }, update: { grupoMuscular, equipamiento, instrucciones, activo: true }, create: { tenantId: tenant.id, nombre, grupoMuscular, equipamiento, instrucciones, dificultad: "Intermedio" } }));
  let routine = await prisma.rutina.findFirst({ where: { tenantId: tenant.id, nombre: "Full body inicial" } });
  if (!routine) routine = await prisma.rutina.create({ data: { tenantId: tenant.id, entrenadorId: coach.id, nombre: "Full body inicial", objetivo: "Fuerza general", nivel: "Inicial", duracionMinutos: 55, diasCantidad: 1, ejercicios: { create: exercises.map((exercise, index) => ({ ejercicioId: exercise.id, dia: 1, orden: index + 1, series: 3, repeticiones: index === 4 ? "30 segundos" : "10", descansoSegundos: 60 })) } } });
  for (let index = 0; index < exercises.length; index++) await prisma.rutinaEjercicio.updateMany({ where: { rutinaId: routine.id, ejercicioId: exercises[index].id }, data: { pesoSugerido: index === 4 ? null : 12 + index * 8, descansoSegundos: index === 4 ? 45 : 60, tiempoSegundos: index === 4 ? 30 : null, observaciones: index === 0 ? "Priorizá técnica y rango cómodo." : null } });
  let trainingPlan = await prisma.planEntrenamiento.findFirst({ where: { tenantId: tenant.id, nombre: "Fuerza progresiva · 12 semanas" } });
  if (!trainingPlan) trainingPlan = await prisma.planEntrenamiento.create({ data: { tenantId: tenant.id, nombre: "Fuerza progresiva · 12 semanas", descripcion: "Ciclo inicial con progresión controlada.", objetivo: "Aumentar fuerza", duracionSemanas: 12, fases: { create: [{ rutinaId: routine.id, orden: 1, semanaInicio: 1, semanaFin: 12 }] } } });
  const activeAssignment = await prisma.asignacionEntrenamiento.findFirst({ where: { tenantId: tenant.id, clienteId: members[0].id, estado: "activa" } });
  const assignment = activeAssignment ? await prisma.asignacionEntrenamiento.update({ where: { id: activeAssignment.id }, data: { planId: trainingPlan.id, rutinaId: null } }) : await prisma.asignacionEntrenamiento.create({ data: { tenantId: tenant.id, clienteId: members[0].id, planId: trainingPlan.id, fechaInicio: new Date() } });
  if (!await prisma.objetivoSocio.findFirst({ where: { tenantId: tenant.id, clienteId: members[0].id } })) await prisma.objetivoSocio.create({ data: { tenantId: tenant.id, clienteId: members[0].id, entrenadorId: coach.id, tipo: "Ganar fuerza", principal: true } });
  if (!await prisma.medicionCorporal.findFirst({ where: { tenantId: tenant.id, clienteId: members[0].id } })) await prisma.medicionCorporal.createMany({ data: [{ tenantId: tenant.id, clienteId: members[0].id, entrenadorId: coach.id, fecha: new Date(Date.now() - 45 * 86400000), peso: 68.4, altura: 168, imc: 24.23, grasa: 26.2 }, { tenantId: tenant.id, clienteId: members[0].id, entrenadorId: coach.id, fecha: new Date(Date.now() - 8 * 86400000), peso: 66.9, altura: 168, imc: 23.7, grasa: 24.8 }] });

  const types = [];
  for (const row of [{ nombre: "Funcional", color: "#b7f34a" }, { nombre: "Yoga", color: "#a78bfa" }, { nombre: "Spinning", color: "#38bdf8" }]) types.push(await prisma.tipoClase.upsert({ where: { tenantId_nombre: { tenantId: tenant.id, nombre: row.nombre } }, update: { ...row, activo: true }, create: { tenantId: tenant.id, ...row } }));
  const demoClasses = [];
  for (let index = 0; index < types.length; index++) { const inicio = new Date(); inicio.setDate(inicio.getDate() + index + 1); inicio.setHours(18 + index, 0, 0, 0); const found = await prisma.clase.findFirst({ where: { tenantId: tenant.id, tipoClaseId: types[index].id, inicio } }); const classData = { entrenadorId: index === 1 ? mora.id : coach.id, sucursalId: index === 1 ? norte.id : centro.id, sala: `Sala ${index + 1}`, duracionMinutos: 50, cupoMaximo: index === 2 ? 2 : 16, estado: "programada" }; demoClasses.push(found ? await prisma.clase.update({ where: { id: found.id }, data: classData }) : await prisma.clase.create({ data: { tenantId: tenant.id, tipoClaseId: types[index].id, inicio, ...classData } })); }
  const nextClass = await prisma.clase.findFirst({ where: { tenantId: tenant.id, inicio: { gte: new Date() } }, orderBy: { inicio: "asc" } });
  if (nextClass) await prisma.reservaClase.upsert({ where: { claseId_clienteId: { claseId: nextClass.id, clienteId: members[0].id } }, update: { estado: "confirmada", canceladaEn: null }, create: { tenantId: tenant.id, claseId: nextClass.id, clienteId: members[0].id, estado: "confirmada" } });
  const limitedClass = demoClasses[2];
  if (limitedClass) for (let index = 0; index < members.length; index++) await prisma.reservaClase.upsert({ where: { claseId_clienteId: { claseId: limitedClass.id, clienteId: members[index].id } }, update: { estado: index < 2 ? "confirmada" : "espera", posicionEspera: index < 2 ? null : index - 1, canceladaEn: null }, create: { tenantId: tenant.id, claseId: limitedClass.id, clienteId: members[index].id, estado: index < 2 ? "confirmada" : "espera", posicionEspera: index < 2 ? null : index - 1 } });
  for (const [daysAgo, estado] of [[5, "asistio"], [12, "cancelada"]] as const) { const inicio = new Date(); inicio.setDate(inicio.getDate() - daysAgo); inicio.setHours(19, 0, 0, 0); let pastClass = await prisma.clase.findFirst({ where: { tenantId: tenant.id, tipoClaseId: types[0].id, inicio } }); if (!pastClass) pastClass = await prisma.clase.create({ data: { tenantId: tenant.id, tipoClaseId: types[0].id, entrenadorId: coach.id, sucursalId: centro.id, sala: "Sala 1", inicio, duracionMinutos: 50, cupoMaximo: 16 } }); await prisma.reservaClase.upsert({ where: { claseId_clienteId: { claseId: pastClass.id, clienteId: members[0].id } }, update: { estado, asistenciaEn: estado === "asistio" ? inicio : null, canceladaEn: estado === "cancelada" ? inicio : null }, create: { tenantId: tenant.id, claseId: pastClass.id, clienteId: members[0].id, estado, asistenciaEn: estado === "asistio" ? inicio : null, canceladaEn: estado === "cancelada" ? inicio : null } }); }
  if (!await prisma.ingreso.findFirst({ where: { tenantId: tenant.id, clienteId: members[0].id } })) {
    await prisma.ingreso.createMany({ data: Array.from({ length: 6 }, (_, index) => { const fechaHora = new Date(Date.now() - (index + 1) * 3 * 86400000); fechaHora.setHours(18, 15, 0, 0); return { tenantId: tenant.id, clienteId: members[0].id, sucursalId: centro.id, documento: members[0].documento, fechaHora, horaSalida: new Date(fechaHora.getTime() + 75 * 60000), duracionMinutos: 75, estado: "ACTIVO" }; }) });
  }
  await prisma.ingreso.updateMany({ where: { tenantId: tenant.id, clienteId: members[0].id, estado: "permitido" }, data: { estado: "ACTIVO" } });
  if (!await prisma.sesionEntrenamiento.findFirst({ where: { tenantId: tenant.id, clienteId: members[0].id, estado: "finalizada" } })) {
    await prisma.sesionEntrenamiento.create({ data: { tenantId: tenant.id, clienteId: members[0].id, asignacionId: assignment.id, rutinaId: routine.id, diaRutina: 1, iniciadaEn: new Date(Date.now() - 4 * 86400000), finalizadaEn: new Date(Date.now() - 4 * 86400000 + 52 * 60000), duracionMinutos: 52, cumplimiento: 100, estado: "finalizada", comentario: "Buena sesión, cargas controladas.", ejercicios: { create: exercises.slice(0, 3).map((exercise, index) => ({ ejercicioId: exercise.id, orden: index + 1, seriesObjetivo: 3, repeticionesObjetivo: "10", pesoSugerido: 20 + index * 10, descansoSegundos: 60, series: { create: [1, 2, 3].map((numero) => ({ numero, peso: 20 + index * 10, repeticiones: 10, esfuerzoPercibido: 7 + (numero === 3 ? 1 : 0), completada: true })) } })) } } });
  }
  if (!await prisma.movimientoPuntos.findFirst({ where: { tenantId: tenant.id, clienteId: members[0].id } })) await prisma.movimientoPuntos.createMany({ data: [{ tenantId: tenant.id, clienteId: members[0].id, puntos: 100, tipo: "bienvenida", concepto: "Bienvenida a OnlyGym" }, { tenantId: tenant.id, clienteId: members[0].id, puntos: 20, tipo: "entrenamiento", concepto: "Entrenamiento completado" }] });
  for (const row of [{ nombre: "Batido proteico", puntos: 250, stock: 20 }, { nombre: "Invitación para un amigo", puntos: 500, stock: 10 }]) if (!await prisma.premio.findFirst({ where: { tenantId: tenant.id, nombre: row.nombre } })) await prisma.premio.create({ data: { tenantId: tenant.id, ...row } });
  if (!await prisma.beneficio.findFirst({ where: { tenantId: tenant.id, titulo: "20% en indumentaria" } })) await prisma.beneficio.create({ data: { tenantId: tenant.id, titulo: "20% en indumentaria", descripcion: "Descuento exclusivo presentando tu credencial digital.", comercio: "OnlyFit Store" } });
  if (!await prisma.notificacion.findFirst({ where: { tenantId: tenant.id, clienteId: members[0].id, tipo: "bienvenida" } })) await prisma.notificacion.create({ data: { tenantId: tenant.id, clienteId: members[0].id, tipo: "bienvenida", titulo: "¡Bienvenida a OnlyGym!", mensaje: "Tu rutina y próximas clases ya están disponibles." } });
  console.log(`OnlyGym Demo listo (${tenant.slug}, owner ${owner.email})`);
  console.log("Admin: admin@onlygym.local / OnlyGym2026!");
  console.log("Socio: 30111222 / Socio2026!");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); await pool.end(); });
