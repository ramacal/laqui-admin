// Button (shadcn/ui pattern, adapted to the Lotería tokens). One primary per view; the rest
// outline or ghost. No preflight yet (see globals.css), so borders and backgrounds are explicit.
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-solid",
    "text-sm font-semibold [font-family:inherit] leading-none no-underline transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:cursor-progress disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary-hover",
        outline: "border-input bg-card text-foreground hover:bg-muted",
        ghost: "border-transparent bg-transparent text-foreground hover:bg-muted",
        quiet: "border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:opacity-90",
        "destructive-outline": "border-destructive/40 bg-card text-destructive hover:bg-destructive-soft",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3",
        icon: "size-9 p-0 [&_svg]:size-[18px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
