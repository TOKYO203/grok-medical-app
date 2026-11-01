/**
 * « Labo visuel » — rail premium de la page d'accueil : met en avant les
 * trois sections d'apprentissage par l'image avec de VRAIES vignettes
 * (Wikimedia Commons) plutôt que de simples icônes.
 *
 * Licences des vignettes (déjà vérifiées sur les pages Commons) :
 * - Plasmodium.jpg — CDC / PHIL, domaine public
 * - X-ray_of_lobar_pneumonia.jpg — Mikael Häggström, CC0
 * - Heart-and-lungs.jpg — Gray's Anatomy (1918), domaine public
 */
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

const ITEMS = [
  {
    to: "/histologie" as const,
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Plasmodium.jpg?width=800",
    alt: "Frottis sanguin au Giemsa : anneaux de Plasmodium falciparum",
    kicker: "11 lames · H&E, Ziehl, Giemsa",
    title: "Histologie",
    detail: "Vraies lames commentées + mode auto-évaluation",
  },
  {
    to: "/imagerie" as const,
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/X-ray_of_lobar_pneumonia.jpg?width=800",
    alt: "Radiographie thoracique : pneumonie lobaire",
    kicker: "5 cas · méthode A → H",
    title: "Imagerie",
    detail: "Interprétation guidée pas à pas, scorée",
  },
  {
    to: "/auscultation" as const,
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Heart-and-lungs.jpg?width=800",
    alt: "Planche anatomique : cœur et poumons, vue antérieure",
    kicker: "Cardio + pulmonaire",
    title: "Auscultation",
    detail: "Foyers et zones sur planche anatomique",
  },
];

export function VisualLabRail() {
  return (
    <div className="grid gap-3 sm:grid-cols-3" data-visual-lab-rail>
      {ITEMS.map((item) => (
        <Link
          key={item.title}
          to={item.to}
          className="optimus-card optimus-interactive-card group relative overflow-hidden p-0 active:scale-[0.99]"
        >
          <span className="block h-28 overflow-hidden bg-secondary">
            <img
              src={item.img}
              alt={item.alt}
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </span>
          <span className="block p-4">
            <span className="optimus-kicker block text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
              {item.kicker}
            </span>
            <span className="mt-1 flex items-center justify-between font-medium">
              <span>{item.title}</span>
              <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">{item.detail}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
