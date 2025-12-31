// ============================================================================
// TRANSFORMASI DATA 30 DESEMBER 2025
// Dari file: data migrasi.xlsx
// ============================================================================

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = path.join(__dirname, '..', 'data migrasi.xlsx');

console.log('='.repeat(80));
console.log('TRANSFORMASI DATA 30 DESEMBER 2025');
console.log('='.repeat(80));
console.log(`Source: ${excelPath}`);

// Baca semua sheet
const workbook = XLSX.readFile(excelPath);
const masterSheet = workbook.Sheets['Master Data All'];
const masterData = XLSX.utils.sheet_to_json(masterSheet);
const promotorSheet = workbook.Sheets['Database Promotor'];
const promotorData = XLSX.utils.sheet_to_json(promotorSheet);
const tokoSheet = workbook.Sheets['Database Toko'];
const tokoData = XLSX.utils.sheet_to_json(tokoSheet);

console.log(`\nTotal Master Data: ${masterData.length} records`);

// Helper: Convert Excel Date
function excelDateToJSDate(excelDate) {
    if (!excelDate) return null;
    if (excelDate instanceof Date) return excelDate;
    if (typeof excelDate === 'string') {
        const parsed = new Date(excelDate);
        if (!isNaN(parsed)) return parsed;
        return null;
    }
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + excelDate * 86400000);
}

function formatDate(jsDate) {
    if (!jsDate) return null;
    const year = jsDate.getFullYear();
    const month = String(jsDate.getMonth() + 1).padStart(2, '0');
    const day = String(jsDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper: Cari nama promotor di row (cek semua kolom yang ada "Promotor")
function findPromotor(row) {
    const keys = Object.keys(row);
    const promotorKeys = keys.filter(k => k.toLowerCase().includes('promotor'));

    // Cari kolom promotor yang ada nilainya
    for (const key of promotorKeys) {
        if (row[key] && row[key] !== '') {
            return {
                value: String(row[key]).toUpperCase().trim(),
                column: key
            };
        }
    }

    return null;
}

// Buat mapping Promotor → Toko
const promotorTokoMap = {};
promotorData.forEach(row => {
    const promotor = row['Promotor'];
    const idToko = row['ID Toko Penempatan'];
    if (promotor && idToko) {
        promotorTokoMap[promotor.toUpperCase().trim()] = idToko;
    }
});

// Buat mapping ID Toko → Nama Toko
const idTokoToNamaMap = {};
tokoData.forEach(row => {
    const idToko = row['ID Toko'];
    const namaToko = row['Nama Toko'];
    if (idToko && namaToko) {
        idTokoToNamaMap[idToko] = namaToko.toUpperCase().trim();
    }
});

console.log(`\n✅ Mapping promotor → toko: ${Object.keys(promotorTokoMap).length} entries`);
console.log(`✅ Mapping ID toko → nama: ${Object.keys(idTokoToNamaMap).length} entries`);

// Helper: Normalisasi Pekerjaan
function normalizePekerjaan(pekerjaan) {
    if (!pekerjaan) return 'IRT';
    const p = String(pekerjaan).toUpperCase().trim();

    // PNS
    if (p.includes('PNS') || p.includes('ASN') || p.includes('GURU') ||
        p.includes('DOSEN') || p.includes('NEGERI SIPIL')) {
        return 'PNS';
    }

    // Pegawai Swasta (PALING BANYAK)
    if (p.includes('SWASTA') || p.includes('KARYAWAN') || p.includes('PEGAWAI') ||
        p === 'SELES' || p.includes('SALES') || p.includes('ALFAMART') ||
        p.includes('INDOMARET') || p.includes('TOKO')) {
        return 'Pegawai Swasta';
    }

    // Wiraswasta
    if (p.includes('WIRASWASTA') || p.includes('WIRAUS') || p.includes('PENGUSAHA') ||
        p.includes('DAGANG') || p.includes('SHOP') || p.includes('USAHA') ||
        p.includes('PEMILIK') || p.includes('BISNIS') || p.includes('BENGKEL') ||
        p.includes('PANGKAS')) {
        return 'Wiraswasta';
    }

    // TNI/Polri
    if (p.includes('TNI') || p.includes('POLRI') || p.includes('TENTARA') ||
        p.includes('POLISI') || p.includes('MILITER')) {
        return 'TNI/Polri';
    }

    // IRT  / Tidak Bekerja / Pensiunan
    if (p.includes('IRT') || p.includes('RUMAH TANGGA') || p.includes('TIDAK BEKERJA') ||
        p.includes('BELUM') || p.includes('UNEMPLOYED') || p.includes('PENSIUN')) {
        return 'IRT';
    }

    // Pelajar/Mahasiswa
    if (p.includes('PELAJAR') || p.includes('MAHASISWA') || p.includes('SISWA') ||
        p.includes('STUDENT')) {
        return 'Pelajar';
    }

    // Buruh (DEFAULT - semua yang lain)
    return 'Buruh';
}

// Helper: Normalisasi Status
function normalizeStatus(status) {
    if (!status) return { status: 'reject', approval: 'rejected', transaction: 'not_closed' };
    const s = String(status).toLowerCase().trim();

    if (s === 'acc' || s.includes('approved')) {
        return { status: 'acc', approval: 'approved', transaction: 'closed' };
    }
    if (s.includes('pending') || s.includes('limit') || s.includes('dp') || s.includes('belum diproses')) {
        return { status: 'pending', approval: 'approved', transaction: 'not_closed' };
    }

    return { status: 'reject', approval: 'rejected', transaction: 'not_closed' };
}

// Filter HANYA tanggal 30 Desember 2025
console.log('\n' + '='.repeat(80));
console.log('FILTER DATA TANGGAL 30 DESEMBER 2025');
console.log('='.repeat(80));

const targetDate = new Date('2025-12-30');
const targetDateStr = '2025-12-30';

const desemberData = masterData.filter(row => {
    const timestamp = row['Timestamp'];
    if (!timestamp) return false;
    const date = excelDateToJSDate(timestamp);
    if (!date) return false;
    const dateStr = formatDate(date);
    return dateStr === targetDateStr;
});

console.log(`\n✅ Ditemukan ${desemberData.length} records untuk tanggal 30 Desember 2025`);

// Transform data
console.log('\n' + '='.repeat(80));
console.log('TRANSFORMASI DATA');
console.log('='.repeat(80));

const transformed = [];
const errors = [];
const warnings = [];
const promotorStats = {};

desemberData.forEach((row, index) => {
    try {
        // Cari promotor
        const promotorResult = findPromotor(row);

        if (!promotorResult) {
            errors.push({
                row: index + 1,
                error: 'Promotor tidak ditemukan di kolom manapun',
                data: row
            });
            return;
        }

        const promotor = promotorResult.value;
        const promotorColumn = promotorResult.column;

        // Track kolom promotor yang digunakan
        promotorStats[promotorColumn] = (promotorStats[promotorColumn] || 0) + 1;

        // Cari ID Toko & Nama Toko
        const idToko = promotorTokoMap[promotor];
        const namaToko = idToko ? idTokoToNamaMap[idToko] : null;

        if (!idToko || !namaToko) {
            warnings.push({
                row: index + 1,
                warning: `Promotor "${promotor}" tidak ditemukan di mapping (kolom: ${promotorColumn})`,
                promotor,
                promotorColumn
            });
        }

        // Ambil data dari Excel
        const timestamp = row['Timestamp'];
        const customerName = row['Nama Pemohon Kredit'];
        const customerPhone = row['Nomor Telepon Pemohon Kredit'];
        const pekerjaan = row['Pekerjaan Pemohon Kredit'];
        const penghasilan = row['Penghasilan Bulanan Pemohon Kredit'];
        const npwp = row['Apakah ada NPWP'];
        const limitAmount = row['Total limit yang didapatkan'];
        const statusRaw = row['Status pengajuan'];
        const tipeHP = row['Tipe HP VIVO yang diambil konsumen'];

        // Convert & normalize
        const saleDate = formatDate(excelDateToJSDate(timestamp));
        const statusData = normalizeStatus(statusRaw);
        const pekerjaanNormalized = normalizePekerjaan(pekerjaan);
        const hasNpwp = npwp && (npwp.toLowerCase().includes('ada') || npwp.toLowerCase() === 'ya');

        // Normalize penghasilan & limit
        let penghasilanNum = null;
        if (typeof penghasilan === 'number') {
            penghasilanNum = penghasilan;
        } else if (typeof penghasilan === 'string') {
            const clean = penghasilan.replace(/[^0-9]/g, '');
            if (clean) penghasilanNum = parseInt(clean);
        }

        let limitNum = null;
        if (typeof limitAmount === 'number') {
            limitNum = limitAmount;
        } else if (typeof limitAmount === 'string' && limitAmount !== '-' && !limitAmount.toLowerCase().includes('tidak')) {
            const clean = limitAmount.replace(/[^0-9]/g, '');
            if (clean) limitNum = parseInt(clean);
        }

        // Normalize phone
        let phone = String(customerPhone || '').replace(/\s/g, '').replace(/-/g, '');
        if (phone && !phone.startsWith('+')) {
            if (phone.startsWith('0')) {
                phone = '+62' + phone.substring(1);
            } else if (!phone.startsWith('62')) {
                phone = '+62' + phone;
            } else {
                phone = '+' + phone;
            }
        }

        transformed.push({
            saleDate,
            customerName: customerName || 'UNKNOWN',
            customerPhone: phone,
            pekerjaan: pekerjaanNormalized,
            penghasilan: penghasilanNum,
            hasNpwp,
            status: statusData.status,
            approvalStatus: statusData.approval,
            transactionStatus: statusData.transaction,
            limitAmount: limitNum,
            tipeHP: tipeHP || null,
            promotor,
            promotorColumn,
            idToko,
            namaToko,
            _row: index + 1,
            _statusRaw: statusRaw,
            _pekerjaanRaw: pekerjaan
        });

    } catch (err) {
        errors.push({
            row: index + 1,
            error: err.message,
            stack: err.stack,
            data: row
        });
    }
});

console.log(`\n✅ Berhasil transform: ${transformed.length} records`);
console.log(`⚠️ Warnings: ${warnings.length}`);
console.log(`❌ Errors: ${errors.length}`);

// Statistik kolom promotor yang digunakan
console.log('\n📊 KOLOM PROMOTOR YANG DIGUNAKAN:');
Object.keys(promotorStats).sort().forEach(col => {
    console.log(`  ${col}: ${promotorStats[col]} records`);
});

// Distribusi status
const statusCount = {};
transformed.forEach(row => {
    statusCount[row.status] = (statusCount[row.status] || 0) + 1;
});

console.log('\n📊 DISTRIBUSI STATUS:');
Object.keys(statusCount).forEach(status => {
    const percentage = (statusCount[status] / transformed.length * 100).toFixed(1);
    console.log(`  ${status}: ${statusCount[status]} (${percentage}%)`);
});

// Cek promotor tanpa toko
const noTokoCount = transformed.filter(row => !row.idToko).length;
console.log(`\n⚠️ Records tanpa mapping toko: ${noTokoCount}`);

// Unique promotors
const uniquePromotors = [...new Set(transformed.map(r => r.promotor))];
console.log(`\n📊 UNIQUE PROMOTORS (${uniquePromotors.length}):`)
uniquePromotors.sort().forEach(p => {
    const count = transformed.filter(r => r.promotor === p).length;
    console.log(`  ${p}: ${count} records`);
});

if (warnings.length > 0) {
    console.log('\n⚠️ WARNINGS (10 pertama):');
    warnings.slice(0, 10).forEach(w => {
        console.log(`  Row ${w.row}: ${w.warning}`);
    });
}

if (errors.length > 0) {
    console.log('\n❌ ERRORS (5 pertama):');
    errors.slice(0, 5).forEach(e => {
        console.log(`  Row ${e.row}: ${e.error}`);
    });
}

// Export
const outputPath = path.join(__dirname, 'migration_30_desember_transformed.json');
fs.writeFileSync(outputPath, JSON.stringify({
    summary: {
        totalRecords: transformed.length,
        targetDate: targetDateStr,
        statusDistribution: statusCount,
        recordsWithoutStore: noTokoCount,
        warnings: warnings.length,
        errors: errors.length,
        promotorColumnStats: promotorStats,
        uniquePromotors: uniquePromotors
    },
    data: transformed,
    warnings,
    errors
}, null, 2));

console.log(`\n\n✅ Data exported to: ${outputPath}`);
console.log('\n📋 Sample (3 pertama):');
console.log(JSON.stringify(transformed.slice(0, 3), null, 2));

console.log('\n' + '='.repeat(80));
console.log('✅ TRANSFORMASI SELESAI!');
console.log('='.repeat(80));
console.log('\nNext: Run generate_sql_30_desember.js untuk generate SQL');
