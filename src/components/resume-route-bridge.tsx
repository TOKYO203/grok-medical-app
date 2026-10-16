import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

const LAST_ROUTE_KEY = "optimus.lastRoute";

/*
 * « Reprendre où vous étiez » (Session 10 — vague UX navigation) : persiste la
 * dernière route utile visitée (href complet, paramètres inclus) ; l’accueil, le
 * login et l’admin n’ont pas d’intérêt de reprise. Écriture après montage
 * (SSR-safe), silencieuse si le stockage est indisponible.
 */
export function ResumeRouteBridge() {
  const location = useRouterState({ select: (s) => s.location });
  const pathname = location.pathname;
  const href = (location as { href?: string }).href ?? pathname;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const excluded = pathname === "/" || pathname === "/login" || pathname.startsWith("/admin");
    if (excluded) return;
    try {
      window.localStorage.setItem(LAST_ROUTE_KEY, href);
    } catch {
      /* stockage indisponible — silencieux */
    }
  }, [pathname, href]);

  return null;
}
