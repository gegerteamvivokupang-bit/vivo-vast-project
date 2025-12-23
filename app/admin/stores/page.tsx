'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Toaster } from 'sonner'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import {
    getStores,
    getAreaList,
    createStore,
    updateStore,
    deleteStore,
    type CreateStoreData
} from '@/app/actions/admin'

interface Store {
    id: string
    name: string
    area: string
    is_spc: boolean
    created_at: string
}

type FormMode = 'list' | 'add' | 'edit'

export default function StoreManagementPage() {
    const [stores, setStores] = useState<Store[]>([])
    const [areas, setAreas] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [formMode, setFormMode] = useState<FormMode>('list')
    const [editingStore, setEditingStore] = useState<Store | null>(null)
    const [formLoading, setFormLoading] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Filters
    const [search, setSearch] = useState('')
    const [areaFilter, setAreaFilter] = useState('all')

    // New area creation
    const [isCreatingNewArea, setIsCreatingNewArea] = useState(false)
    const [newAreaName, setNewAreaName] = useState('')

    // Form fields
    const [formData, setFormData] = useState({
        name: '',
        area: '',
        is_spc: false
    })

    useEffect(() => {
        getAreaList().then(setAreas)
    }, [])

    const fetchStores = useCallback(async () => {
        setLoading(true)
        setError(null)

        const filter: { search?: string; area?: string } = {}
        if (search) filter.search = search
        if (areaFilter !== 'all') filter.area = areaFilter

        const res = await getStores(filter)

        if (res.success) {
            setStores(res.data as Store[])
        } else {
            setError(res.message || 'Gagal memuat data')
        }
        setLoading(false)
    }, [search, areaFilter])

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchStores()
        }, 300)
        return () => clearTimeout(timer)
    }, [fetchStores])

    const handleAddNew = () => {
        setFormData({ name: '', area: '', is_spc: false })
        setEditingStore(null)
        setFormError(null)
        setIsCreatingNewArea(false)
        setFormMode('add')
    }

    const handleEdit = (store: Store) => {
        setFormData({
            name: store.name,
            area: store.area,
            is_spc: store.is_spc
        })
        setEditingStore(store)
        setFormError(null)
        setIsCreatingNewArea(false)
        setFormMode('edit')
    }

    const handleCancel = () => {
        setFormMode('list')
        setEditingStore(null)
        setFormError(null)
        setIsCreatingNewArea(false)
    }

    const handleDelete = async (storeId: string) => {
        const store = stores.find(s => s.id === storeId)
        if (!confirm(`Yakin ingin menghapus toko "${store?.name}"?\n\nCatatan: Toko dengan promotor atau transaksi tidak dapat dihapus.`)) return

        setActionLoading(storeId)
        const res = await deleteStore(storeId)

        if (res.success) {
            toast.success(res.message || 'Toko berhasil dihapus')
            fetchStores()
        } else {
            toast.error(res.message || 'Gagal menghapus toko', {
                duration: 5000 // Longer duration for error messages
            })
        }
        setActionLoading(null)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setFormLoading(true)
        setFormError(null)

        if (!formData.name || !formData.area) {
            setFormError('Nama dan Area wajib diisi')
            setFormLoading(false)
            return
        }

        if (formMode === 'add') {
            const res = await createStore({
                name: formData.name,
                area: formData.area,
                is_spc: formData.is_spc
            })

            if (res.success) {
                setFormMode('list')
                fetchStores()
                // Refresh area list
                getAreaList().then(setAreas)
            } else {
                setFormError(res.message || 'Gagal menambah toko')
            }
        } else if (formMode === 'edit' && editingStore) {
            const res = await updateStore(editingStore.id, {
                name: formData.name,
                area: formData.area,
                is_spc: formData.is_spc
            })

            if (res.success) {
                setFormMode('list')
                fetchStores()
                getAreaList().then(setAreas)
            } else {
                setFormError(res.message || 'Gagal mengupdate toko')
            }
        }

        setFormLoading(false)
    }

    // Group stores by area for display
    const storesByArea = stores.reduce((acc, store) => {
        const area = store.area || 'Tanpa Area'
        if (!acc[area]) acc[area] = []
        acc[area].push(store)
        return acc
    }, {} as Record<string, Store[]>)

    // Form View
    if (formMode !== 'list') {
        return (
            <DashboardLayout requiredRole="admin">
                <div className="min-h-screen bg-background p-4 pb-24">
                    <div className="mb-4">
                        <button onClick={handleCancel} className="text-sm text-primary hover:underline">
                            {'<'} Kembali
                        </button>
                        <h1 className="text-xl font-bold text-foreground mt-2">
                            {formMode === 'add' ? 'Tambah Toko Baru' : 'Edit Toko'}
                        </h1>
                    </div>

                    <Card>
                        <CardContent className="p-4">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nama Toko</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                                        placeholder="NAMA TOKO"
                                        className="uppercase"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Area</Label>
                                    {!isCreatingNewArea ? (
                                        <>
                                            <Select
                                                value={formData.area}
                                                onValueChange={(v) => setFormData(prev => ({ ...prev, area: v }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Pilih area..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {areas.length === 0 ? (
                                                        <SelectItem value="__disabled__" disabled>Tidak ada area tersedia</SelectItem>
                                                    ) : (
                                                        areas.map(area => (
                                                            <SelectItem key={area} value={area}>{area}</SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsCreatingNewArea(true)
                                                    setFormData(prev => ({ ...prev, area: '' }))
                                                }}
                                                className="text-xs text-primary hover:underline"
                                            >
                                                + Buat area baru
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <Input
                                                value={formData.area}
                                                onChange={e => setFormData(prev => ({ ...prev, area: e.target.value.toUpperCase() }))}
                                                placeholder="NAMA AREA BARU (misal: JAKARTA)"
                                                className="uppercase"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsCreatingNewArea(false)
                                                    setFormData(prev => ({ ...prev, area: areas[0] || '' }))
                                                }}
                                                className="text-xs text-muted-foreground hover:underline"
                                            >
                                                ← Pilih dari yang sudah ada
                                            </button>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="is_spc"
                                        checked={formData.is_spc}
                                        onChange={e => setFormData(prev => ({ ...prev, is_spc: e.target.checked }))}
                                        className="w-4 h-4"
                                    />
                                    <Label htmlFor="is_spc">SPC Grup</Label>
                                </div>

                                {formError && (
                                    <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                                        {formError}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" onClick={handleCancel} className="flex-1">
                                        Batal
                                    </Button>
                                    <Button type="submit" disabled={formLoading} className="flex-1">
                                        {formLoading ? 'Menyimpan...' : 'Simpan'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        )
    }

    // List View
    return (
        <DashboardLayout requiredRole="admin">
            <Toaster position="top-center" richColors />
            <div className="min-h-screen bg-background p-4 pb-24">
                {/* Header */}
                <div className="mb-4 flex justify-between items-start">
                    <div>
                        <Link href="/admin" className="text-sm text-primary hover:underline">
                            {'<'} Kembali
                        </Link>
                        <h1 className="text-xl font-bold text-foreground mt-2">Store Management</h1>
                        <p className="text-sm text-muted-foreground">
                            Daftar toko yang terdaftar dalam sistem
                        </p>
                    </div>
                    <Button onClick={handleAddNew} size="sm">
                        + Tambah
                    </Button>
                </div>

                {/* Filters */}
                <Card className="mb-4">
                    <CardContent className="p-4 space-y-3">
                        <Input
                            placeholder="Cari nama toko..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <Select value={areaFilter} onValueChange={setAreaFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter Area" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Area</SelectItem>
                                {areas.map(area => (
                                    <SelectItem key={area} value={area}>{area}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                {/* Error */}
                {error && (
                    <Card className="mb-4 border-destructive">
                        <CardContent className="p-4 text-destructive text-sm">
                            {error}
                        </CardContent>
                    </Card>
                )}

                {/* Store Count */}
                <div className="text-sm text-muted-foreground mb-3">
                    {loading ? 'Memuat...' : `${stores.length} toko ditemukan`}
                </div>

                {/* Store List */}
                {loading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Card key={i} className="animate-pulse">
                                <CardContent className="p-4 h-16 bg-muted/30" />
                            </Card>
                        ))}
                    </div>
                ) : stores.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            Tidak ada toko ditemukan
                        </CardContent>
                    </Card>
                ) : areaFilter === 'all' ? (
                    // Show grouped by area
                    <div className="space-y-4">
                        {Object.entries(storesByArea).map(([area, areaStores]) => (
                            <div key={area}>
                                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                                    {area}
                                    <Badge variant="secondary" className="text-xs">
                                        {areaStores.length}
                                    </Badge>
                                </h3>
                                <div className="space-y-2">
                                    {areaStores.map(store => (
                                        <Card key={store.id}>
                                            <CardContent className="p-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1" onClick={() => handleEdit(store)} style={{ cursor: 'pointer' }}>
                                                        <div className="font-medium text-foreground text-sm">
                                                            {store.name}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {store.is_spc && (
                                                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                                SPC
                                                            </Badge>
                                                        )}
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleEdit(store)}
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(store.id)}
                                                            disabled={actionLoading === store.id}
                                                            className="text-destructive hover:text-destructive"
                                                        >
                                                            {actionLoading === store.id ? '...' : 'Hapus'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    // Show flat list when filtered
                    <div className="space-y-2">
                        {stores.map(store => (
                            <Card key={store.id}>
                                <CardContent className="p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1" onClick={() => handleEdit(store)} style={{ cursor: 'pointer' }}>
                                            <div className="font-medium text-foreground text-sm">
                                                {store.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {store.area}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {store.is_spc && (
                                                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                    SPC
                                                </Badge>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleEdit(store)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(store.id)}
                                                disabled={actionLoading === store.id}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                {actionLoading === store.id ? '...' : 'Hapus'}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
