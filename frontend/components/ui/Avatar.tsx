import { cn } from "@/lib/utils";

type AvatarSize = "sm" | "md" | "lg";

const sizeMap: Record<AvatarSize, string> = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
};

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: AvatarSize;
  className?: string;
}

/**
 * Generate a deterministic DiceBear "bottts" avatar URL from a seed string.
 * Bottts are cute cartoon robots — completely gender-neutral and unique per user.
 * The same name always produces the same avatar.
 */
export function generateAvatarUrl(seed: string): string {
  const encoded = encodeURIComponent(seed.trim().toLowerCase());
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${encoded}`;
}

export default function Avatar({ src, name, size = "md", className }: AvatarProps) {
  const fallbackSrc = name ? generateAvatarUrl(name) : null;
  const resolvedSrc = src || fallbackSrc;

  return (
    <div
      className={cn(
        "relative rounded-full flex items-center justify-center font-semibold shrink-0 overflow-hidden",
        "bg-shore-100 text-trippy-500 border border-border",
        sizeMap[size],
        className
      )}
    >
      {resolvedSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedSrc}
          alt={name ?? "Avatar"}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <span className="text-[0.65em] font-bold text-trippy-400">?</span>
      )}
    </div>
  );
}
