export type TrainerCredentialMessageInput = {
  name: string;
  username?: string | null;
  email: string;
  password: string;
  loginUrl: string;
};

export function buildTrainerCredentialMessage({ name, username, email, password, loginUrl }: TrainerCredentialMessageInput) {
  const access = username || email;
  return [
    `Hola ${name},`,
    "",
    "Estas son tus credenciales de acceso a OnlyGym:",
    `Usuario: ${access}`,
    `Email: ${email}`,
    `Clave temporal: ${password}`,
    `Acceso: ${loginUrl}`,
    "",
    "Guardá estos datos y cambiá la clave cuando ingreses.",
  ].join("\n");
}
