'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { X, Moon, Sun, LogOut, Lock, Camera, User } from 'lucide-react'

interface ProfileSidebarProps {
    isOpen: boolean
    onClose: () => void
}

export function ProfileSidebar({ isOpen, onClose }: ProfileSidebarProps) {
    const { user, signOut } = useAuth()
    const router = useRouter()
    const [isDark, setIsDark] = useState(false)
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    // Check initial theme
    useEffect(() => {
        const isDarkMode = document.documentElement.classList.contains('dark')
        setIsDark(isDarkMode)
    }, [])

    // Toggle dark/light mode
    const toggleTheme = () => {
        const newDark = !isDark
        setIsDark(newDark)
        if (newDark) {
            document.documentElement.classList.add('dark')
            localStorage.setItem('theme', 'dark')
        } else {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
        }
    }

    // Handle logout
    const handleLogout = async () => {
        setIsLoggingOut(true)
        try {
            await signOut()
            router.push('/login')
        } catch (error) {
            console.error('Logout error:', error)
        } finally {
            setIsLoggingOut(false)
        }
    }

    // Get user initials for avatar
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
    }

    // Get role display name
    const getRoleDisplay = (role: string) => {
        const roleMap: Record<string, string> = {
            promotor: 'Promotor',
            sator: 'SATOR',
            spv: 'Supervisor',
            manager: 'Manager Area',
            admin: 'Administrator',
        }
        return roleMap[role] || role
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
                onClick={onClose}
            />

            {/* Sidebar */}
            <div className="fixed top-0 left-0 h-full w-[280px] bg-card border-r border-border z-50 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-bold">Profil</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-muted transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Profile Section */}
                <div className="p-6 border-b border-border">
                    <div className="flex flex-col items-center text-center">
                        {/* Avatar */}
                        <div className="relative mb-4">
                            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-lg">
                                {user?.name ? getInitials(user.name) : <User className="w-8 h-8" />}
                            </div>
                            {/* Upload button overlay */}
                            <button className="absolute bottom-0 right-0 p-1.5 rounded-full bg-card border-2 border-border hover:bg-muted transition-colors">
                                <Camera className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Name & Role */}
                        <h3 className="text-lg font-bold">{user?.name || 'User'}</h3>
                        <span className="text-sm text-muted-foreground mt-1">
                            {user?.role ? getRoleDisplay(user.role) : 'Role'}
                        </span>
                    </div>
                </div>

                {/* Menu Items - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                    {/* Dark Mode Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                            <span className="font-medium">Mode Gelap</span>
                        </div>
                        <div className={`w-11 h-6 rounded-full p-0.5 transition-colors ${isDark ? 'bg-primary' : 'bg-muted'}`}>
                            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${isDark ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                    </button>

                    {/* Change PIN */}
                    <button
                        onClick={() => {
                            onClose()
                            router.push('/profile/password')
                        }}
                        className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                        <Lock className="w-5 h-5" />
                        <span className="font-medium">Ganti PIN</span>
                    </button>
                </div>

                {/* Logout Button - Sticky at bottom */}
                <div className="p-4 pb-28 border-t border-border bg-card">
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="flex items-center justify-center gap-2 w-full p-3 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive font-medium transition-colors disabled:opacity-50"
                    >
                        <LogOut className="w-5 h-5" />
                        {isLoggingOut ? 'Logging out...' : 'Logout'}
                    </button>
                </div>
            </div>
        </>
    )
}
