/**
 * RadioViewer — affichage d'une image médicale avec highlights superposés.
 * Les highlights sont en POURCENTAGE (0-100) → responsive.
 */
import type { ImagingHighlight } from "@/content/imagerie";

export type RadioViewerProps = {
  src: string;
  alt: string;
  highlight?: ImagingHighlight;
};

export function RadioViewer({ src, alt, highlight }: RadioViewerProps) {
  return (
    <div className="relative w-full overflow-hidden rounded-[var(--radius-xl)] bg-black shadow-[var(--shadow-border)]">
      <img
        src={src}
        alt={alt}
        className="block w-full"
        loading="lazy"
        decoding="async"
      />
      {highlight ? (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <rect
            x={highlight.x}
            y={highlight.y}
            width={highlight.w}
            height={highlight.h}
            fill="none"
            stroke="#d4a648"
            strokeWidth="0.6"
            strokeDasharray="2 1.5"
          />
          {highlight.label ? (
            <g>
              <rect
                x={Math.max(0, highlight.x - 0.5)}
                y={Math.max(0, highlight.y - 4)}
                width={Math.min(100, highlight.label.length * 1.6)}
                height="3"
                fill="#d4a648"
                rx="0.5"
              />
              <text
                x={Math.max(0, highlight.x) + 0.3}
                y={Math.max(0, highlight.y - 1.7)}
                fill="#14180f"
                fontSize="2"
                fontWeight="600"
                fontFamily="system-ui, sans-serif"
              >
                {highlight.label}
              </text>
            </g>
          ) : null}
        </svg>
      ) : null}
    </div>
  );
}
