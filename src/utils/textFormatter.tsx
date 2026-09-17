import React from "react";
import { ExternalLink } from "lucide-react";

/**
 * renderFormattedText
 * Parses markdown links [Title](URL) into clickable <a> tags that open in a new tab.
 * Cleans **bold** asterisks for a sleek UI look.
 */
export function renderFormattedText(text: string): React.ReactNode {
  if (!text) return null;

  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(cleanFormatting(text.slice(lastIndex, match.index)));
    }

    const rawLabel = match[1];
    const label = cleanFormatting(rawLabel);
    const url = match[2];

    parts.push(
      <a
        key={`link-${match.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-purple-400 hover:text-purple-300 underline underline-offset-2 inline-flex items-center gap-0.5 font-medium transition-colors"
      >
        <span>{label}</span>
        <ExternalLink className="w-3 h-3 shrink-0 opacity-80 inline" />
      </a>
    );

    lastIndex = linkRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(cleanFormatting(text.slice(lastIndex)));
  }

  return <>{parts}</>;
}

function cleanFormatting(str: string): string {
  return str.replace(/\*\*/g, "");
}
