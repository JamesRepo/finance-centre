import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { getClientIp, logFailedLoginAttempt } from "./auth-rate-limit";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const ip = getClientIp(req.headers);

        if (!credentials?.email || !credentials?.password) {
          logFailedLoginAttempt(ip, "missing_credentials");
          return null;
        }

        const settings = await prisma.settings.findFirst();
        if (!settings?.email || !settings?.passwordHash) {
          logFailedLoginAttempt(ip, "auth_not_configured");
          return null;
        }

        if (credentials.email.toLowerCase() !== settings.email.toLowerCase()) {
          logFailedLoginAttempt(ip, "invalid_email");
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password,
          settings.passwordHash,
        );
        if (!valid) {
          logFailedLoginAttempt(ip, "invalid_password");
          return null;
        }

        return { id: "1", email: settings.email };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
