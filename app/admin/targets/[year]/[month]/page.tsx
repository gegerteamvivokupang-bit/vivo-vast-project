'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Toaster } from 'sonner'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import {
    getTargetList,
    copyTargetsFromPreviousMonth,
    validateHierarchicalTargets,
    saveTargets,
    type TargetUser
} from '@/app/actions/targets'
import { useAuth } from '@/contexts/AuthContext'

type TabType = 'spv' | 'sator' | 'promotor'

// Editor Page for specific period
type Props = {
    params: Promise<{ year: string; month: string }>
}

export default function AdminTargetEditorPage({ params }: Props) {
    const { year, month } = use(params)
    const { user } = useAuth()
    const [activeTab, setActiveTab] = useState<TabType>('spv')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [isEditing, setIsEditing] = useState(false)

    const [spvTargets, setSpvTargets] = useState<TargetUser[]>([])
    const [satorTargets, setSatorTargets] = useState<TargetUser[]>([])
    const [promotorTargets, setPromotorTargets] = useState<TargetUser[]>([])

    const [areaFilter, setAreaFilter] = useState<string>('ALL')
    const [areas, setAreas] = useState<string[]>([])

    // Parse params
    const periodYear = parseInt(year)
    const periodMonth = parseInt(month)
    const periodDate = new Date(periodYear, periodMonth - 1, 1) // Month is 0-indexed
    const periodLabel = periodDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })


    useEffect(() => {
        loadAllTargets()
    }, [])

    const loadAllTargets = async () => {
        setLoading(true)
        toast.loading('Memuat data target...', { id: 'load' })

        try {
            const [spvRes, satorRes, promotorRes] = await Promise.all([
                getTargetList('spv', periodMonth, periodYear),
                getTargetList('sator', periodMonth, periodYear),
                getTargetList('promotor', periodMonth, periodYear)
            ])

            if (spvRes.success) setSpvTargets(spvRes.data as TargetUser[])
            if (satorRes.success) setSatorTargets(satorRes.data as TargetUser[])
            if (promotorRes.success) setPromotorTargets(promotorRes.data as TargetUser[])

            const allUsers = [...(spvRes.data || []), ...(satorRes.data || []), ...(promotorRes.data || [])]
            const uniqueAreas = [...new Set(allUsers.map((u: any) => u.area).filter(Boolean))] as string[]
            setAreas(uniqueAreas.sort())

            // If no total targets set at all, auto enter edit mode
            const totalExistingTarget = (spvRes.data as TargetUser[] || []).reduce((acc, u) => acc + u.current_target, 0)
            if (totalExistingTarget === 0) {
                setIsEditing(true)
            } else {
                setIsEditing(false)
            }

            toast.success('Data berhasil dimuat', { id: 'load' })
        } catch (error: any) {
            toast.error('Gagal memuat data: ' + error.message, { id: 'load' })
        } finally {
            setLoading(false)
        }
    }

    const handleCopyFromPreviousMonth = async () => {
        if (!confirm(`Copy target dari bulan sebelumnya?\n\nTarget yang sudah ada akan ditimpa.`)) return

        toast.loading('Menyalin target...', { id: 'copy' })
        const res = await copyTargetsFromPreviousMonth(periodMonth, periodYear)

        if (!res.success) {
            toast.error(res.message, { id: 'copy', duration: 5000 })
            return
        }

        const copiedTargets = res.data || []
        const targetMap = new Map(copiedTargets.map((t: any) => [t.user_id, t.target_value]))

        setSpvTargets(prev => prev.map(u => ({ ...u, new_target: targetMap.get(u.user_id) || u.new_target })))
        setSatorTargets(prev => prev.map(u => ({ ...u, new_target: targetMap.get(u.user_id) || u.new_target })))
        setPromotorTargets(prev => prev.map(u => ({ ...u, new_target: targetMap.get(u.user_id) || u.new_target })))

        toast.success(res.message, { id: 'copy' })
    }

    const handleTargetChange = (userId: string, value: number, level: TabType) => {
        const setter = level === 'spv' ? setSpvTargets : level === 'sator' ? setSatorTargets : setPromotorTargets
        setter(prev => prev.map(u => u.user_id === userId ? { ...u, new_target: value } : u))
    }

    const handleBulkSetPromotor = (satorId: string, value: number) => {
        setPromotorTargets(prev => prev.map(p =>
            p.atasan_id === satorId ? { ...p, new_target: value } : p
        ))
        toast.success('Target semua promotor di-update')
    }

    const handleSave = async () => {
        setSaving(true)
        toast.loading('Memvalidasi target...', { id: 'save' })

        const validation = await validateHierarchicalTargets(spvTargets, satorTargets, promotorTargets)

        if (!validation.isValid) {
            toast.error('Validasi gagal!', { id: 'save' })
            validation.errors.forEach((err, i) => {
                setTimeout(() => toast.error(err, { duration: 8000 }), i * 100)
            })
            setSaving(false)
            return
        }

        // FIX: For dual-role SPV, sync the new_target from satorTargets to new_target_as_sator
        // This ensures the SPV's sator target is saved as 'as_sator', not 'primary'
        const spvTargetsWithSatorSync = spvTargets.map(spv => {
            const satorRecord = satorTargets.find(s => s.user_id === spv.user_id && s.role === 'spv')
            if (satorRecord) {
                // Dual-role SPV: sync sator tab's new_target to new_target_as_sator
                return { ...spv, new_target_as_sator: satorRecord.new_target }
            }
            return spv
        })

        // Only include regular sators (not dual-role SPV) to avoid duplicate processing
        const regularSators = satorTargets.filter(s => s.role !== 'spv')

        const allTargets = [...spvTargetsWithSatorSync, ...regularSators, ...promotorTargets]
        const res = await saveTargets(allTargets, periodMonth, periodYear, user?.id || '')

        if (res.success) {
            toast.success(res.message, { id: 'save' })
            loadAllTargets()
        } else {
            toast.error(res.message, { id: 'save' })
        }

        setSaving(false)
    }

    const getFilteredData = (): TargetUser[] => {
        let data = activeTab === 'spv' ? spvTargets : activeTab === 'sator' ? satorTargets : promotorTargets
        if (areaFilter !== 'ALL') {
            data = data.filter(u => u.area === areaFilter)
        }
        // Sort by area first, then by name
        data = data.sort((a, b) => {
            if (a.area !== b.area) {
                return (a.area || '').localeCompare(b.area || '')
            }
            return a.name.localeCompare(b.name)
        })
        return data
    }

    const hasChanges = () => {
        return [...spvTargets, ...satorTargets, ...promotorTargets].some(u => u.new_target !== u.current_target)
    }

    const promotorsBySator = new Map<string, TargetUser[]>()
    promotorTargets.forEach(p => {
        if (p.atasan_id) {
            if (!promotorsBySator.has(p.atasan_id)) {
                promotorsBySator.set(p.atasan_id, [])
            }
            promotorsBySator.get(p.atasan_id)!.push(p)
        }
    })

    // Sort promotors within each sator group
    promotorsBySator.forEach((promotors, satorId) => {
        promotors.sort((a, b) => a.name.localeCompare(b.name))
    })

    const filteredData = getFilteredData()

    return (
        <DashboardLayout requiredRole="admin">
            <Toaster position="top-center" richColors />
            <div className="min-h-screen bg-background p-4 pb-24">
                <div className="max-w-7xl mx-auto space-y-4">
                    {/* Header */}
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                        <div>
                            <Link href="/admin/targets" className="text-sm text-primary hover:underline">← Kembali ke List</Link>
                            <h1 className="text-2xl font-bold mt-2">Target Management</h1>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>Periode: {periodLabel}</span>
                                {loading ? null : spvTargets.every(t => t.current_target === 0) && (
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
                                        🆕 DRAFT BARU
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            {!isEditing ? (
                                <Button onClick={() => setIsEditing(true)} className="w-full md:w-auto">
                                    ✏️ Edit Target
                                </Button>
                            ) : (
                                <div className="flex gap-2 w-full md:w-auto">
                                    <Button variant="ghost" className="flex-1 md:flex-none" onClick={() => {
                                        if (confirm('Batalkan perubahan?')) {
                                            loadAllTargets() // Reload to reset changes
                                            setIsEditing(false)
                                        }
                                    }}>
                                        ❌ Batal
                                    </Button>
                                    <Button onClick={handleSave} disabled={saving || !hasChanges()} className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white">
                                        {saving ? '⏳ Saving...' : <span className="md:hidden">💾 Simpan</span>}
                                        <span className="hidden md:inline">{saving ? 'Menyimpan...' : '💾 Simpan Target'}</span>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Tabs */}
                        <Card>
                            <CardContent className="p-4">
                                <div className="grid grid-cols-3 gap-2">
                                    {(['spv', 'sator', 'promotor'] as TabType[]).map(tab => {
                                        const data = tab === 'spv' ? spvTargets : tab === 'sator' ? satorTargets : promotorTargets
                                        const count = areaFilter === 'ALL' ? data.length : data.filter(u => u.area === areaFilter).length
                                        return (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveTab(tab)}
                                                className={`py-2 px-3 rounded text-sm font-medium transition ${activeTab === tab
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                                                    }`}
                                            >
                                                {tab.toUpperCase()} ({count})
                                            </button>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Actions */}
                        <Card>
                            <CardContent className="p-4">
                                <div className="grid grid-cols-2 gap-2">
                                    {isEditing ? (
                                        <Button
                                            variant="outline"
                                            onClick={handleCopyFromPreviousMonth}
                                            disabled={loading}
                                            className="w-full"
                                        >
                                            📋 Copy Bulan Lalu
                                        </Button>
                                    ) : (
                                        <div className="flex items-center justify-center text-sm text-muted-foreground bg-muted rounded h-10">
                                            <span>Read Only Mode</span>
                                        </div>
                                    )}
                                    <Select value={areaFilter} onValueChange={setAreaFilter}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">📍 Semua Area</SelectItem>
                                            {areas.map(area => (
                                                <SelectItem key={area} value={area}>📍 {area}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Target List */}
                    <Card>
                        <CardHeader className="border-b px-4 py-3">
                            <CardTitle className="text-base">Target {activeTab.toUpperCase()}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-8 text-center text-muted-foreground">Memuat...</div>
                            ) : filteredData.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">Tidak ada data</div>
                            ) : activeTab === 'promotor' ? (
                                /* Promotor - Grouped by Sator */
                                <div className="divide-y">
                                    {Array.from(promotorsBySator.entries())
                                        .filter(([satorId]) => {
                                            const sator = satorTargets.find(s => s.user_id === satorId)
                                            return areaFilter === 'ALL' || sator?.area === areaFilter
                                        })
                                        .map(([satorId, promotors]) => {
                                            const sator = satorTargets.find(s => s.user_id === satorId)
                                            const total = promotors.reduce((sum, p) => sum + p.new_target, 0)
                                            const target = sator?.new_target || 0
                                            const valid = total >= target

                                            return (
                                                <div key={satorId} className="p-4 bg-muted/10">
                                                    {/* Group Header */}
                                                    <div className="grid grid-cols-12 gap-4 items-center mb-3 pb-3 border-b">
                                                        <div className="col-span-4">
                                                            <div className="font-medium">Sator: {sator?.name}</div>
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                {sator?.area}
                                                                {sator?.role === 'spv' && <span className="ml-2 text-purple-600">• Dual Role</span>}
                                                            </div>
                                                        </div>
                                                        <div className="col-span-2 text-center text-sm">
                                                            <div className="text-xs text-muted-foreground mb-1">Target</div>
                                                            <div className="font-semibold">{target}</div>
                                                        </div>
                                                        <div className="col-span-2 text-center text-sm">
                                                            <div className="text-xs text-muted-foreground mb-1">Total</div>
                                                            <div className={`font-semibold ${valid ? 'text-green-600' : 'text-red-600'}`}>
                                                                {total}
                                                            </div>
                                                        </div>
                                                        {isEditing && (
                                                            <div className="col-span-4">
                                                                <div className="text-xs text-muted-foreground mb-1 text-center">Bulk Set</div>
                                                                <Input
                                                                    type="number"
                                                                    inputMode="numeric"
                                                                    placeholder="Set semua..."
                                                                    id={`bulk-${satorId}`}
                                                                    className="text-center font-semibold text-base"
                                                                    onFocus={(e) => e.target.select()}
                                                                    onBlur={(e) => {
                                                                        const val = parseInt(e.target.value) || 0
                                                                        if (val > 0) {
                                                                            handleBulkSetPromotor(satorId, val)
                                                                            e.target.value = ''
                                                                        }
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            const val = parseInt((e.target as HTMLInputElement).value) || 0
                                                                            if (val > 0) {
                                                                                handleBulkSetPromotor(satorId, val);
                                                                                (e.target as HTMLInputElement).value = ''
                                                                            }
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                        {!isEditing && <div className="col-span-4"></div>}
                                                    </div>

                                                    {/* Promotor Rows */}
                                                    <div className="space-y-2">
                                                        {promotors.map(p => {
                                                            const changed = p.new_target !== p.current_target
                                                            return (
                                                                <div key={p.user_id} className="grid grid-cols-12 gap-4 items-center py-2 px-3 bg-background rounded">
                                                                    <div className="col-span-9">
                                                                        <div className="text-sm">{p.name}</div>
                                                                        {changed && (
                                                                            <div className="text-xs text-orange-600">
                                                                                {p.current_target} → {p.new_target}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="col-span-3 text-center">
                                                                        {isEditing ? (
                                                                            <Input
                                                                                type="number"
                                                                                inputMode="numeric"
                                                                                min="0"
                                                                                value={p.new_target}
                                                                                onChange={(e) => handleTargetChange(p.user_id, parseInt(e.target.value) || 0, 'promotor')}
                                                                                onFocus={(e) => e.target.select()}
                                                                                className={`text-center font-semibold ${changed ? 'border-orange-500' : ''}`}
                                                                            />
                                                                        ) : (
                                                                            <div className="font-bold text-lg">{p.new_target}</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>
                            ) : (
                                /* SPV & Sator */
                                <div className="divide-y">
                                    {filteredData.map((item, index) => {
                                        const changed = item.new_target !== item.current_target

                                        // Show area header when area changes
                                        const showAreaHeader = index === 0 || filteredData[index - 1].area !== item.area

                                        let subTotal = 0
                                        let subLabel = ''
                                        if (activeTab === 'spv') {
                                            // Sum subordinates
                                            subTotal = satorTargets.filter(s => s.atasan_id === item.user_id).reduce((sum, s) => sum + s.new_target, 0)

                                            // Plus self if Dual Role (SPV acting as Sator)
                                            const selfAsSator = satorTargets.find(s => s.user_id === item.user_id)
                                            if (selfAsSator) {
                                                subTotal += selfAsSator.new_target
                                            }

                                            subLabel = 'Total Target Sator'
                                        } else if (activeTab === 'sator') {
                                            subTotal = promotorTargets.filter(p => p.atasan_id === item.user_id).reduce((sum, p) => sum + p.new_target, 0)
                                            subLabel = 'Total Target Promotor'
                                        }

                                        const valid = subTotal >= item.new_target

                                        return (
                                            <div key={item.user_id}>
                                                {showAreaHeader && (
                                                    <div className="bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                        📍 {item.area}
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-12 gap-4 items-center p-4 hover:bg-muted/20">
                                                    <div className="col-span-5">
                                                        <div className="font-medium">{item.name}</div>
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            {item.role === 'spv' && activeTab === 'sator' && <span className="text-purple-600">• Dual Role</span>}
                                                        </div>
                                                    </div>

                                                    {subLabel && (
                                                        <>
                                                            <div className="col-span-2 text-center text-sm">
                                                                <div className="text-xs text-muted-foreground mb-1">{subLabel}</div>
                                                                <div className={`font-semibold ${valid ? 'text-green-600' : 'text-red-600'}`}>
                                                                    {subTotal}
                                                                </div>
                                                            </div>
                                                            <div className="col-span-2 text-center">
                                                                {!valid && <span className="text-xs text-red-600">⚠️ Kurang {item.new_target - subTotal}</span>}
                                                            </div>
                                                        </>
                                                    )}

                                                    {!subLabel && <div className="col-span-4"></div>}

                                                    <div className="col-span-3 text-center">
                                                        {isEditing ? (
                                                            <>
                                                                <Input
                                                                    type="number"
                                                                    inputMode="numeric"
                                                                    min="0"
                                                                    value={item.new_target}
                                                                    onChange={(e) => handleTargetChange(item.user_id, parseInt(e.target.value) || 0, activeTab)}
                                                                    onFocus={(e) => e.target.select()}
                                                                    className={`text-center font-bold text-lg ${changed ? 'border-orange-500' : ''}`}
                                                                />
                                                                {changed && (
                                                                    <div className="text-xs text-orange-600 text-center mt-1">
                                                                        {item.current_target} → {item.new_target}
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="font-bold text-xl">{item.new_target}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Info */}
                    <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                        <CardContent className="p-4 text-xs text-blue-800 dark:text-blue-300">
                            <strong>💡 Tips:</strong> Total target bawahan harus ≥ target atasan • Bulk Set: ketik angka lalu Enter
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    )
}
