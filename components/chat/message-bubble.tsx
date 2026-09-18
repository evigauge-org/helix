"use client";

import { useSession } from "@/lib/auth-client";
import type { ChatMessage } from "@/lib/types";
import { User, FileText } from "lucide-react";

function truncateFileName(name: string, max = 28): string {
  if (name.length <= max) return name;
  const ext = name.lastIndexOf(".");
  if (ext > 0 && name.length - ext <= 6) {
    const extension = name.slice(ext);
    return name.slice(0, max - extension.length - 3) + "..." + extension;
  }
  return name.slice(0, max - 3) + "...";
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const { data: session } = useSession();

  return (
    <div className="flex items-start gap-3 justify-end">
      <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-[#0085CF] px-4 py-3 shadow-sm">
        <p className="text-sm leading-relaxed text-white whitespace-pre-wrap">{message.content}</p>
        {message.files && message.files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-white/20">
            {message.files.map((f, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-2.5 py-1 text-[11px] text-white max-w-[200px]"
                title={f.name}
              >
                <FileText className="size-3 shrink-0" />
                <span className="truncate">{truncateFileName(f.name)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* User avatar */}
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0085CF]/15 mt-0.5">
        {session?.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="size-8 rounded-full" />
        ) : (
          <User className="size-4 text-[#0085CF]" />
        )}
      </div>
    </div>
  );
}
