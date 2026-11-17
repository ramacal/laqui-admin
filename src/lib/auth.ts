import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

// Google SSO only. Anyone with a Google account can sign up; access to an agency
// comes from an AgencyEmployee row whose email matches the Google email.
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "mysql" }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      prompt: "select_account",
    },
  },
  user: {
    additionalFields: {
      platformRole: { type: "string", input: false, defaultValue: "NONE" },
      active: { type: "boolean", input: false, defaultValue: true },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await linkEmployeeRecords(user.id, user.email);
        },
      },
    },
    session: {
      create: {
        // Also link on every sign-in, for employees registered after the user signed up.
        after: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId } });
          if (user) await linkEmployeeRecords(user.id, user.email);
        },
      },
    },
  },
  plugins: [nextCookies()],
});

// Attach unlinked employee records with the same email to this user.
async function linkEmployeeRecords(userId: string, email: string) {
  await prisma.agencyEmployee.updateMany({
    where: { email: email.toLowerCase(), userId: null },
    data: { userId },
  });
}

export type Session = typeof auth.$Infer.Session;
