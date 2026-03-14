import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Google from 'next-auth/providers/google'
import Resend from 'next-auth/providers/resend'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import type { UserRole } from '@/lib/constants'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
      email: string
      name?: string | null
      image?: string | null
    }
  }
}

const DEV_PASSWORD = process.env.DEV_TEST_PASSWORD ?? 'test123'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      id: 'credentials',
      name: 'Test Account',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        if (credentials.password !== DEV_PASSWORD) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          select: { id: true, email: true, name: true, image: true, role: true, isBanned: true },
        })
        if (!user || user.isBanned) return null
        return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role }
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
    }),
    Resend({
      from: process.env.EMAIL_FROM ?? 'noreply@eduscore.lb',
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user, account }: any) {
      if (user) {
        token.id = user.id
        if (user.role) token.role = user.role
      }
      if (account && !token.role) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { id: true, role: true, isBanned: true },
        })
        if (dbUser?.isBanned) {
          token.id = ''
          token.role = 'STUDENT'
        } else {
          token.id = dbUser?.id ?? token.sub
          token.role = dbUser?.role ?? 'STUDENT'
        }
      }
      return token
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: any) {
      session.user.id = token.id ?? token.sub ?? ''
      session.user.role = token.role ?? 'STUDENT'
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  events: {
    async signIn({ user }) {
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        }).catch(() => {})
      }
    },
  },
  trustHost: true,
})
