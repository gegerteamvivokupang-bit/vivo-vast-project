'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Helper: Get auth session from custom cookie
async function getAuthFromCookies() {
    const cookieStore = await cookies()
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]
    const cookieName = `sb-${projectRef}-auth-token`
    const authCookie = cookieStore.get(cookieName)

    if (!authCookie?.value) {
        return null
    }

    try {
        const session = JSON.parse(authCookie.value)

        // Check expired
        if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000)) {
            return null
        }

        if (!session.user?.id) {
            return null
        }

        return {
            userId: session.user.id,
            email: session.user.email,
            accessToken: session.access_token
        }
    } catch {
        return null
    }
}

// Helper: Get authenticated admin user
export async function getAdminUser() {
    const auth = await getAuthFromCookies()

    if (!auth) {
        console.error('[getAdminUser] No auth session in cookie')
        return { error: 'Unauthorized: Please login', adminDb: null }
    }

    console.log('[getAdminUser] Auth from cookie:', auth.userId, auth.email)

    // Create admin client (service role to bypass RLS)
    const adminDb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check role from users table by email
    const { data: userData, error: userError } = await adminDb
        .from('users')
        .select('id, role, email')
        .eq('email', auth.email)
        .single()

    if (userError) {
        console.error('[getAdminUser] User lookup error:', userError)
        return { error: 'User not found: ' + userError.message, adminDb: null }
    }

    console.log('[getAdminUser] User data:', userData)

    if (userData?.role !== 'admin') {
        console.error('[getAdminUser] Not admin. Role:', userData?.role)
        return { error: 'Forbidden: Admin only. Your role: ' + userData?.role, adminDb: null }
    }

    return { error: null, adminDb, userId: userData.id, email: auth.email }
}

// ============================================
// USER MANAGEMENT
// ============================================

export interface UserFilter {
    search?: string
    role?: string
    status?: string
}

export async function getUsers(filter: UserFilter = {}) {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error, data: [] }

    let query = auth.adminDb!
        .from('users')
        .select('id, email, employee_id, name, role, status, created_at')
        .order('name', { ascending: true })

    if (filter.search) {
        query = query.or(`name.ilike.%${filter.search}%,email.ilike.%${filter.search}%,employee_id.ilike.%${filter.search}%`)
    }

    if (filter.role && filter.role !== 'all') {
        query = query.eq('role', filter.role)
    }

    if (filter.status && filter.status !== 'all') {
        query = query.eq('status', filter.status)
    }

    const { data, error } = await query

    if (error) {
        console.error('[getUsers] Error:', error)
        return { success: false, message: error.message, data: [] }
    }

    return { success: true, data: data || [] }
}

export async function toggleUserStatus(userId: string) {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error }

    // Get current status
    const { data: user } = await auth.adminDb!
        .from('users')
        .select('status')
        .eq('id', userId)
        .single()

    if (!user) return { success: false, message: 'User not found' }

    const newStatus = user.status === 'active' ? 'inactive' : 'active'

    const { error } = await auth.adminDb!
        .from('users')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', userId)

    if (error) return { success: false, message: error.message }

    return { success: true, newStatus }
}

export interface CreateUserData {
    email: string
    name: string
    employee_id: string
    role: 'promotor' | 'sator' | 'spv' | 'manager' | 'admin'
    pin: string
    atasan_id?: string      // ID atasan langsung
    store_id?: string       // ID toko (untuk promotor)
    area?: string           // Area
}

// Get potential supervisors based on role
export async function getAtasanList(role: string) {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error, data: [] }

    // Determine which role(s) should be the supervisor
    let atasanRoles: string[]
    switch (role) {
        case 'promotor':
            // Promotor bisa di bawah Sator ATAU SPV (Anfal/Wilibrodus case)
            atasanRoles = ['sator', 'spv']
            break
        case 'sator':
            atasanRoles = ['spv']
            break
        case 'spv':
            atasanRoles = ['manager']
            break
        default:
            return { success: true, data: [] } // manager/admin don't need atasan
    }

    // Get users first
    const { data: users, error: usersError } = await auth.adminDb!
        .from('users')
        .select('id, name, role')
        .in('role', atasanRoles)
        .eq('status', 'active')
        .order('name')

    if (usersError) {
        console.error('[getAtasanList] Users error:', usersError)
        return { success: false, message: usersError.message, data: [] }
    }

    if (!users || users.length === 0) {
        return { success: true, data: [] }
    }

    // Get hierarchy data for these users
    const userIds = users.map(u => u.id)
    const { data: hierarchies } = await auth.adminDb!
        .from('hierarchy')
        .select('user_id, area')
        .in('user_id', userIds)

    // Create a map of user_id -> area
    const areaMap = new Map<string, string>()
    if (hierarchies) {
        hierarchies.forEach(h => {
            if (h.area) {
                areaMap.set(h.user_id, h.area)
            }
        })
    }

    // Combine the data
    const formattedData = users.map(user => ({
        id: user.id,
        name: user.name,
        role: user.role,
        area: areaMap.get(user.id) || null
    }))

    return { success: true, data: formattedData }
}

export async function createUser(data: CreateUserData) {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error }

    // Check if email already exists
    const { data: existingEmails } = await auth.adminDb!
        .from('users')
        .select('id')
        .eq('email', data.email)

    if (existingEmails && existingEmails.length > 0) {
        return { success: false, message: 'Email sudah terdaftar' }
    }

    // Check if employee_id already exists
    const { data: existingIds } = await auth.adminDb!
        .from('users')
        .select('id, employee_id')
        .eq('employee_id', data.employee_id)

    if (existingIds && existingIds.length > 0) {
        // Generate suggestion: add number suffix
        const baseId = data.employee_id.replace(/\d+$/, '') // Remove trailing numbers
        const { data: similarIds } = await auth.adminDb!
            .from('users')
            .select('employee_id')
            .ilike('employee_id', `${baseId}%`)

        // Find the highest number suffix
        let maxNum = 0
        if (similarIds) {
            similarIds.forEach(u => {
                const match = u.employee_id.match(/(\d+)$/)
                if (match) {
                    const num = parseInt(match[1])
                    if (num > maxNum) maxNum = num
                }
            })
        }

        const suggestedId = `${baseId}${String(maxNum + 1).padStart(3, '0')}`

        return {
            success: false,
            message: `Employee ID "${data.employee_id}" sudah terpakai`,
            suggestion: suggestedId
        }
    }

    // AREA VALIDATION - Get area from atasan's hierarchy
    let validatedArea = data.area
    if (data.atasan_id && ['promotor', 'sator', 'spv'].includes(data.role)) {
        const { data: atasanHierarchy, error: atasanError } = await auth.adminDb!
            .from('hierarchy')
            .select('area')
            .eq('user_id', data.atasan_id)
            .single()

        if (atasanError) {
            console.error('[createUser] Error fetching atasan area:', atasanError)
            return { success: false, message: 'Gagal mendapatkan data atasan' }
        }

        const atasanArea = atasanHierarchy?.area
        if (!atasanArea) {
            return { success: false, message: 'Atasan yang dipilih belum memiliki area yang valid' }
        }

        // For Promotor: validate store area matches sator area
        if (data.role === 'promotor' && data.store_id) {
            const { data: storeData, error: storeError } = await auth.adminDb!
                .from('stores')
                .select('area, name')
                .eq('id', data.store_id)
                .single()

            if (storeError) {
                console.error('[createUser] Error fetching store:', storeError)
                return { success: false, message: 'Gagal mendapatkan data toko' }
            }

            if (storeData.area !== atasanArea) {
                return {
                    success: false,
                    message: `Toko "${storeData.name}" (${storeData.area}) tidak se-area dengan Sator yang dipilih (${atasanArea}). Pilih toko di area ${atasanArea}.`
                }
            }
        }

        // Auto-set area from atasan for all roles
        validatedArea = atasanArea
    }


    // Create user in auth.users first
    const { data: authUser, error: authError } = await auth.adminDb!.auth.admin.createUser({
        email: data.email,
        password: data.email, // Password = email (sesuai sistem login)
        email_confirm: true
    })

    if (authError) {
        console.error('[createUser] Auth error:', authError)
        return { success: false, message: 'Gagal membuat auth user: ' + authError.message }
    }

    // Create user in public.users
    const { error: userError } = await auth.adminDb!
        .from('users')
        .insert({
            id: authUser.user.id,
            email: data.email,
            name: data.name,
            employee_id: data.employee_id,
            role: data.role,
            status: 'active',
            pin_hash: data.pin,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })

    if (userError) {
        console.error('[createUser] User insert error:', userError)
        // Rollback: delete auth user
        await auth.adminDb!.auth.admin.deleteUser(authUser.user.id)
        return { success: false, message: 'Gagal membuat user: ' + userError.message }
    }

    // Create hierarchy record if atasan_id is provided (for promotor, sator, spv)
    if (data.atasan_id && ['promotor', 'sator', 'spv'].includes(data.role)) {
        const hierarchyData: any = {
            user_id: authUser.user.id,
            atasan_id: data.atasan_id,
            area: validatedArea || null
        }

        // Add store_id for promotor
        if (data.role === 'promotor' && data.store_id) {
            hierarchyData.store_id = data.store_id
        }

        const { error: hierarchyError } = await auth.adminDb!
            .from('hierarchy')
            .insert(hierarchyData)

        if (hierarchyError) {
            console.error('[createUser] Hierarchy insert error:', hierarchyError)
            // Don't rollback user, just log warning - hierarchy can be fixed later
            console.warn('[createUser] User created but hierarchy failed. Manual fix needed.')
        }
    }

    return { success: true, userId: authUser.user.id }
}

export interface UpdateUserData {
    name?: string
    employee_id?: string
    role?: 'promotor' | 'sator' | 'spv' | 'manager' | 'admin'
    pin?: string
}

export async function updateUser(userId: string, data: UpdateUserData) {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error }

    const updateData: any = {
        updated_at: new Date().toISOString()
    }

    if (data.name) updateData.name = data.name
    if (data.employee_id) updateData.employee_id = data.employee_id
    if (data.role) updateData.role = data.role
    if (data.pin) updateData.pin_hash = data.pin

    const { error } = await auth.adminDb!
        .from('users')
        .update(updateData)
        .eq('id', userId)

    if (error) {
        console.error('[updateUser] Error:', error)
        return { success: false, message: error.message }
    }

    return { success: true }
}

export interface UpdateHierarchyData {
    atasan_id?: string
    store_id?: string
    area?: string
}

export async function updateUserHierarchy(userId: string, data: UpdateHierarchyData) {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error }

    // Get user info to determine role
    const { data: userData, error: userError } = await auth.adminDb!
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

    if (userError || !userData) {
        return { success: false, message: 'User tidak ditemukan' }
    }

    // If atasan is being changed, validate area consistency
    if (data.atasan_id) {
        // Get new atasan's area
        const { data: atasanHierarchy, error: atasanError } = await auth.adminDb!
            .from('hierarchy')
            .select('area')
            .eq('user_id', data.atasan_id)
            .single()

        if (atasanError) {
            return { success: false, message: 'Gagal mendapatkan data atasan baru' }
        }

        const newArea = atasanHierarchy?.area
        if (!newArea) {
            return { success: false, message: 'Atasan yang dipilih belum memiliki area yang valid' }
        }

        // For promotor, validate store area matches new sator area
        if (userData.role === 'promotor' && data.store_id) {
            const { data: storeData, error: storeError } = await auth.adminDb!
                .from('stores')
                .select('area, name')
                .eq('id', data.store_id)
                .single()

            if (storeError) {
                return { success: false, message: 'Gagal mendapatkan data toko' }
            }

            if (storeData.area !== newArea) {
                return {
                    success: false,
                    message: `Toko "${storeData.name}" (${storeData.area}) tidak se-area dengan Sator baru (${newArea}). Pilih toko di area ${newArea}.`
                }
            }
        }

        // Auto-set area from new atasan
        data.area = newArea
    }

    // Update hierarchy table
    const updateData: any = {}
    if (data.atasan_id) updateData.atasan_id = data.atasan_id
    if (data.store_id !== undefined) updateData.store_id = data.store_id
    if (data.area) updateData.area = data.area

    const { error } = await auth.adminDb!
        .from('hierarchy')
        .update(updateData)
        .eq('user_id', userId)

    if (error) {
        console.error('[updateUserHierarchy] Error:', error)
        return { success: false, message: error.message }
    }

    return { success: true }
}


export async function deleteUser(userId: string) {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error }

    // Get user info first
    const { data: userData, error: userError } = await auth.adminDb!
        .from('users')
        .select('name, role')
        .eq('id', userId)
        .single()

    if (userError || !userData) {
        return { success: false, message: 'User tidak ditemukan' }
    }

    // Check if user has subordinates (bawahan)
    const { data: subordinates, error: subError } = await auth.adminDb!
        .from('hierarchy')
        .select('user_id')
        .eq('atasan_id', userId)

    if (subError) {
        console.error('[deleteUser] Error checking subordinates:', subError)
    }

    if (subordinates && subordinates.length > 0) {
        return {
            success: false,
            message: `${userData.name} tidak dapat dihapus karena masih memiliki ${subordinates.length} bawahan. Hapus atau pindahkan bawahan terlebih dahulu.`
        }
    }

    // Check if user has transactions (for promotor)
    if (userData.role === 'promotor') {
        const { data: transactions, count } = await auth.adminDb!
            .from('vast_finance_data_new')
            .select('id', { count: 'exact', head: true })
            .eq('created_by_user_id', userId)
            .limit(1)

        if (count && count > 0) {
            return {
                success: false,
                message: `${userData.name} tidak dapat dihapus karena memiliki ${count} transaksi. Data transaksi harus dipertahankan untuk audit.`
            }
        }
    }

    // Safe to delete - set status to inactive (soft delete)
    const { error } = await auth.adminDb!
        .from('users')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', userId)

    if (error) return { success: false, message: error.message }

    return { success: true, message: `${userData.name} berhasil dinonaktifkan` }
}

// ============================================
// STORE MANAGEMENT
// ============================================

export async function getStores(filter: { search?: string; area?: string } = {}) {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error, data: [] }

    let query = auth.adminDb!
        .from('stores')
        .select('*')
        .order('name', { ascending: true })

    if (filter.search) {
        query = query.ilike('name', `%${filter.search}%`)
    }

    if (filter.area && filter.area !== 'all') {
        query = query.eq('area', filter.area)
    }

    const { data, error } = await query

    if (error) {
        console.error('[getStores] Error:', error)
        return { success: false, message: error.message, data: [] }
    }

    return { success: true, data: data || [] }
}

export async function getAreaList() {
    const auth = await getAdminUser()
    if (auth.error) return []

    const { data } = await auth.adminDb!
        .from('stores')
        .select('area')
        .order('area')

    if (!data) return []

    // Get unique areas
    const areas = [...new Set(data.map(d => d.area).filter(Boolean))]
    return areas
}

export interface CreateStoreData {
    name: string
    area: string
    is_spc?: boolean
}

export async function createStore(data: CreateStoreData) {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error }

    const { error } = await auth.adminDb!
        .from('stores')
        .insert({
            name: data.name,
            area: data.area,
            is_spc: data.is_spc || false,
            created_at: new Date().toISOString()
        })

    if (error) {
        console.error('[createStore] Error:', error)
        return { success: false, message: error.message }
    }

    return { success: true }
}

export async function updateStore(storeId: string, data: Partial<CreateStoreData>) {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error }

    const { error } = await auth.adminDb!
        .from('stores')
        .update(data)
        .eq('id', storeId)

    if (error) {
        console.error('[updateStore] Error:', error)
        return { success: false, message: error.message }
    }

    return { success: true }
}

export async function deleteStore(storeId: string) {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error }

    // Get store info first
    const { data: storeData, error: storeError } = await auth.adminDb!
        .from('stores')
        .select('name')
        .eq('id', storeId)
        .single()

    if (storeError || !storeData) {
        return { success: false, message: 'Toko tidak ditemukan' }
    }

    // Check if store has assigned promotors
    const { data: promotors, error: promotorError } = await auth.adminDb!
        .from('hierarchy')
        .select('user_id')
        .eq('store_id', storeId)

    if (promotorError) {
        console.error('[deleteStore] Error checking promotors:', promotorError)
    }

    if (promotors && promotors.length > 0) {
        return {
            success: false,
            message: `Toko "${storeData.name}" tidak dapat dihapus karena masih ada ${promotors.length} promotor yang ditugaskan. Pindahkan promotor terlebih dahulu.`
        }
    }

    // Check if store has transactions
    const { count } = await auth.adminDb!
        .from('vast_finance_data_new')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .limit(1)

    if (count && count > 0) {
        return {
            success: false,
            message: `Toko "${storeData.name}" tidak dapat dihapus karena memiliki ${count} transaksi. Data transaksi harus dipertahankan untuk audit.`
        }
    }

    // Safe to delete
    const { error } = await auth.adminDb!
        .from('stores')
        .delete()
        .eq('id', storeId)

    if (error) {
        console.error('[deleteStore] Error:', error)
        return { success: false, message: error.message }
    }

    return { success: true, message: `Toko "${storeData.name}" berhasil dihapus` }
}

// ============================================
// DATA EXPORT
// ============================================

export interface ExportFilter {
    startDate: string
    endDate: string
    area?: string
}

export async function getExportData(filter: ExportFilter) {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error, data: [] }

    console.log('[getExportData] Filter:', filter)

    // Get transaction data from vast_finance_data_new
    let query = auth.adminDb!
        .from('vast_finance_data_new')
        .select('*')
        .gte('sale_date', filter.startDate)
        .lte('sale_date', filter.endDate)
        .order('sale_date', { ascending: false })

    const { data, error } = await query

    console.log('[getExportData] Raw data count:', data?.length || 0)
    console.log('[getExportData] Error:', error)

    if (error) {
        console.error('[getExportData] Error:', error)
        return { success: false, message: error.message, data: [] }
    }

    if (!data || data.length === 0) {
        console.log('[getExportData] No data found for period:', filter.startDate, 'to', filter.endDate)
        return { success: true, data: [] }
    }

    // Get related data for enrichment
    const [usersRes, storesRes] = await Promise.all([
        auth.adminDb!.from('users').select('id, name, role'),
        auth.adminDb!.from('stores').select('id, name, area')
    ])

    const usersMap = new Map((usersRes.data || []).map(u => [u.id, u]))
    const storesMap = new Map((storesRes.data || []).map(s => [s.id, s]))

    // Get hierarchy to find sator for each promoter
    const { data: hierarchies } = await auth.adminDb!
        .from('hierarchy')
        .select('user_id, atasan_id')

    const hierarchyMap = new Map((hierarchies || []).map(h => [h.user_id, h.atasan_id]))

    // Enrich data
    const enrichedData = (data || []).map(row => {
        const promoter = usersMap.get(row.created_by_user_id)
        const satorId = hierarchyMap.get(row.created_by_user_id)
        const sator = satorId ? usersMap.get(satorId) : null
        const store = storesMap.get(row.store_id)

        return {
            ...row,
            promoter_name: promoter?.name || '-',
            sator_name: sator?.name || '-',
            store_name: store?.name || '-',
            area: store?.area || '-'
        }
    }).filter(row => {
        // Filter by area if specified
        if (filter.area && filter.area !== 'ALL') {
            return row.area === filter.area
        }
        return true
    })

    return { success: true, data: enrichedData }
}

// ============================================
// DASHBOARD STATS
// ============================================

export async function getAdminStats() {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error, data: null }

    const [usersRes, storesRes, transRes] = await Promise.all([
        auth.adminDb!.from('users').select('id, role, status'),
        auth.adminDb!.from('stores').select('id'),
        auth.adminDb!.from('vast_finance_data_new').select('id, status')
    ])

    const users = usersRes.data || []
    const stores = storesRes.data || []
    const transactions = transRes.data || []

    return {
        success: true,
        data: {
            totalUsers: users.length,
            activeUsers: users.filter(u => u.status === 'active').length,
            totalPromotor: users.filter(u => u.role === 'promotor').length,
            totalSator: users.filter(u => u.role === 'sator').length,
            totalSpv: users.filter(u => u.role === 'spv').length,
            totalStores: stores.length,
            totalTransactions: transactions.length,
            totalAcc: transactions.filter(t => t.status === 'acc').length,
            totalPending: transactions.filter(t => t.status === 'pending').length,
        }
    }
}
