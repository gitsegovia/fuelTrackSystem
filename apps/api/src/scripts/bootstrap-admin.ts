/**
 * bootstrap-admin.ts
 *
 * Crea la empresa y el primer usuario administrador en una instalación nueva.
 * Se ejecuta una sola vez; si ya existe un usuario ADMIN sale sin hacer nada.
 *
 * Uso en contenedor de desarrollo:
 *   docker compose exec api node --loader ts-node/esm \
 *     --experimental-specifier-resolution=node \
 *     src/scripts/bootstrap-admin.ts \
 *     -- --company "Mi Empresa" --username admin --password secreto123
 *
 * Uso en contenedor de producción (requiere imagen compilada):
 *   docker compose exec api node dist/scripts/bootstrap-admin.js \
 *     --company "Mi Empresa" --username admin --password secreto123
 */

import "../config/index.js";
import bcrypt from "bcryptjs";
import { models, sequelize } from "../models/index.js";
import { UserRole, UserType } from "../utils/types.js";

function parseArgs(): { company: string; username: string; password: string } {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const company = get("--company");
  const username = get("--username");
  const password = get("--password");

  if (!company || !username || !password) {
    console.error(
      "Uso: bootstrap-admin --company <nombre> --username <usuario> --password <clave>"
    );
    process.exit(1);
  }

  return { company, username, password };
}

async function main() {
  const { company: companyName, username, password } = parseArgs();

  await sequelize.authenticate();

  const existingAdmin = await models.User.findOne({
    where: { role: UserRole.ADMIN },
  });

  if (existingAdmin) {
    console.log(
      `Ya existe un usuario ADMIN (${existingAdmin.username}). No se creó nada.`
    );
    await sequelize.close();
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const company = await models.Company.create({
    name: companyName,
    address: "",
    phone: "",
    logo: "",
  });

  const user = await models.User.create({
    username,
    passwordHash,
    role: UserRole.ADMIN,
    userType: UserType.ADMINISTRATOR,
    companyId: company.id,
  });

  console.log(`✓ Empresa creada: "${company.name}" (id: ${company.id})`);
  console.log(`✓ Admin creado:   "${user.username}" (id: ${user.id})`);
  console.log("Ahora puedes iniciar sesión en el panel admin.");

  await sequelize.close();
}

main().catch((err) => {
  console.error("Error al crear el admin:", err.message ?? err);
  process.exit(1);
});
