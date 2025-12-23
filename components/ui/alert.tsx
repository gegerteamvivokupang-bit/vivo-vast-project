import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-xl border p-4",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        error: "border-destructive/50 bg-destructive/10 text-destructive [&>svg]:text-destructive",
        warning: "border-warning/50 bg-warning/10 text-warning-foreground [&>svg]:text-warning",
        success: "border-success/50 bg-success/10 text-success [&>svg]:text-success",
        info: "border-primary/50 bg-primary/10 text-primary [&>svg]:text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const iconMap = {
  error: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
  default: Info,
}

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  message?: string
  type?: "error" | "warning" | "success" | "info"
  onClose?: () => void
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, message, type, children, onClose, ...props }, ref) => {
    // Support both 'type' (old API) and 'variant' (new API)
    const resolvedVariant = variant || type || "default"
    const Icon = iconMap[resolvedVariant as keyof typeof iconMap] || Info

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant: resolvedVariant as any }), className)}
        {...props}
      >
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            {message && <p className="text-sm">{message}</p>}
            {children}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    )
  }
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
