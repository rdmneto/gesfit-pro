import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "default" | "sm" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", loading = false, icon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:pointer-events-none disabled:opacity-55",
          {
            "bg-emerald-700 text-white shadow-[0_4px_14px_0_rgb(6_95_70_/_0.25)] hover:bg-emerald-600 hover:-translate-y-px hover:shadow-[0_6px_20px_0_rgb(6_95_70_/_0.35)] active:translate-y-0": variant === "primary",
            "bg-white text-stone-900 border-[1.5px] border-stone-200 shadow-xs hover:bg-stone-50 hover:border-[#c9c4b9] hover:-translate-y-px": variant === "secondary",
            "bg-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-900": variant === "ghost",
            "bg-red-50 text-red-700 border-[1.5px] border-red-200 hover:bg-red-100": variant === "danger",
            "h-11 px-5": size === "default",
            "h-9 px-3.5 text-[0.8125rem]": size === "sm",
            "h-13 px-7 text-base": size === "lg",
          },
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : icon}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
