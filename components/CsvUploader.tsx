"use client";

import { useState, useCallback, useRef } from "react";

interface UploadResult {
  artistCount: number;
  songCount: number;
}

export default function CsvUploader({
  onUploadComplete,
}: {
  onUploadComplete: (result: UploadResult) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const csvFiles = Array.from(files).filter(
        (f) => f.name.endsWith(".csv") || f.type === "text/csv"
      );

      if (csvFiles.length === 0) {
        setError("Please upload CSV files exported from Spotify.");
        return;
      }

      setError(null);
      setIsUploading(true);
      setFileNames(csvFiles.map((f) => f.name));

      const formData = new FormData();
      for (const file of csvFiles) {
        formData.append("files", file);
      }

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Upload failed");
          return;
        }

        // Store artists in localStorage for the search request
        localStorage.setItem(
          "showfinder_artists",
          JSON.stringify(data.artists)
        );

        onUploadComplete({
          artistCount: data.artistCount,
          songCount: data.songCount,
        });
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all
          ${
            isDragging
              ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
              : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/70"
          }
          ${isUploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        <div className="mb-3 text-4xl">
          {isUploading ? (
            <span className="inline-block animate-spin">&#9696;</span>
          ) : (
            "🎵"
          )}
        </div>

        {isUploading ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            Processing {fileNames.join(", ")}...
          </p>
        ) : (
          <>
            <p className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
              Drop your Spotify playlist CSVs here
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              or click to browse. You can upload multiple files.
            </p>
          </>
        )}
      </div>

      {fileNames.length > 0 && !isUploading && !error && (
        <div className="mt-3 flex flex-wrap gap-2">
          {fileNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
            >
              {name}
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
