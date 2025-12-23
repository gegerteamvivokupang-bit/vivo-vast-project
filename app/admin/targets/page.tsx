'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Toaster } from 'sonner'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { getAvailableTargetPeriods } from '@/app/actions/targets'

export default function TargetLandingPage() {
    const router = useRouter()
    const [periods, setPeriods] = useState<{ year: number, month: number }[]>([])
    const [loading, setLoading] = useState(true)
    const [openDialog, setOpenDialog] = useState(false)

    // New Target Form State
    const now = new Date()
    const [selectedYear, setSelectedYear] = useState<string>(now.getFullYear().toString())
    const [selectedMonth, setSelectedMonth] = useState<string>((now.getMonth() + 2).toString()) // Default next month

    useEffect(() => {
        loadPeriods()
    }, [])

    const loadPeriods = async () => {
        setLoading(true)
        const res = await getAvailableTargetPeriods()
        if (res.success) {
            setPeriods(res.data || [])
        } else {
            toast.error('Gagal memuat list target: ' + res.message)
        }
        setLoading(false)
    }

    const handleCreate = () => {
        const year = parseInt(selectedYear)
        const month = parseInt(selectedMonth)

        // Navigate to editor
        router.push(`/admin/targets/${year}/${month}`)
    }

    return (
        <DashboardLayout requiredRole="admin">
            <Toaster position="top-center" richColors />
            <div className="min-h-screen bg-background p-4 pb-24">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Header */}
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <Link href="/admin" className="text-sm text-primary hover:underline">← Kembali ke Admin</Link>
                            <h1 className="text-3xl font-bold mt-2">Target Management</h1>
                            <p className="text-muted-foreground">Kelola target bulanan tim anda.</p>
                        </div>
                        {periods.length > 0 && (
                            <Button onClick={() => setOpenDialog(true)} className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                                + Buat Target Baru
                            </Button>
                        )}
                    </div>

                    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Buat Target Baru</DialogTitle>
                                <DialogDescription>
                                    Pilih periode bulan dan tahun untuk target baru.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Tahun</label>
                                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 2030 - (now.getFullYear() - 1) + 1 }, (_, i) => {
                                                const y = (now.getFullYear() - 1) + i
                                                return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Bulan</label>
                                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                                                const isTaken = periods.some(p => p.year === parseInt(selectedYear) && p.month === m)
                                                return (
                                                    <SelectItem key={m} value={m.toString()}>
                                                        {new Date(2000, m - 1, 1).toLocaleDateString('id-ID', { month: 'long' })}
                                                        {isTaken ? ' ✅ (Sudah Ada)' : ' 🆕 (Baru)'}
                                                    </SelectItem>
                                                )
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setOpenDialog(false)}>Batal</Button>
                                <Button onClick={handleCreate}>Lanjut ke Editor →</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Periods List */}
                    <div className="grid gap-4">
                        {loading ? (
                            <div className="text-center p-8 text-muted-foreground">Memuat...</div>
                        ) : periods.length === 0 ? (
                            <Card className="border-dashed">
                                <CardContent className="flex flex-col items-center justify-center p-12 space-y-4">
                                    <div className="text-4xl">📅</div>
                                    <div className="text-xl font-semibold">Belum ada target</div>
                                    <p className="text-muted-foreground text-center max-w-sm">
                                        Anda belum membuat target untuk bulan apapun. Silakan buat target baru.
                                    </p>
                                    <Button onClick={() => setOpenDialog(true)}>+ Buat Target Pertama</Button>
                                </CardContent>
                            </Card>
                        ) : (
                            periods.map((p, i) => {
                                const date = new Date(p.year, p.month - 1, 1)
                                const label = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
                                const isPast = date < new Date(now.getFullYear(), now.getMonth(), 1)
                                const isCurrent = p.year === now.getFullYear() && p.month === (now.getMonth() + 1)

                                return (
                                    <Card key={`${p.year}-${p.month}`} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => router.push(`/admin/targets/${p.year}/${p.month}`)}>
                                        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-xl sm:text-2xl">
                                                    📅
                                                </div>
                                                <div>
                                                    <h3 className="text-base sm:text-lg font-bold leading-tight">{label}</h3>
                                                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                                                        Target tersimpan.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 justify-end w-full sm:w-auto pl-14 sm:pl-0">
                                                {isCurrent && <Badge className="bg-green-100 text-green-800 hover:bg-green-100 whitespace-nowrap text-xs">Bulan Ini</Badge>}
                                                {isPast && <Badge variant="outline" className="text-muted-foreground whitespace-nowrap text-xs">Lewat</Badge>}
                                                <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                                                    Edit <span className="hidden sm:inline ml-1">Target</span> →
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
