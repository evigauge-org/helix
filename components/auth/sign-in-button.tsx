"use client";

import { signIn } from "@/lib/auth-client";
import { LogIn } from "lucide-react";

export function SignInButton() {
  return (
    <button
      onClick={() => signIn.social({ provider: "google" })}
      className="flex size-8 items-center justify-center rounded-[10px] bg-gray-500 text-white hover:scale-110 transition-all cursor-pointer shadow-md"
      aria-label="Sign in with Google"
    >
      <LogIn className="size-4" />
    </button>
  );
}
