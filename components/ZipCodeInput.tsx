"use client";

import { useState, useEffect } from "react";

export default function ZipCodeInput({
  onZipChange,
  initialZip,
}: {
  onZipChange: (zip: string) => void;
  initialZip?: string;
}) {
  const [zip, setZip] = useState(initialZip || "");

  useEffect(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem("showfinder_zip");
    if (saved && !initialZip) {
      setZip(saved);
    }
  }, [initialZip]);

  const handleChange = (value: string) => {
    // Only allow digits, max 5
    const cleaned = value.replace(/\D/g, "").slice(0, 5);
    setZip(cleaned);
    if (cleaned.length === 5) {
      localStorage.setItem("showfinder_zip", cleaned);
      onZipChange(cleaned);
    }
  };

  return (
    <div className="w-full">
      <label
        htmlFor="zipcode"
        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        Your Zip Code
      </label>
      <div className="mt-1 flex items-center gap-3">
        <input
          id="zipcode"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{5}"
          maxLength={5}
          value={zip}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="e.g. 90210"
          className="w-32 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-center text-lg font-mono tracking-widest text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          40 mile radius
        </span>
      </div>
    </div>
  );
}
