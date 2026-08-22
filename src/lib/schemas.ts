import { z } from "zod";

export const clienteSchema = z.object({
  sucursalesIds: z.array(z.number().int()).min(1, "Debe seleccionar al menos una sucursal"),
  documento: z.string().min(5, "El documento debe tener al menos 5 caracteres"),
  nombre: z.string().min(2, "El nombre es obligatorio"),
  apellido: z.string().min(2, "El apellido es obligatorio"),
  telefono: z.string().optional(),
  email: z.string().email("Correo electrónico inválido").optional().or(z.literal("")),
  direccion: z.string().optional(),
  foto: z.string().optional(),
  estado: z.enum(["activo", "inactivo"]).default("activo"),
});

export type ClienteData = z.infer<typeof clienteSchema>;

export const membresiaSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  diasDuracion: z.number().int().positive("Debe ser un número mayor a 0"),
  precio: z.number().positive("El precio debe ser mayor a 0"),
  descripcion: z.string().optional(),
  estado: z.enum(["activo", "inactivo"]).default("activo"),
});

export type MembresiaData = z.infer<typeof membresiaSchema>;

export const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export type LoginData = z.infer<typeof loginSchema>;
