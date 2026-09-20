import { useState } from "react";
import { Download, Copy, Check } from "lucide-react";
import type { ChatMessage } from "@/lib/ai/useClinicalAI";
import type { AIHistoryEntry } from "@/lib/ai/ai-history";
import {
  buildConversationMarkdown,
  downloadMarkdown,
  copyToClipboard,
  slugify,
  type ExportContext,
} from "@/lib/ai/export-markdown";

type Props = {
  context: ExportContext;
  messages: ChatMessage[];
  history: AIHistoryEntry[];
};

export function ConversationExportButtons({ context, messages, history }: Props) {
  const [copied, setCopied] = useState(false);

  const buildContent = () => buildConversationMarkdown(context, messages, history);

  const onDownload = () => {
    const filename = `optimus-${slugify(context.title)}-${Date.now()}.md`;
    downloadMarkdown(filename, buildContent());
  };

  const onCopy = async () => {
    const ok = await copyToClipboard(buildContent());
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copier la conversation"
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted transition-colors hover:text-fg"
      >
        {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
        {copied ? "Copié" : "Copier"}
      </button>
      <button
        type="button"
        onClick={onDownload}
        aria-label="Télécharger en Markdown"
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted transition-colors hover:text-fg"
      >
        <Download className="size-3" aria-hidden />
        Markdown
      </button>
    </div>
  );
}
