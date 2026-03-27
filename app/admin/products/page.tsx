'use client'

import { useCallback, useEffect, useState } from 'react'
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
    createProduct,
    deleteProduct,
    getProducts,
    toggleProductStatus,
    updateProduct
} from '@/app/actions/admin'

interface Product {
    id: string
    name: string
    is_active: boolean
    created_at: string | null
}

type FormMode = 'list' | 'add' | 'edit'

export default function ProductManagementPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
    const [formMode, setFormMode] = useState<FormMode>('list')
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [formLoading, setFormLoading] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        is_active: true
    })

    const fetchProducts = useCallback(async () => {
        setLoading(true)
        setError(null)

        const res = await getProducts({
            search: search || undefined,
            status: statusFilter
        })

        if (res.success) {
            setProducts(res.data as Product[])
        } else {
            setError(res.message || 'Gagal memuat data produk')
        }

        setLoading(false)
    }, [search, statusFilter])

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts()
        }, 300)

        return () => clearTimeout(timer)
    }, [fetchProducts])

    const handleAddNew = () => {
        setEditingProduct(null)
        setFormError(null)
        setFormData({ name: '', is_active: true })
        setFormMode('add')
    }

    const handleEdit = (product: Product) => {
        setEditingProduct(product)
        setFormError(null)
        setFormData({
            name: product.name,
            is_active: product.is_active
        })
        setFormMode('edit')
    }

    const handleCancel = () => {
        setFormMode('list')
        setEditingProduct(null)
        setFormError(null)
        setFormData({ name: '', is_active: true })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setFormLoading(true)
        setFormError(null)

        if (!formData.name.trim()) {
            setFormError('Nama produk wajib diisi')
            setFormLoading(false)
            return
        }

        const payload = {
            name: formData.name,
            is_active: formData.is_active
        }

        const res = formMode === 'add'
            ? await createProduct(payload)
            : await updateProduct(editingProduct!.id, payload)

        if (res.success) {
            toast.success(res.message || 'Produk berhasil disimpan')
            setFormMode('list')
            setEditingProduct(null)
            fetchProducts()
        } else {
            setFormError(res.message || 'Gagal menyimpan produk')
        }

        setFormLoading(false)
    }

    const handleToggleStatus = async (product: Product) => {
        setActionLoading(product.id)
        const res = await toggleProductStatus(product.id)

        if (res.success) {
            toast.success(res.message || 'Status produk berhasil diubah')
            fetchProducts()
        } else {
            toast.error(res.message || 'Gagal mengubah status produk', { duration: 5000 })
        }

        setActionLoading(null)
    }

    const handleDelete = async (product: Product) => {
        if (!confirm(`Yakin ingin menghapus produk "${product.name}"?`)) return

        setActionLoading(product.id)
        const res = await deleteProduct(product.id)

        if (res.success) {
            toast.success(res.message || 'Produk berhasil dihapus')
            fetchProducts()
        } else {
            toast.error(res.message || 'Gagal menghapus produk', { duration: 5000 })
        }

        setActionLoading(null)
    }

    if (formMode !== 'list') {
        return (
            <DashboardLayout requiredRole="admin">
                <div className="min-h-screen bg-background p-4 pb-24">
                    <div className="mb-4">
                        <button onClick={handleCancel} className="text-sm text-primary hover:underline">
                            {'<'} Kembali
                        </button>
                        <h1 className="text-xl font-bold text-foreground mt-2">
                            {formMode === 'add' ? 'Tambah Tipe Produk Baru' : 'Edit Tipe Produk'}
                        </h1>
                    </div>

                    <Card>
                        <CardContent className="p-4">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nama Tipe Produk</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                                        placeholder="MISAL: V50 LITE"
                                        className="uppercase"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={formData.is_active}
                                        onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                                        className="w-4 h-4"
                                    />
                                    <Label htmlFor="is_active">Tipe produk aktif</Label>
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

    return (
        <DashboardLayout requiredRole="admin">
            <Toaster position="top-center" richColors />
            <div className="min-h-screen bg-background p-4 pb-24">
                <div className="mb-4 flex justify-between items-start">
                    <div>
                        <Link href="/admin" className="text-sm text-primary hover:underline">
                            {'<'} Kembali
                        </Link>
                        <h1 className="text-xl font-bold text-foreground mt-2">Tipe Produk</h1>
                        <p className="text-sm text-muted-foreground">
                            Kelola master tipe produk yang muncul di form input pengajuan
                        </p>
                    </div>
                    <Button onClick={handleAddNew} size="sm">
                        + Tambah
                    </Button>
                </div>

                <Card className="mb-4">
                    <CardContent className="p-4 space-y-3">
                        <Input
                            placeholder="Cari nama tipe produk..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                <SelectItem value="active">Aktif</SelectItem>
                                <SelectItem value="inactive">Nonaktif</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                {error && (
                    <Card className="mb-4 border-destructive">
                        <CardContent className="p-4 text-destructive text-sm">
                            {error}
                        </CardContent>
                    </Card>
                )}

                <div className="text-sm text-muted-foreground mb-3">
                    {loading ? 'Memuat...' : `${products.length} tipe produk ditemukan`}
                </div>

                {loading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Card key={i} className="animate-pulse">
                                <CardContent className="p-4 h-16 bg-muted/30" />
                            </Card>
                        ))}
                    </div>
                ) : products.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            Tidak ada tipe produk ditemukan
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {products.map(product => (
                            <Card key={product.id}>
                                <CardContent className="p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex-1 cursor-pointer" onClick={() => handleEdit(product)}>
                                            <div className="font-medium text-foreground text-sm">
                                                {product.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {product.created_at
                                                    ? new Date(product.created_at).toLocaleDateString('id-ID')
                                                    : 'Tanggal tidak tersedia'}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Badge variant={product.is_active ? 'default' : 'secondary'}>
                                                {product.is_active ? 'Aktif' : 'Nonaktif'}
                                            </Badge>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleEdit(product)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleToggleStatus(product)}
                                                disabled={actionLoading === product.id}
                                            >
                                                {actionLoading === product.id ? '...' : product.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(product)}
                                                disabled={actionLoading === product.id}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                Hapus
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
