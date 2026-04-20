import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Providers from "@/components/Providers";
import AuthButton from "@/components/AuthButton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Local Show Finder",
  description:
    "Find upcoming local concerts from your Spotify playlists and subscribe to a live calendar feed.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Providers>
          <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <Link href="/" className="flex items-center gap-2 font-bold text-lg">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-7 w-7 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="13" r="8" />
                  <circle cx="11" cy="13" r="2" fill="currentColor" />
                  <path d="M18 4l-5 7" />
                  <circle cx="18.5" cy="3.5" r="1.25" fill="currentColor" />
                </svg>
                <span>Local Show Finder</span>
              </Link>
              <nav className="flex items-center gap-4">
                <Link
                  href="/"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Upload
                </Link>
                <Link
                  href="/calendar"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Calendar
                </Link>
                <AuthButton />
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-zinc-200 bg-white py-4 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600">
            Powered by Ticketmaster Discovery API &middot; Spotify playlist data
          </footer>
        </Providers>
      </body>
    </html>
  );
}
