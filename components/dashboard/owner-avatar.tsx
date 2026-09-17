import { cn, initialsOf } from "@/lib/utils";

const TONES = [
  "bg-blue-100 text-blue-700",
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
];

const SIZES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
} as const;

function toneFor(name: string): string {
  const hash = [...name].reduce((total, character) => total + character.charCodeAt(0), 0);
  return TONES[hash % TONES.length];
}

interface OwnerAvatarProps {
  name: string;
  initials?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export function OwnerAvatar({ name, initials, size = "md", className }: OwnerAvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        SIZES[size],
        toneFor(name),
        className,
      )}
      aria-hidden="true"
    >
      {initials ?? initialsOf(name)}
    </span>
  );
}
