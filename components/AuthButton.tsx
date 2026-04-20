"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="h-8 w-20 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
    );
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn("spotify", { callbackUrl: "/" })}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
      >
        Sign In
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {session.user?.image && (
        <img
          src={session.user.image}
          alt=""
          className="h-7 w-7 rounded-full"
        />
      )}
      <span className="hidden text-sm text-zinc-600 dark:text-zinc-400 sm:inline">
        {session.user?.name?.split(" ")[0]}
      </span>
      <button
        onClick={() => signOut()}
        className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        Sign Out
      </button>
    </div>
  );
}
