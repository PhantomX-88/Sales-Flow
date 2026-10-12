import { cn, initialsOf } from "@/lib/utils";

/* Six visually distinct initial-chip tones. Each tone is expressed as a
   CSS class so the same avatar reads correctly in both light and dark
   themes (the underlying surface/foreground colors come from hsl(var(...))). */
const TONES = [
  "avatar-tone-primary",
  "avatar-tone-success",
  "avatar-tone-warning",
  "avatar-tone-danger",
  "avatar-tone-secondary",
  "avatar-tone-muted",
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
