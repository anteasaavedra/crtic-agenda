/**
 * Seed de base de datos — CRTIC Agenda
 *
 * Crea el usuario administrador inicial si no existe.
 *
 * Credenciales por defecto:
 *   Email:      admin@crtic.cl
 *   Contraseña: crtic-admin-2024!
 *
 * ⚠️  IMPORTANTE: Cambia la contraseña en producción antes del primer uso.
 *     (La gestión de contraseñas para admin quedará en la Etapa 6.)
 *
 * Ejecutar con:
 *   npm run prisma:seed
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const ADMIN_EMAIL = "admin@crtic.cl";
  const ADMIN_PASSWORD = "crtic-admin-2024!";

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      name: "Administrador CRTIC",
      role: "ADMIN",
      passwordHash: hash,
    },
  });

  console.log("✅ Admin listo:", admin.email);
  console.log("   Contraseña inicial: crtic-admin-2024!");
  console.log("   ⚠️  Cámbiala antes de usar en producción.");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
