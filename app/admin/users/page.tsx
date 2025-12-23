'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Toaster } from 'sonner'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    getUsers,
    toggleUserStatus,
    createUser,
    updateUser,
    updateUserHierarchy,
    getAtasanList,
    getStores,
    type UserFilter,
    type CreateUserData,
    type UpdateUserData,
    type UpdateHierarchyData
} from '@/app/actions/admin'

interface User {
    id: string
    email: string
    employee_id: string
    name: string
    role: string
    status: string
    created_at: string
}

type FormMode = 'list' | 'add' | 'edit'

export default function UserManagementPage() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [formMode, setFormMode] = useState<FormMode>('list')
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [formLoading, setFormLoading] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [idSuggestion, setIdSuggestion] = useState<string | null>(null)

    // Filters
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')

    // Form fields
    const [formData, setFormData] = useState({
        email: '',
        name: '',
        employee_id: '',
        role: 'promotor' as 'promotor' | 'sator' | 'spv' | 'manager' | 'admin',
        pin: '',
        atasan_id: '',
        store_id: '',
        area: ''
    })

    // Atasan & Store lists
    const [atasanList, setAtasanList] = useState<{ id: string, name: string, role: string, area: string | null }[]>([])
    const [storeList, setStoreList] = useState<{ id: string, name: string, area: string }[]>([])
    const [selectedAtasanArea, setSelectedAtasanArea] = useState<string | null>(null)

    // Hierarchy editing
    const [hierarchyFormData, setHierarchyFormData] = useState<UpdateHierarchyData>({})
    const [editingHierarchyUser, setEditingHierarchyUser] = useState<User | null>(null)
    const [hierarchyFormMode, setHierarchyFormMode] = useState<'list' | 'edit-hierarchy'>('list')

    // Load atasan list when role changes
    const loadAtasanList = async (role: string) => {
        const res = await getAtasanList(role)
        if (res.success) {
            setAtasanList(res.data as any[])
        }
    }

    // Load store list
    const loadStoreList = async () => {
        const res = await getStores({})
        if (res.success) {
            setStoreList(res.data as any[])
        }
    }

    const fetchUsers = useCallback(async () => {
        setLoading(true)
        setError(null)

        const filter: UserFilter = {}
        if (search) filter.search = search
        if (roleFilter !== 'all') filter.role = roleFilter
        if (statusFilter !== 'all') filter.status = statusFilter

        const res = await getUsers(filter)

        if (res.success) {
            setUsers(res.data as User[])
        } else {
            setError(res.message || 'Gagal memuat data')
        }
        setLoading(false)
    }, [search, roleFilter, statusFilter])

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers()
        }, 300)
        return () => clearTimeout(timer)
    }, [fetchUsers])

    const handleToggleStatus = async (userId: string) => {
        if (!confirm('Yakin ingin mengubah status user ini?')) return

        setActionLoading(userId)
        const res = await toggleUserStatus(userId)

        if (res.success) {
            const user = users.find(u => u.id === userId)
            const newStatusText = res.newStatus === 'active' ? 'aktif' : 'nonaktif'
            toast.success(`User "${user?.name}" berhasil di${newStatusText}kan`)

            setUsers(prev => prev.map(u =>
                u.id === userId ? { ...u, status: res.newStatus! } : u
            ))
        } else {
            toast.error(res.message || 'Gagal mengubah status')
        }
        setActionLoading(null)
    }

    const handleAddNew = async () => {
        setFormData({ email: '', name: '', employee_id: '', role: 'promotor', pin: '', atasan_id: '', store_id: '', area: '' })
        setEditingUser(null)
        setFormError(null)
        setIdSuggestion(null)
        setSelectedAtasanArea(null)
        await loadAtasanList('promotor')
        await loadStoreList()
        setFormMode('add')
    }

    const handleRoleChange = async (newRole: string) => {
        setFormData(prev => ({ ...prev, role: newRole as any, atasan_id: '', store_id: '' }))
        setSelectedAtasanArea(null)
        await loadAtasanList(newRole)
    }

    const handleEdit = (user: User) => {
        setFormData({
            email: user.email,
            name: user.name,
            employee_id: user.employee_id,
            role: user.role as any,
            pin: '',
            atasan_id: '',
            store_id: '',
            area: ''
        })
        setEditingUser(user)
        setFormError(null)
        setIdSuggestion(null)
        setFormMode('edit')
    }

    const handleCancel = () => {
        setFormMode('list')
        setEditingUser(null)
        setFormError(null)
        setHierarchyFormMode('list')
        setEditingHierarchyUser(null)
        setHierarchyFormData({})
        setSelectedAtasanArea(null)
    }

    const handleEditHierarchy = async (user: User) => {
        setEditingHierarchyUser(user)
        setHierarchyFormData({})
        setSelectedAtasanArea(null)

        // Load current hierarchy data
        // This will be populated when user selects new values

        // Load appropriate atasan list based on role
        await loadAtasanList(user.role)
        await loadStoreList()

        setHierarchyFormMode('edit-hierarchy')
    }

    const handleUseSuggestion = () => {
        if (idSuggestion) {
            setFormData(prev => ({ ...prev, employee_id: idSuggestion }))
            setIdSuggestion(null)
            setFormError(null)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setFormLoading(true)
        setFormError(null)
        setIdSuggestion(null)

        if (formMode === 'add') {
            if (!formData.email || !formData.name || !formData.employee_id || !formData.pin) {
                setFormError('Semua field wajib diisi')
                toast.error('Semua field wajib diisi')
                setFormLoading(false)
                return
            }

            // Validate atasan for promotor, sator, spv
            if (['promotor', 'sator', 'spv'].includes(formData.role) && !formData.atasan_id) {
                setFormError('Pilih atasan terlebih dahulu')
                toast.error('Pilih atasan terlebih dahulu')
                setFormLoading(false)
                return
            }

            // Validate store for promotor
            if (formData.role === 'promotor' && !formData.store_id) {
                setFormError('Pilih toko terlebih dahulu')
                toast.error('Pilih toko terlebih dahulu')
                setFormLoading(false)
                return
            }

            const res = await createUser({
                email: formData.email,
                name: formData.name,
                employee_id: formData.employee_id,
                role: formData.role,
                pin: formData.pin,
                atasan_id: formData.atasan_id || undefined,
                store_id: formData.store_id || undefined,
                area: formData.area || undefined
            }) as { success: boolean; message?: string; suggestion?: string; userId?: string }

            if (res.success) {
                toast.success(`User "${formData.name}" berhasil dibuat!`, {
                    description: `Role: ${formData.role.toUpperCase()} | Email: ${formData.email}`
                })
                setFormMode('list')
                await fetchUsers()

                // Scroll to new user after a brief delay
                setTimeout(() => {
                    const newUserElement = document.querySelector(`[data-user-id="${res.userId}"]`)
                    if (newUserElement) {
                        newUserElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                }, 300)
            } else {
                toast.error(res.message || 'Gagal menambah user')
                setFormError(res.message || 'Gagal menambah user')
                if (res.suggestion) {
                    setIdSuggestion(res.suggestion)
                }
            }
        } else if (formMode === 'edit' && editingUser) {
            const updateData: UpdateUserData = {}
            if (formData.name !== editingUser.name) updateData.name = formData.name
            if (formData.employee_id !== editingUser.employee_id) updateData.employee_id = formData.employee_id
            if (formData.role !== editingUser.role) updateData.role = formData.role
            if (formData.pin) updateData.pin = formData.pin

            const res = await updateUser(editingUser.id, updateData)

            if (res.success) {
                toast.success(`User "${formData.name}" berhasil diupdate!`)
                setFormMode('list')
                await fetchUsers()
            } else {
                toast.error(res.message || 'Gagal mengupdate user')
                setFormError(res.message || 'Gagal mengupdate user')
            }
        }

        setFormLoading(false)
    }

    const handleSubmitHierarchy = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingHierarchyUser) return

        setFormLoading(true)
        setFormError(null)

        const res = await updateUserHierarchy(editingHierarchyUser.id, hierarchyFormData)

        if (res.success) {
            toast.success(`Hierarchy ${editingHierarchyUser.name} berhasil diupdate!`)
            setHierarchyFormMode('list')
            setEditingHierarchyUser(null)
            await fetchUsers()
        } else {
            toast.error(res.message || 'Gagal mengupdate hierarchy')
            setFormError(res.message || 'Gagal mengupdate hierarchy')
        }

        setFormLoading(false)
    }

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            case 'manager': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
            case 'spv': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
            case 'sator': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
        }
    }

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
                            {formMode === 'add' ? 'Tambah User Baru' : 'Edit User'}
                        </h1>
                    </div>

                    <Card>
                        <CardContent className="p-4">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                        disabled={formMode === 'edit'}
                                        placeholder="user@example.com"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Nama Lengkap</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                                        placeholder="NAMA LENGKAP"
                                        className="uppercase"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Employee ID</Label>
                                    <Input
                                        value={formData.employee_id}
                                        onChange={e => setFormData(prev => ({ ...prev, employee_id: e.target.value.toUpperCase() }))}
                                        placeholder="EMP001"
                                        className="uppercase"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Role</Label>
                                    <Select
                                        value={formData.role}
                                        onValueChange={handleRoleChange}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="promotor">Promotor</SelectItem>
                                            <SelectItem value="sator">Sator</SelectItem>
                                            <SelectItem value="spv">SPV</SelectItem>
                                            <SelectItem value="manager">Manager</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Atasan Selection - for promotor, sator, spv */}
                                {['promotor', 'sator', 'spv'].includes(formData.role) && formMode === 'add' && (
                                    <div className="space-y-2">
                                        <Label>
                                            Atasan ({formData.role === 'promotor' ? 'Sator' : formData.role === 'sator' ? 'SPV' : 'Manager'})
                                        </Label>
                                        <Select
                                            value={formData.atasan_id}
                                            onValueChange={(v) => {
                                                const selectedAtasan = atasanList.find(a => a.id === v)
                                                setSelectedAtasanArea(selectedAtasan?.area || null)
                                                setFormData(prev => ({
                                                    ...prev,
                                                    atasan_id: v,
                                                    store_id: '', // Reset store when atasan changes
                                                    area: selectedAtasan?.area || ''
                                                }))
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih atasan..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {atasanList.length === 0 ? (
                                                    <SelectItem value="__disabled__" disabled>Tidak ada atasan tersedia</SelectItem>
                                                ) : (
                                                    atasanList.map(a => (
                                                        <SelectItem key={a.id} value={a.id}>
                                                            {a.name} {a.area ? `(${a.area})` : ''}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {atasanList.length === 0 && (
                                            <p className="text-xs text-destructive">
                                                Tambahkan {formData.role === 'promotor' ? 'Sator' : formData.role === 'sator' ? 'SPV' : 'Manager'} terlebih dahulu
                                            </p>
                                        )}
                                        {selectedAtasanArea && (
                                            <p className="text-xs text-muted-foreground">
                                                Area: <strong>{selectedAtasanArea}</strong>
                                            </p>
                                        )}
                                        {formData.atasan_id && !selectedAtasanArea && (
                                            <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                                ⚠️ Atasan yang dipilih belum memiliki area. Silakan pilih atasan yang sudah memiliki area.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Store Selection - for promotor only */}
                                {formData.role === 'promotor' && formMode === 'add' && (
                                    <div className="space-y-2">
                                        <Label>Toko</Label>
                                        <Select
                                            value={formData.store_id}
                                            onValueChange={(v) => {
                                                const store = storeList.find(s => s.id === v)
                                                setFormData(prev => ({
                                                    ...prev,
                                                    store_id: v,
                                                    area: store?.area || ''
                                                }))
                                            }}
                                            disabled={!selectedAtasanArea}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={selectedAtasanArea ? "Pilih toko..." : "Pilih Sator terlebih dahulu"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {!selectedAtasanArea ? (
                                                    <SelectItem value="__disabled__" disabled>Pilih Sator terlebih dahulu</SelectItem>
                                                ) : storeList.filter(s => s.area === selectedAtasanArea).length === 0 ? (
                                                    <SelectItem value="__disabled__" disabled>Tidak ada toko di area {selectedAtasanArea}</SelectItem>
                                                ) : (
                                                    storeList
                                                        .filter(s => s.area === selectedAtasanArea)
                                                        .map(s => (
                                                            <SelectItem key={s.id} value={s.id}>{s.name} ({s.area})</SelectItem>
                                                        ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {selectedAtasanArea && (
                                            <p className="text-xs text-muted-foreground">
                                                Menampilkan toko di area <strong>{selectedAtasanArea}</strong>
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>{formMode === 'edit' ? 'PIN Baru (kosongkan jika tidak diubah)' : 'PIN'}</Label>
                                    <Input
                                        type="text"
                                        value={formData.pin}
                                        onChange={e => setFormData(prev => ({ ...prev, pin: e.target.value }))}
                                        placeholder="123456"
                                        maxLength={6}
                                    />
                                </div>

                                {formError && (
                                    <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                                        {formError}
                                    </div>
                                )}

                                {idSuggestion && (
                                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-sm">
                                        <p className="text-blue-800 dark:text-blue-300 mb-2">
                                            Saran ID tersedia: <strong>{idSuggestion}</strong>
                                        </p>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={handleUseSuggestion}
                                            className="text-blue-800 dark:text-blue-300 border-blue-300"
                                        >
                                            Gunakan ID Ini
                                        </Button>
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
            </DashboardLayout >
        )
    }

    // Hierarchy Edit Form View
    if (hierarchyFormMode === 'edit-hierarchy' && editingHierarchyUser) {
        return (
            <DashboardLayout requiredRole="admin">
                <Toaster position="top-center" richColors />
                <div className="min-h-screen bg-background p-4 pb-24">
                    <div className="mb-4">
                        <button onClick={handleCancel} className="text-sm text-primary hover:underline">
                            {'<'} Kembali
                        </button>
                        <h1 className="text-xl font-bold text-foreground mt-2">
                            Edit Hierarchy - {editingHierarchyUser.name}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Role: {editingHierarchyUser.role.toUpperCase()}
                        </p>
                    </div>

                    <Card>
                        <CardContent className="p-4">
                            <form onSubmit={handleSubmitHierarchy} className="space-y-4">
                                {/* Atasan Selection */}
                                <div className="space-y-2">
                                    <Label>
                                        {editingHierarchyUser.role === 'promotor' ? 'Sator Baru' :
                                            editingHierarchyUser.role === 'sator' ? 'SPV Baru' : 'Manager Baru'}
                                    </Label>
                                    <Select
                                        value={hierarchyFormData.atasan_id || ''}
                                        onValueChange={(v) => {
                                            const selectedAtasan = atasanList.find(a => a.id === v)
                                            setSelectedAtasanArea(selectedAtasan?.area || null)
                                            setHierarchyFormData(prev => ({
                                                ...prev,
                                                atasan_id: v,
                                                store_id: undefined, // Reset store when atasan changes
                                                area: selectedAtasan?.area || undefined
                                            }))
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih atasan baru..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {atasanList.length === 0 ? (
                                                <SelectItem value="__disabled__" disabled>Tidak ada atasan tersedia</SelectItem>
                                            ) : (
                                                atasanList.map(a => (
                                                    <SelectItem key={a.id} value={a.id}>
                                                        {a.name} {a.area ? `(${a.area})` : ''}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {selectedAtasanArea && (
                                        <p className="text-xs text-muted-foreground">
                                            Area baru: <strong>{selectedAtasanArea}</strong>
                                        </p>
                                    )}
                                </div>

                                {/* Store Selection - for promotor only */}
                                {editingHierarchyUser.role === 'promotor' && (
                                    <div className="space-y-2">
                                        <Label>Toko Baru</Label>
                                        <Select
                                            value={hierarchyFormData.store_id || ''}
                                            onValueChange={(v) => {
                                                setHierarchyFormData(prev => ({
                                                    ...prev,
                                                    store_id: v
                                                }))
                                            }}
                                            disabled={!selectedAtasanArea}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={selectedAtasanArea ? "Pilih toko..." : "Pilih Sator terlebih dahulu"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {!selectedAtasanArea ? (
                                                    <SelectItem value="__disabled__" disabled>Pilih Sator terlebih dahulu</SelectItem>
                                                ) : storeList.filter(s => s.area === selectedAtasanArea).length === 0 ? (
                                                    <SelectItem value="__disabled__" disabled>Tidak ada toko di area {selectedAtasanArea}</SelectItem>
                                                ) : (
                                                    storeList
                                                        .filter(s => s.area === selectedAtasanArea)
                                                        .map(s => (
                                                            <SelectItem key={s.id} value={s.id}>{s.name} ({s.area})</SelectItem>
                                                        ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {selectedAtasanArea && (
                                            <p className="text-xs text-muted-foreground">
                                                Menampilkan toko di area <strong>{selectedAtasanArea}</strong>
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Error Display */}
                                {formError && (
                                    <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                                        {formError}
                                    </div>
                                )}

                                {/* Buttons */}
                                <div className="flex gap-2 pt-2">
                                    <Button type="submit" disabled={formLoading || !hierarchyFormData.atasan_id}>
                                        {formLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                                    </Button>
                                    <Button type="button" variant="outline" onClick={handleCancel}>
                                        Batal
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
                        <h1 className="text-xl font-bold text-foreground mt-2">User Management</h1>
                        <p className="text-sm text-muted-foreground">
                            Kelola Promotor, Sator, SPV, dan Manager
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
                            placeholder="Cari nama, email, atau ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Role</SelectItem>
                                    <SelectItem value="promotor">Promotor</SelectItem>
                                    <SelectItem value="sator">Sator</SelectItem>
                                    <SelectItem value="spv">SPV</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
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

                {/* User Count */}
                <div className="text-sm text-muted-foreground mb-3">
                    {loading ? 'Memuat...' : `${users.length} user ditemukan`}
                </div>

                {/* User List */}
                <div className="space-y-2">
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <Card key={i} className="animate-pulse">
                                <CardContent className="p-4 h-20 bg-muted/30" />
                            </Card>
                        ))
                    ) : users.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center text-muted-foreground">
                                Tidak ada user ditemukan
                            </CardContent>
                        </Card>
                    ) : (
                        users.map(user => (
                            <Card key={user.id} data-user-id={user.id}>
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0" onClick={() => handleEdit(user)} style={{ cursor: 'pointer' }}>
                                            <div className="font-medium text-foreground truncate">
                                                {user.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {user.email}
                                            </div>
                                            <div className="text-xs text-muted-foreground font-mono">
                                                {user.employee_id}
                                            </div>
                                            <div className="flex gap-2 mt-2 flex-wrap">
                                                <Badge className={getRoleBadgeColor(user.role)}>
                                                    {user.role.toUpperCase()}
                                                </Badge>
                                                {/* Dual Role Badge for SPV who also act as Sator */}
                                                {user.role === 'spv' && (
                                                    <Badge variant="outline" className="text-xs border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400">
                                                        + Sator
                                                    </Badge>
                                                )}
                                                <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                                                    {user.status}
                                                </Badge>
                                            </div>
                                            {user.role === 'spv' && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    💡 SPV ini juga bisa supervisi Promotor langsung
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleEdit(user)}
                                            >
                                                Edit
                                            </Button>
                                            {['promotor', 'sator', 'spv'].includes(user.role) && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEditHierarchy(user)}
                                                    className="text-xs"
                                                >
                                                    Edit Hierarchy
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleToggleStatus(user.id)}
                                                disabled={actionLoading === user.id || user.role === 'admin'}
                                            >
                                                {actionLoading === user.id
                                                    ? '...'
                                                    : user.status === 'active'
                                                        ? 'Nonaktifkan'
                                                        : 'Aktifkan'
                                                }
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}
