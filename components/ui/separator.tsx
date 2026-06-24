import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"div"> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      role="separator"
      data-slot="separator"
      data-orientation={orientation}
      className={cn(
        orientation === "vertical"
          ? "w-px self-stretch"
          : "h-px w-full",
        "shrink-0 bg-border",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
