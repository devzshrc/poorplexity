import { cn } from "@/lib/utils"

type SwitchProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

function Switch({ checked, onCheckedChange, disabled, className, ariaLabel }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex h-6 w-11 items-center rounded-md border border-border bg-muted/90 p-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
        checked && "bg-primary/90",
        className,
      )}
    >
      <span
        className={cn(
          "block size-5 rounded-sm bg-background transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  )
}

export { Switch }
