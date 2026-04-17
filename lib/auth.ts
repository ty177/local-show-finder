import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google, GitHub],
  callbacks: {
    jwt({ token, account, profile }) {
      // Persist the provider's user ID into the JWT
      if (account) {
        token.userId = `${account.provider}:${account.providerAccountId}`;
      }
      return token;
    },
    session({ session, token }) {
      // Expose userId to the client session
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
});
