'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';

interface SpvHeaderProps {
    title: string;
    subtitle?: string;
    icon?: string;
    backUrl?: string;
}

export default function SpvHeader({
    title,
    subtitle,
    icon = '👔',
    backUrl
}: SpvHeaderProps) {
    const { signOut } = useAuth();
    const router = useRouter();
    const { confirm } = useConfirm();

    const handleLogout = async () => {
        const confirmed = await confirm({
            title: 'Logout',
            message: 'Yakin ingin keluar dari akun?',
            confirmText: 'Logout',
            cancelText: 'Batal',
            type: 'danger'
        });
        if (confirmed) {
            signOut();
        }
    };

    return (
        <div className="bg-primary p-4 shadow-md">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {backUrl ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(backUrl)}
                            className="w-10 h-10 bg-card/20 hover:bg-card/30 rounded-full text-primary-foreground"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                    ) : (
                        <div className="w-10 h-10 bg-card/20 rounded-full flex items-center justify-center">
                            <span className="text-xl">{icon}</span>
                        </div>
                    )}
                    <div>
                        <p className="text-primary-foreground/70 text-xs">{title}</p>
                        {subtitle && <h1 className="text-primary-foreground font-bold text-lg">{subtitle}</h1>}
                    </div>
                </div>

                {/* Logout Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="w-9 h-9 bg-card/10 hover:bg-card/20 rounded-full"
                    title="Logout"
                >
                    <LogOut className="h-4 w-4 text-primary-foreground" />
                </Button>
            </div>
        </div>
    );
}
