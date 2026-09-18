"use client";

import { signOut, useSession } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";

export function UserMenu() {
  const { data: session } = useSession();
  if (!session?.user) return null;

  return (
    <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
      <Avatar className="size-8 border border-[#0085CF]/20">
        <AvatarImage src={session.user.image ?? undefined} />
        <AvatarFallback className="bg-[#0085CF]/10 text-[#0085CF] text-sm font-medium">
          {session.user.name?.charAt(0) ?? "U"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 truncate group-data-[collapsible=icon]:hidden">
        <p className="truncate text-sm font-medium text-gray-800">{session.user.name}</p>
        <p className="truncate text-xs text-gray-400">{session.user.email}</p>
      </div>
      <button
        onClick={async () => {
          await signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } });
        }}
        className="cursor-pointer text-gray-400 hover:text-red-500 transition-colors group-data-[collapsible=icon]:hidden"
        aria-label="Sign out"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
