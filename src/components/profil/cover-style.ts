import type { CSSProperties } from "react";

export function coverImageStyle(url: string): CSSProperties {
  return {
    backgroundImage: `url(${url})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}
