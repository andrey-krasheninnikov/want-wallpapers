import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "ui-button-base",
  {
    variants: {
      variant: {
        default: "ui-button-default",
        destructive:
          "ui-button-destructive",
        outline:
          "ui-button-outline",
        secondary:
          "ui-button-secondary",
        ghost:
          "ui-button-ghost",
        link: "ui-button-link",
      },
      size: {
        default: "ui-button-size-default",
        xs: "ui-button-size-xs",
        sm: "ui-button-size-sm",
        lg: "ui-button-size-lg",
        icon: "size-11",
        "icon-xs": "ui-button-size-icon-xs",
        "icon-sm": "size-11",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
