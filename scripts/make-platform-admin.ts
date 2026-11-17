// Grant (or revoke) the platform admin profile to a user who already signed in with Google.
//   npm run user:admin -- someone@gmail.com
//   npm run user:admin -- someone@gmail.com --revoke
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email) {
    console.error("Uso: npm run user:admin -- <email> [--revoke]");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    console.error(`No existe un usuario con ${email}. Tiene que ingresar con Google al menos una vez.`);
    process.exitCode = 1;
    return;
  }

  const platformRole = flag === "--revoke" ? "NONE" : "PLATFORM_ADMIN";
  await prisma.user.update({ where: { id: user.id }, data: { platformRole } });
  console.log(`${user.email} -> ${platformRole}`);
}

main().finally(() => prisma.$disconnect());
