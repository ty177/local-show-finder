import NextAuth from "next-auth";
import Spotify from "next-auth/providers/spotify";

const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-library-read",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

async function refreshSpotifyToken(refreshToken: string) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.AUTH_SPOTIFY_ID}:${process.env.AUTH_SPOTIFY_SECRET}`
        ).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error("Failed to refresh Spotify token");
  return res.json();
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Spotify({
      authorization: {
        url: "https://accounts.spotify.com/authorize",
        params: { scope: SPOTIFY_SCOPES },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // On initial sign-in, persist tokens + userId
      if (account) {
        token.userId = `spotify:${account.providerAccountId}`;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = (account.expires_at as number) * 1000;
        return token;
      }

      // If token still valid, use it
      if (
        typeof token.expiresAt === "number" &&
        Date.now() < token.expiresAt - 60_000
      ) {
        return token;
      }

      // Otherwise refresh the Spotify access token
      if (token.refreshToken) {
        try {
          const refreshed = await refreshSpotifyToken(
            token.refreshToken as string
          );
          token.accessToken = refreshed.access_token;
          token.expiresAt = Date.now() + refreshed.expires_in * 1000;
          if (refreshed.refresh_token) {
            token.refreshToken = refreshed.refresh_token;
          }
        } catch {
          // Invalidate if refresh fails
          token.error = "RefreshAccessTokenError";
        }
      }

      return token;
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      if (token.accessToken) {
        session.accessToken = token.accessToken as string;
      }
      if (token.error) session.error = token.error as string;
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
});
