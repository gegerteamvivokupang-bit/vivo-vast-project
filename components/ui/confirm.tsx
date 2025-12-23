'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ConfirmOptions {
    title?: string
    message: string
    confirmText?: string
    cancelText?: string
    type?: 'danger' | 'warning' | 'info'
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

export function useConfirm() {
    const context = useContext(ConfirmContext)
    if (!context) {
        throw new Error('useConfirm must be used within ConfirmProvider')
    }
    return context
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)
    const [options, setOptions] = useState<ConfirmOptions | null>(null)
    const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null)

    const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setOptions(opts)
            setIsOpen(true)
            setResolver(() => resolve)
        })
    }, [])

    const handleConfirm = () => {
        setIsOpen(false)
        resolver?.(true)
    }

    const handleCancel = () => {
        setIsOpen(false)
        resolver?.(false)
    }

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}

            {/* Modal Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    onClick={handleCancel}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

                    {/* Modal */}
                    <div
                        className="relative bg-card rounded-2xl shadow-2xl w-full max-w-[320px] overflow-hidden animate-in zoom-in-95 fade-in duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Icon */}
                        <div className="pt-6 pb-2 flex justify-center">
                            <div className={cn(
                                "w-14 h-14 rounded-full flex items-center justify-center text-2xl",
                                options?.type === 'danger' && "bg-destructive/20",
                                options?.type === 'warning' && "bg-warning/20",
                                (!options?.type || options?.type === 'info') && "bg-primary/20",
                            )}>
                                {options?.type === 'danger' ? '⚠️' : options?.type === 'warning' ? '❓' : '❓'}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-6 pb-4 text-center">
                            {options?.title && (
                                <h3 className="text-lg font-bold text-foreground mb-1">
                                    {options.title}
                                </h3>
                            )}
                            <p className="text-sm text-muted-foreground">
                                {options?.message}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex border-t border-border">
                            <button
                                onClick={handleCancel}
                                className="flex-1 py-3.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                            >
                                {options?.cancelText || 'Batal'}
                            </button>
                            <div className="w-px bg-border" />
                            <button
                                onClick={handleConfirm}
                                className={cn(
                                    "flex-1 py-3.5 text-sm font-semibold transition-colors",
                                    options?.type === 'danger'
                                        ? "text-destructive hover:bg-destructive/10"
                                        : "text-primary hover:bg-primary/10"
                                )}
                            >
                                {options?.confirmText || 'Ya'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    )
}
