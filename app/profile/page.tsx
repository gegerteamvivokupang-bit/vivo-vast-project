'use client';

import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Loading } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
    const { user, signOut, loading } = useAuth();

    if (loading) {
        return (
            <DashboardLayout>
                <Loading message="Memuat profil..." />
            </DashboardLayout>
        );
    }

    const handleLogout = () => {
        if (confirm('Yakin ingin logout?')) {
            signOut();
        }
    };

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-background p-4 pb-24">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-foreground">👤 Profile</h1>
                    <p className="text-sm text-muted-foreground mt-1">Informasi akun Anda</p>
                </div>

                {/* Profile Card */}
                <Card className="overflow-hidden mb-4">
                    {/* Avatar Header */}
                    <div className="bg-primary p-6 text-center">
                        <div className="w-20 h-20 bg-card rounded-full mx-auto flex items-center justify-center text-3xl font-bold text-primary">
                            {user?.name?.charAt(0) || '?'}
                        </div>
                        <h2 className="text-primary-foreground font-bold text-lg mt-3">{user?.name || 'User'}</h2>
                        <span className="inline-block bg-card/20 text-primary-foreground text-xs px-3 py-1 rounded-full mt-2">
                            {user?.role?.toUpperCase()}
                        </span>
                    </div>

                    {/* Info List */}
                    <CardContent className="p-4 space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-muted-foreground text-sm">Email</span>
                            <span className="text-foreground font-medium">{user?.email}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-muted-foreground text-sm">Employee ID</span>
                            <span className="text-foreground font-medium">{user?.employee_id || '-'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-muted-foreground text-sm">Area</span>
                            <span className="text-foreground font-medium">{user?.area || '-'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-muted-foreground text-sm">Status</span>
                            <span className={cn(
                                "px-2 py-1 rounded-full text-xs font-medium",
                                user?.status === 'active'
                                    ? 'bg-success/10 text-success'
                                    : 'bg-destructive/10 text-destructive'
                            )}>
                                {user?.status?.toUpperCase()}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-muted-foreground text-sm">User ID</span>
                            <span className="text-muted-foreground text-xs font-mono">{user?.id?.slice(0, 8)}...</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Logout Button */}
                <Button
                    onClick={handleLogout}
                    variant="destructive"
                    fullWidth
                    size="lg"
                    className="font-semibold"
                >
                    🚪 Logout
                </Button>

                {/* Version Info */}
                <p className="text-center text-muted-foreground text-xs mt-6">
                    VAST Finance v1.0
                </p>
            </div>
        </DashboardLayout>
    );
}
