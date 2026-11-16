import type { ButtonHTMLAttributes } from "react";
export function cn(...parts: (string | false | null | undefined)[]) { return parts.filter(Boolean).join(" "); }
export function Button({ variant, size, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "surface" | "ghost"; size?: "lg" }) {
  return <button {...props} className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 font-medium", variant === "surface" ? "border border-border bg-surface text-fg" : variant === "ghost" ? "text-fg" : "bg-primary text-primary-fg", size === "lg" && "min-h-12", "disabled:opacity-40", className)} />;
}
