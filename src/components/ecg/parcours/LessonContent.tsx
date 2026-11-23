import type { ReactNode } from "react";
import type { ContentBlock } from "@/lib/ecg/parcours/types";

export function LessonContent({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => <BlockRenderer key={i} block={block} />)}
    </div>
  );
}

function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "text":
      return <MarkdownText text={block.markdown} />;
    case "callout":
      return (
        <div className={`rounded-lg border-l-4 p-3 text-sm ${calloutClass(block.tone)}`}>
          {block.title && <p className="mb-1 font-semibold">{block.title}</p>}
          <MarkdownText text={block.markdown} />
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-default">
                {block.headers.map((h, i) => (
                  <th key={i} className="py-2 pr-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-subtle">
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-2 pr-3 text-subtle">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "list": {
      const items = block.items.map((item, i) => <li key={i}>{item}</li>);
      return block.ordered
        ? <ol className="list-decimal space-y-1 pl-5 text-sm">{items}</ol>
        : <ul className="list-disc space-y-1 pl-5 text-sm">{items}</ul>;
    }
    case "image":
      return (
        <figure>
          <img src={block.src} alt={block.alt || ""} className="rounded-lg border border-default" />
          {block.caption && <figcaption className="mt-1 text-xs text-subtle">{block.caption}</figcaption>}
        </figure>
      );
    default:
      return null;
  }
}

function calloutClass(tone: string) {
  switch (tone) {
    case "info": return "border-blue-500 bg-blue-50 text-blue-900";
    case "warning": return "border-amber-500 bg-amber-50 text-amber-900";
    case "danger": return "border-red-500 bg-red-50 text-red-900";
    case "success": return "border-emerald-500 bg-emerald-50 text-emerald-900";
    default: return "border-default bg-muted";
  }
}

function MarkdownText({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {paragraphs.map((p, i) => {
        const t = p.trim();
        if (t.startsWith("## ")) return <h3 key={i} className="mt-3 text-base font-semibold">{t.slice(3)}</h3>;
        if (t.startsWith("### ")) return <h4 key={i} className="mt-2 text-sm font-semibold">{t.slice(4)}</h4>;
        return <p key={i}>{renderInline(t)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{part.slice(1, -1)}</code>;
    }
    return <span key={i}>{part}</span>;
  });
}
