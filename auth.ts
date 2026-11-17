import NextAuth from "next-auth"
import type { DefaultSession } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"

import { authenticatePassword, linkGoogleAccount } from "@/lib/auth/accounts"

import { authConfig } from "./auth.config"

const googleReady = Boolean(process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim())

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    ...(googleReady
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email : ""
        const password = typeof credentials?.password === "string" ? credentials.password : ""
        const user = await authenticatePassword({ email, password })
        if (!user) return null
        return { id: user.id, email: user.email, name: user.name, businessName: user.businessName }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true
      const email = user.email ?? ""
      const verifiedFlag = (profile as { email_verified?: boolean | string } | undefined)?.email_verified
      const verified = verifiedFlag === true || verifiedFlag === "true"
      const linked = await linkGoogleAccount({
        email,
        emailVerified: verified,
        name: user.name,
        googleId: account.providerAccountId,
      })
      if (!linked.ok) return false
      user.id = linked.user.id
      return true
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id
      const claims = token as typeof token & { businessName?: string }
      if (user && "businessName" in user && typeof user.businessName === "string") claims.businessName = user.businessName
      return claims
    },
    async session({ session, token }) {
      const claims = token as typeof token & { businessName?: string }
      if (session.user) {
        session.user.id = token.sub ?? ""
        session.user.businessName = claims.businessName ?? ""
      }
      return session
    },
  },
})

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      businessName?: string
    } & DefaultSession["user"]
  }

  interface User {
    businessName?: string
  }
}

