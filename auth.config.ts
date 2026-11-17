import type { NextAuthConfig } from "next-auth"

/** Edge-safe gate. Demo and preview stay open. Production /app requires a session. */
function demoOpen(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL_ENV === "production") return false
  if (env.VERCEL_ENV === "preview") return true
  if (env.NODE_ENV === "production") return false
  const flag = env.DEMO_MODE?.trim().toLowerCase()
  return flag === "1" || flag === "true"
}

export const authConfig = {
  trustHost: true,
  pages: { signIn: "/sign-in" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname
      if (!path.startsWith("/app")) return true
      if (demoOpen()) return true
      return !!auth?.user
    },
  },
} satisfies NextAuthConfig
