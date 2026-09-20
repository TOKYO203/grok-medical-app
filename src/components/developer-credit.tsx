import { Link } from "@tanstack/react-router";

export function DeveloperCredit() {
  return (
    <Link
      to="/a-propos"
      className="mt-4 block text-center text-[11px] text-subtle transition-colors hover:text-muted"
    >
      Développé par <span className="font-medium text-muted">Fondation Optimus</span> · Made in Madagascar 🇲🇬
    </Link>
  );
}
