'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Toaster } from 'sonner'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { getExportData, getAreaList } from '@/app/actions/admin'
import * as XLSX from 'xlsx'

export default function ExportPage() {
    const [areas, setAreas] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // Filter State
    const [selectedArea, setSelectedArea] = useState('ALL')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    useEffect(() => {
        // Load areas
        getAreaList().then(setAreas)

        // Set default dates to current month
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)

        // FIX: Use WITA timezone instead of UTC toISOString
        const formatWITA = (date: Date) => new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Makassar',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(date)

        setStartDate(formatWITA(start))
        setEndDate(formatWITA(end))
    }, [])

    const handleExport = async () => {
        if (!startDate || !endDate) {
            toast.error('Pilih tanggal mulai dan akhir')
            setError('Pilih tanggal mulai dan akhir')
            return
        }

        toast.loading('Mengambil data...', { id: 'export' })
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const res = await getExportData({
                startDate,
                endDate,
                area: selectedArea
            })

            if (!res.success) {
                throw new Error(res.message || 'Gagal mengambil data')
            }

            // Process Response Data
            // Previous structure: res.data was array of transactions
            // New structure: res.data = { transactions: [], satorSummary: [] }

            const transactions = res.data.transactions || []
            const satorSummary = res.data.satorSummary || []

            if (transactions.length === 0 && satorSummary.length === 0) {
                const errorMsg = `Tidak ada data untuk periode ${startDate} s/d ${endDate}${selectedArea !== 'ALL' ? ` di area ${selectedArea}` : ''}`
                toast.error(errorMsg, {
                    id: 'export',
                    description: 'Coba ubah periode atau pilih area yang berbeda'
                })
                setError(errorMsg)
                setLoading(false)
                return
            }

            // Generate Excel with both datasets
            generateExcel(transactions, satorSummary)

            toast.success(`Berhasil export ${transactions.length} data transaksi!`, {
                id: 'export',
                description: `Periode: ${startDate} s/d ${endDate} | Area: ${selectedArea}`
            })
            setSuccess(`Berhasil export ${transactions.length} data`)
        } catch (err: any) {
            toast.error(err.message || 'Terjadi kesalahan', { id: 'export' })
            setError(err.message || 'Terjadi kesalahan')
        }

        setLoading(false)
    }

    const generateExcel = (transactions: any[], satorSummary: any[]) => {
        const wb = XLSX.utils.book_new()

        // Sheet 1: Summary Report
        const summaryData = [
            ['VAST FINANCE - Data Export'],
            [],
            ['Tanggal Export', new Date().toLocaleString('id-ID')],
            ['Periode', `${startDate} s/d ${endDate}`],
            ['Area', selectedArea],
            ['Total Transaksi', transactions.length],
            ['Total Sator Aktif', satorSummary.length],
            [],
            ['Status Transaksi', 'Jumlah'],
            ['ACC (Closed)', transactions.filter(d => d.status === 'acc' || d.status === 'closed').length],
            ['Pending', transactions.filter(d => d.status === 'pending').length],
            ['Reject', transactions.filter(d => d.status === 'reject').length],
        ]
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

        // Sheet 2: Detail Data Transaksi
        if (transactions.length > 0) {
            const detailData = transactions.map(row => ({
                'Tanggal': row.sale_date,
                'Customer': row.customer_name,
                'Phone': row.customer_phone,
                'Status': row.status?.toUpperCase(),
                'Promotor': row.promoter_name,
                'Sator': row.sator_name,
                'Toko': row.store_name,
                'Area': row.area,
            }))
            const wsDetail = XLSX.utils.json_to_sheet(detailData)
            XLSX.utils.book_append_sheet(wb, wsDetail, 'Data Transaksi')
        }

        // Sheet 3: Rekap Sator (Data from View Database - Accurate Dual Role)
        if (satorSummary.length > 0) {
            const satorData = satorSummary.map(s => ({
                'Nama Sator': s.sator_name,
                'Total Input': s.total_input,
                'ACC / Closing': s.total_closed, // or total_approved depending on view column mapping
                'Pending': s.total_pending,
                'Reject': s.total_rejected
            }))
            const wsSator = XLSX.utils.json_to_sheet(satorData)
            XLSX.utils.book_append_sheet(wb, wsSator, 'Rekap Sator')
        }

        // Sheet 4: Rekap per Area (Calculated from transactions)
        if (transactions.length > 0) {
            const areaStats = transactions.reduce((acc, row) => {
                const area = row.area || 'Unknown'
                if (!acc[area]) {
                    acc[area] = { total: 0, closed: 0, pending: 0, reject: 0 }
                }
                acc[area].total++
                if (row.status === 'acc' || row.status === 'closed') acc[area].closed++
                if (row.status === 'pending') acc[area].pending++
                if (row.status === 'reject') acc[area].reject++
                return acc
            }, {} as Record<string, any>)

            const areaData = Object.entries(areaStats).map(([area, stats]: [string, any]) => ({
                'Area': area,
                'Total': stats.total,
                'ACC': stats.closed,
                'Pending': stats.pending,
                'Reject': stats.reject,
            }))
            const wsArea = XLSX.utils.json_to_sheet(areaData)
            XLSX.utils.book_append_sheet(wb, wsArea, 'Rekap Area')
        }

        // Sheet 5: Rekap per Promotor (Calculated from transactions)
        if (transactions.length > 0) {
            const promotorStats = transactions.reduce((acc, row) => {
                const name = row.promoter_name || 'Unknown'
                if (!acc[name]) {
                    acc[name] = { area: row.area, total: 0, closed: 0, pending: 0, reject: 0 }
                }
                acc[name].total++
                if (row.status === 'acc' || row.status === 'closed') acc[name].closed++
                if (row.status === 'pending') acc[name].pending++
                if (row.status === 'reject') acc[name].reject++
                return acc
            }, {} as Record<string, any>)

            const promotorData = Object.entries(promotorStats).map(([name, stats]: [string, any]) => ({
                'Promotor': name,
                'Area': stats.area,
                'Total': stats.total,
                'ACC': stats.closed,
                'Pending': stats.pending,
                'Reject': stats.reject,
            }))
            const wsPromotor = XLSX.utils.json_to_sheet(promotorData)
            XLSX.utils.book_append_sheet(wb, wsPromotor, 'Rekap Promotor')
        }

        // Download File
        const fileName = `VAST_Export_${selectedArea}_${startDate}_${endDate}.xlsx`
        XLSX.writeFile(wb, fileName)
    }

    return (
        <DashboardLayout requiredRole="admin">
            <Toaster position="top-center" richColors />
            <div className="min-h-screen bg-background p-4 pb-24">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/admin" className="text-sm text-primary hover:underline inline-flex items-center gap-1 mb-3">
                        ← Kembali
                    </Link>
                    <h1 className="text-2xl font-bold text-foreground">Data Export</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Download laporan data transaksi dalam format Excel
                    </p>
                </div>

                <div className="max-w-2xl mx-auto">
                    {/* Main Card */}
                    <Card className="shadow-lg">
                        <CardHeader className="border-b bg-muted/30">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <span className="text-2xl">📊</span>
                                Filter Export
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            {/* Area Selection */}
                            <div className="space-y-2">
                                <Label className="text-base font-semibold">Area</Label>
                                <Select value={selectedArea} onValueChange={setSelectedArea}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Pilih Area" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">
                                            <span className="font-semibold">📍 Semua Area</span>
                                        </SelectItem>
                                        {areas.map(area => (
                                            <SelectItem key={area} value={area}>
                                                📍 {area}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Pilih area spesifik atau semua area untuk laporan
                                </p>
                            </div>

                            {/* Date Range */}
                            <div className="space-y-2">
                                <Label className="text-base font-semibold">Periode Tanggal</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Dari</Label>
                                        <Input
                                            type="date"
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                            className="h-11"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Sampai</Label>
                                        <Input
                                            type="date"
                                            value={endDate}
                                            onChange={e => setEndDate(e.target.value)}
                                            className="h-11"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Data akan difilter berdasarkan tanggal transaksi
                                </p>
                            </div>


                            {/* Error / Success Messages */}
                            {error && (
                                <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-4">
                                    <div className="flex gap-2 items-start">
                                        <span className="text-xl">❌</span>
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm mb-1">Export Gagal</p>
                                            <p className="text-xs">{error}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {success && (
                                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 rounded-lg p-4">
                                    <div className="flex gap-2 items-start">
                                        <span className="text-xl">✅</span>
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm mb-1">Export Berhasil!</p>
                                            <p className="text-xs">{success}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Export Button */}
                            <Button
                                onClick={handleExport}
                                disabled={loading || !startDate || !endDate}
                                className="w-full h-12 text-base font-semibold"
                                size="lg"
                            >
                                {loading ? (
                                    <>
                                        <span className="animate-spin mr-2">⏳</span>
                                        Memproses Export...
                                    </>
                                ) : (
                                    <>
                                        <span className="mr-2">📥</span>
                                        Download Excel
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Help Card */}
                    <Card className="mt-4 bg-muted/30">
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">
                                <strong>Tips:</strong> Untuk laporan bulanan, pilih tanggal 1 s/d tanggal akhir bulan.
                                Jika tidak ada data, coba periode yang lebih lama atau pastikan ada transaksi di periode tersebut.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    )
}
