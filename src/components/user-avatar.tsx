import {
  BookOpen,
  Brain,
  BriefcaseMedical,
  HeartPulse,
  Landmark,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOptimus } from "@/state/store";

/*
 * Avatar unifié (D30 — Session 16) : photo importée → icône choisie →
 * icône par défaut. Un seul moteur de rendu pour l'accueil et le profil :
 * l'image de l'utilisateur prime toujours sur l'icône du profil.
 */
export const USER_AVATARS: { id: string; icon: LucideIcon; label: string }[] = [
  { id: "stethoscope", icon: Stethoscope, label: "Clinique" },
  { id: "doctor", icon: BriefcaseMedical, label: "Médecin" },
  { id: "brain", icon: Brain, label: "Neurologie" },
  { id: "heart", icon: HeartPulse, label: "Cardiologie" },
  { id: "books", icon: BookOpen, label: "Études médicales" },
  { id: "madagascar", icon: Landmark, label: "Madagascar" },
];

export function UserAvatar({
  photo,
  className,
  iconClassName = "size-10",
}: {
  /** Photo compressée (aperçu d'import ou data URL persistée) ; sans photo, l'icône du profil est rendue. */
  photo?: string | null;
  className?: string;
  iconClassName?: string;
}) {
  const profile = useOptimus((s) => s.profile);
  const avatar = USER_AVATARS.find((item) => item.id === profile.avatar) ?? USER_AVATARS[0];
  const AvatarIcon = avatar.icon;
  const src = photo ?? profile.avatarDataUrl ?? null;
  return (
    <span
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-full bg-primary-soft text-primary",
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" aria-hidden className="size-full rounded-full object-cover" />
      ) : (
        <AvatarIcon className={iconClassName} strokeWidth={1.6} aria-hidden />
      )}
    </span>
  );
}
