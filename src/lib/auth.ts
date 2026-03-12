import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const settings = await prisma.settings.findFirst();
        if (!settings?.email || !settings?.passwordHash) return null;

        if (credentials.email.toLowerCase() !== settings.email.toLowerCase()) {
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password,
          settings.passwordHash,
        );
        if (!valid) return null;

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
