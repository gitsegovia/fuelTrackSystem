import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        // T-072/T-073 (EXPERIMENTAL): insignia de estado, un solo estilo para todos los
        // estados (fondo gris + borde gris #B6B6B6) — el color lo da `tone`, no `variant`.
        status: "border-[#B6B6B6] bg-[#F1F3F5] font-semibold",
      },
      tone: {
        success: "",
        warning: "",
        danger: "",
        info: "",
        neutral: "",
      },
    },
    compoundVariants: [
      { variant: "status", tone: "success", class: "text-[#15803D]" },
      { variant: "status", tone: "warning", class: "text-[#B45309]" },
      { variant: "status", tone: "danger", class: "text-[#B91C1C]" },
      // #1E88E5 (azul marca) da 3.3:1 sobre el gris de fondo, bajo el AA 4.5:1 que pide
      // la spec de badges; #1565C0 sí llega (5.2:1) — la propia spec prevé este fallback.
      { variant: "status", tone: "info", class: "text-[#1565C0]" },
      { variant: "status", tone: "neutral", class: "text-[#374151]" },
    ],
    defaultVariants: {
      variant: "default",
      tone: "neutral",
    },
  }
)

function Badge({
  className,
  variant = "default",
  tone,
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, tone }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
