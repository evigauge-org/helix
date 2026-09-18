"use client";
import { useEffect, useState } from "react";

export function ConstitutionPanel() {
  const [text, setText] = useState("");
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/constitution");
      if (res.ok) {
        const { text } = await res.json();
        setText(text);
      }
    })();
  }, []);
  if (!text) return null;
  return (
    <details>
      <summary className="cursor-pointer text-sm font-semibold text-gray-900">Constitution</summary>
      <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-gray-700">{text}</pre>
    </details>
  );
}
