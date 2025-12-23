import { cn } from "@/lib/utils"

interface LoadingProps {
  message?: string
  className?: string
  size?: "sm" | "md" | "lg"
  fullScreen?: boolean
}

export function Loading({
  message = "Seduh kopi...",
  className,
  size = "md",
  fullScreen = true
}: LoadingProps) {
  const sizeMap = {
    sm: { cup: "w-6 h-5", handle: "w-2 h-3", steam: "h-3" },
    md: { cup: "w-10 h-8", handle: "w-3 h-5", steam: "h-5" },
    lg: { cup: "w-14 h-12", handle: "w-4 h-7", steam: "h-7" },
  }

  const content = (
    <div className={cn("flex flex-col items-center justify-center gap-6", className)}>
      <div className="relative flex items-end justify-center">
        {/* Steam Animation */}
        <div className="absolute -top-6 flex gap-1.5 justify-center w-full opacity-0 animate-fade-in">
          {[0, 150, 300].map((delay, i) => (
            <div
              key={i}
              className={cn(
                "w-1 rounded-full bg-primary/40 animate-steam origin-bottom",
                sizeMap[size].steam
              )}
              style={{
                animation: "steam 1.5s infinite ease-out",
                animationDelay: `${delay}ms`
              }}
            />
          ))}
        </div>

        {/* Cup Body */}
        <div className={cn(
          "relative bg-background border-2 border-primary rounded-b-2xl rounded-t-sm z-10",
          sizeMap[size].cup
        )}>
          {/* Liquid Fill Animation */}
          <div className="absolute bottom-0 left-0 right-0 bg-primary/20 w-full h-full rounded-b-[14px] rounded-t-sm overflow-hidden">
            <div className="absolute bottom-0 w-full bg-primary animate-fill-up h-0"
              style={{ animation: "fill-up 2s infinite ease-in-out alternate" }} />
          </div>
        </div>

        {/* Cup Handle */}
        <div className={cn(
          "border-2 border-primary rounded-r-lg border-l-0 -ml-0.5 mb-1.5",
          sizeMap[size].handle
        )} />
      </div>

      {/* Message */}
      {message && (
        <p className="text-sm font-medium text-primary animate-pulse">
          {message}
        </p>
      )}

      {/* Styles for Animations */}
      <style jsx>{`
        @keyframes steam {
          0% { transform: translateY(0) scaleX(1); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(-10px) scaleX(1.5); opacity: 0; }
        }
        @keyframes fill-up {
          0% { height: 0%; }
          100% { height: 80%; }
        }
      `}</style>
    </div>
  )

  if (fullScreen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        {content}
      </div>
    )
  }

  return content
}

export default Loading
