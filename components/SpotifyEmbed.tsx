"use client";

export default function SpotifyEmbed({
  trackId,
  title,
}: {
  trackId: string;
  title: string;
}) {
  if (!trackId) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <span>🎵</span>
        <span>{title}</span>
        <span className="text-xs text-zinc-400">(no Spotify link)</span>
      </div>
    );
  }

  return (
    <iframe
      src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
      width="100%"
      height="80"
      frameBorder="0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      title={title}
      className="rounded-xl"
    />
  );
}
