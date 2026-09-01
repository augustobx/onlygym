import "server-only";
import { prisma } from "@/lib/prisma";

export async function checkBranchSchedule(sucursalId: number) {
  const now = new Date(); const diaSemana = now.getDay(); const horaActual = now.toTimeString().slice(0, 5);
  const config = await prisma.configuracionHorario.findUnique({ where: { sucursalId_diaSemana: { sucursalId, diaSemana } } });
  if (!config || !config.activo || config.tipoApertura === "cerrado") return { permitido: false, motivo: "El gimnasio se encuentra cerrado hoy.", diaSemana, horaActual };
  const first = Boolean(config.horaApertura1 && config.horaCierre1 && horaActual >= config.horaApertura1 && horaActual <= config.horaCierre1);
  const second = Boolean(config.horaApertura2 && config.horaCierre2 && horaActual >= config.horaApertura2 && horaActual <= config.horaCierre2);
  if (first || (config.tipoApertura === "doble" && second)) return { permitido: true, diaSemana, horaActual };
  return { permitido: false, motivo: `Fuera de horario de atención (${config.horaApertura1 || "--:--"} a ${config.horaCierre1 || "--:--"})`, diaSemana, horaActual };
}
