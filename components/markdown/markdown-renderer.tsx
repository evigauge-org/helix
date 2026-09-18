"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Loader2, Paperclip } from "lucide-react";
import { CodeBlock } from "./code-block";
import { ArtifactChipById } from "@/components/artifacts/artifact-chip";
import type { Components } from "react-markdown";

const ARTIFACT_PREFIX = "artifact:";

function buildComponents(opts: { suppressArtifactResolve: boolean }): Components {
  return {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className ?? "");
      const isInline = !match;
      if (isInline) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }
      return <CodeBlock language={match[1]}>{String(children).replace(/\n$/, "")}</CodeBlock>;
    },
    a({ href, children, ...props }) {
      if (typeof href === "string" && href.startsWith(ARTIFACT_PREFIX)) {
        const artifactId = href.slice(ARTIFACT_PREFIX.length).trim();
        const label = typeof children === "string"
          ? children
          : Array.isArray(children)
            ? children.filter((c) => typeof c === "string").join("")
            : undefined;
        // While the assistant message is still streaming, avoid spawning a
        // fetch storm for every partial artifact id — show a quiet placeholder
        // and resolve once the stream completes.
        if (opts.suppressArtifactResolve) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 align-middle">
              <Paperclip className="size-3" />
              <Loader2 className="size-3 animate-spin" />
              <span className="max-w-[160px] truncate">{label ?? "artifact"}</span>
            </span>
          );
        }
        return <ArtifactChipById artifactId={artifactId} fallbackName={label} />;
      }
      return (
        <a
          href={href}
          {...props}
          target={href?.startsWith("http") ? "_blank" : undefined}
          rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
        >
          {children}
        </a>
      );
    },
  };
}

export function MarkdownRenderer({
  content,
  isStreaming = false,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  const components = useMemo(
    () => buildComponents({ suppressArtifactResolve: isStreaming }),
    [isStreaming],
  );
  return (
    <div className="chat-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
