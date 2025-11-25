import * as React from "react"
import { cn } from "@/lib/utils"
interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  className?: string
}
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, onCheckedChange, className }, ref) => {
    return (
      <button
        ref={ref}
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn("switch", checked && "active", className)}
      >
        <span className="switch-thumb" />
      </button>
    )
  }
)
Switch.displayName = "Switch"
export { Switch }