"use client";

import Image from "next/image";

export function AiOrb({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <button
      className="relative flex items-center justify-center group"
      aria-label="Helix AI"
    >
      <div className="absolute size-28 sm:size-32 animate-pulse rounded-full bg-sky-400/20 blur-2xl group-hover:bg-sky-400/35 transition-colors" />
      <Image
        src="/Siri.png"
        alt="Helix AI"
        width={130}
        height={130}
        className="relative size-[100px] sm:size-[115px] md:size-[130px] drop-shadow-2xl group-hover:scale-105 transition-transform"
        priority
      />
    </button>
  );
}
