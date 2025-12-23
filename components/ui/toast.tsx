'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
    id: string
    message: string
    type: ToastType
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within ToastProvider')
    }
    return context
}

// Icons for each type
const icons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
}

// Toast Item Component
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
    return (
        <div
            className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg",
                "animate-in slide-in-from-top-2 fade-in duration-300",
                "bg-card/90 backdrop-blur-xl border",
                toast.type === 'success' && "border-success/30 text-success",
                toast.type === 'error' && "border-destructive/30 text-destructive",
                toast.type === 'warning' && "border-warning/30 text-warning",
                toast.type === 'info' && "border-primary/30 text-primary",
            )}
        >
            {/* Icon */}
            <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold",
                toast.type === 'success' && "bg-success/20",
                toast.type === 'error' && "bg-destructive/20",
                toast.type === 'warning' && "bg-warning/20",
                toast.type === 'info' && "bg-primary/20",
            )}>
                {icons[toast.type]}
            </div>

            {/* Message */}
            <span className="flex-1 text-sm font-medium text-foreground">
                {toast.message}
            </span>

            {/* Close button */}
            <button
                onClick={onRemove}
                className="text-muted-foreground hover:text-foreground transition-colors"
            >
                ✕
            </button>
        </div>
    )
}

// Toast Provider Component
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now().toString()
        const newToast: Toast = { id, message, type }

        setToasts(prev => [...prev, newToast])

        // Auto remove after 3 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 3000)
    }, [])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-[380px] z-[100] px-4 space-y-2">
                {toasts.map(toast => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onRemove={() => removeToast(toast.id)}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    )
}
