import {
  Activity,
  Bone,
  BookOpen,
  Brain,
  Bug,
  Globe,
  Heart,
  Pill,
  Scan,
  Stethoscope,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAP = {
  pill: Pill,
  heart: Heart,
  brain: Brain,
  bug: Bug,
  bone: Bone,
  zap: Zap,
  activity: Activity,
  stethoscope: Stethoscope,
  scan: Scan,
  globe: Globe,
  book: BookOpen,
} as const;

export function DeckIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MAP[name as keyof typeof MAP] ?? BookOpen;
  return <Icon className={cn("size-5", className)} strokeWidth={1.75} />;
}
