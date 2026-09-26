import type { ButtonHTMLAttributes } from "react";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function ActionButton({ variant = "primary", className = "", type = "button", ...props }: ActionButtonProps) {
  const variantClass = variant === "ghost" ? "btn ghost" : "btn";

  return <button type={type} className={`${variantClass} ${className}`.trim()} {...props} />;
}
