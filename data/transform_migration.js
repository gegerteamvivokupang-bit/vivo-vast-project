// ============================================================================
// SCRIPT TRANSFORMASI DATA EXCEL → SQL MIGRATION
// Tujuan: Migrasi data Desember 2025 ke database baru
// ============================================================================

const XLSX = require('xlsx');
const fs = require('fs');

const excelPath = 'F:\\gpt_crazy_vast\\Data Sheet Vast (3).xlsx';

console.log('='.repeat(80));
console.log('TRANSFORMASI DATA EXCEL UNTUK MIGRASI');
console.log('='.repeat(80));

// ============================================================================
// STEP 1: BACA SEMUA SHEET
// ============================================================================

const workbook = XLSX.readFile(excelPath);

// Baca Master Data All
const masterSheet = workbook.Sheets['Master Data All'];
const masterData = XLSX.utils.sheet_to_json(masterSheet);

// Baca Database Promotor (untuk mapping)
const promotorSheet = workbook.Sheets['Database Promotor'];
const promotorData = XLSX.utils.sheet_to_json(promotorSheet);

// Baca Database Toko (untuk mapping)
const tokoSheet = workbook.Sheets['Database Toko'];
const tokoData = XLSX.utils.sheet_to_json(tokoSheet);

console.log('\n📊 DATA TERBACA:');
console.log(`- Master Data All: ${masterData.length} records`);
console.log(`- Database Promotor: ${promotorData.length} records`);
console.log(`- Database Toko: ${tokoData.length} records`);

// ============================================================================
// STEP 2: BUAT MAPPING PROMOTOR → TOKO
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('STEP 2: MAPPING PROMOTOR → TOKO');
console.log('='.repeat(80));

const promotorTokoMap = {};
promotorData.forEach(row => {
    const promotor = row['Promotor'];
    const idToko = row['ID Toko Penempatan'];

    if (promotor && idToko) {
        promotorTokoMap[promotor.toUpperCase().trim()] = idToko;
    }
});

console.log(`\n✅ Berhasil mapping ${Object.keys(promotorTokoMap).length} promotor → toko`);
console.log('\nSample mapping:');
Object.keys(promotorTokoMap).slice(0, 5).forEach(key => {
    console.log(`  ${key} → ${promotorTokoMap[key]}`);
});

// ============================================================================
// STEP 3: BUAT MAPPING ID TOKO → NAMA TOKO
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('STEP 3: MAPPING ID TOKO → NAMA TOKO');
console.log('='.repeat(80));

const idTokoToNamaMap = {};
tokoData.forEach(row => {
    const idToko = row['ID Toko'];
    const namaToko = row['Nama Toko'];

    if (idToko && namaToko) {
        idTokoToNamaMap[idToko] = namaToko.toUpperCase().trim();
    }
});

console.log(`\n✅ Berhasil mapping ${Object.keys(idTokoToNamaMap).length} ID toko → nama toko`);
console.log('\nSample mapping:');
Object.keys(idTokoToNamaMap).slice(0, 5).forEach(key => {
    console.log(`  ${key} → ${idTokoToNamaMap[key]}`);
});

// ============================================================================
// STEP 4: NORMALISASI PEKERJAAN
// ============================================================================

function normalizePekerjaan(pekerjaan) {
    if (!pekerjaan) return 'Lainnya';

    const p = pekerjaan.toUpperCase().trim();

    // Mapping ke nilai valid
    if (p.includes('SWASTA') || p.includes('KARYAWAN') || p.includes('PEGAWAI') ||
        p === 'SELES' || p.includes('SALES')) {
        return 'Karyawan Swasta';
    }
    if (p.includes('PNS') || p.includes('ASN') || p.includes('GURU') || p.includes('DOSEN')) {
        return 'PNS/ASN';
    }
    if (p.includes('WIRASWASTA') || p.includes('WIRAUSAHA') || p.includes('SHOP') ||
        p.includes('PANGKAS') || p.includes('PEMILIK') || p.includes('DAGANG')) {
        return 'Wiraswasta';
    }
    if (p.includes('TNI') || p.includes('POLRI') || p.includes('TENTARA') || p.includes('POLISI')) {
        return 'TNI/Polri';
    }
    if (p.includes('PENSIUN')) {
        return 'Pensiunan';
    }
    if (p.includes('TIDAK BEKERJA') || p.includes('UNEMPLOYED') || p === 'IRT') {
        return 'Tidak Bekerja';
    }

    // Default
    return 'Lainnya';
}

// ============================================================================
// STEP 5: NORMALISASI STATUS
// ============================================================================

function normalizeStatus(status) {
    if (!status) return { status: 'reject', approval: 'rejected', transaction: 'not_closed' };

    const s = status.toLowerCase().trim();

    if (s === 'acc' || s.includes('approved')) {
        return { status: 'acc', approval: 'approved', transaction: 'closed' };
    }
    if (s === 'reject' || s.includes('reject')) {
        return { status: 'reject', approval: 'rejected', transaction: 'not_closed' };
    }
    if (s.includes('pending') || s.includes('limit') || s.includes('dp kurang')) {
        return { status: 'pending', approval: 'approved', transaction: 'not_closed' };
    }

    // Default: reject
    return { status: 'reject', approval: 'rejected', transaction: 'not_closed' };
}

// ============================================================================
// STEP 6: CONVERT EXCEL TIMESTAMP → DATE
// ============================================================================

function excelDateToJSDate(excelDate) {
    // Excel epoch: 1 Januari 1900
    const epoch = new Date(1899, 11, 30);
    const jsDate = new Date(epoch.getTime() + excelDate * 86400000);
    return jsDate;
}

function formatDate(jsDate) {
    const year = jsDate.getFullYear();
    const month = String(jsDate.getMonth() + 1).padStart(2, '0');
    const day = String(jsDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================================================
// STEP 7: FILTER DATA DESEMBER 2025
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('STEP 7: FILTER DATA DESEMBER 2025');
console.log('='.repeat(80));

const desemberData = masterData.filter(row => {
    const timestamp = row['Timestamp'];
    if (!timestamp) return false;

    const date = excelDateToJSDate(timestamp);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 0-indexed

    return year === 2025 && month === 12;
});

console.log(`\n✅ Ditemukan ${desemberData.length} records untuk Desember 2025`);

if (desemberData.length === 0) {
    console.log('\n⚠️ WARNING: Tidak ada data Desember 2025!');
    console.log('Cek sample tanggal di data:');
    masterData.slice(0, 10).forEach(row => {
        const date = excelDateToJSDate(row['Timestamp']);
        console.log(`  ${formatDate(date)}`);
    });

    console.log('\n💡 Apakah maksudnya Oktober 2025?');
    const oktoberData = masterData.filter(row => {
        const date = excelDateToJSDate(row['Timestamp']);
        return date.getFullYear() === 2025 && date.getMonth() + 1 === 10;
    });
    console.log(`   Ditemukan ${oktoberData.length} records untuk Oktober 2025`);
}

// ============================================================================
// STEP 8: TRANSFORMASI DATA
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('STEP 8: TRANSFORMASI DATA');
console.log('='.repeat(80));

const transformed = [];
const errors = [];
const warnings = [];

desemberData.forEach((row, index) => {
    try {
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
        const promotorRaw = row['Nama Promotor 2'];

        // Convert tanggal
        const saleDate = formatDate(excelDateToJSDate(timestamp));

        // Normalisasi promotor
        const promotor = promotorRaw ? promotorRaw.toUpperCase().trim() : null;

        // Cari ID Toko dari promotor
        const idToko = promotorTokoMap[promotor];
        const namaToko = idToko ? idTokoToNamaMap[idToko] : null;

        if (!promotor) {
            errors.push({
                row: index + 1,
                error: 'Promotor tidak ada',
                data: row
            });
            return;
        }

        if (!idToko) {
            warnings.push({
                row: index + 1,
                warning: `Promotor "${promotor}" tidak ditemukan di mapping`,
                data: row
            });
        }

        // Normalisasi status
        const statusData = normalizeStatus(statusRaw);

        // Normalisasi pekerjaan
        const pekerjaanNormalized = normalizePekerjaan(pekerjaan);

        // Normalisasi NPWP
        const hasNpwp = npwp && (npwp.toLowerCase().includes('ada') || npwp.toLowerCase() === 'ya');

        // Normalisasi penghasilan
        let penghasilanNum = null;
        if (typeof penghasilan === 'number') {
            penghasilanNum = penghasilan;
        } else if (typeof penghasilan === 'string') {
            const clean = penghasilan.replace(/[^0-9]/g, '');
            if (clean) penghasilanNum = parseInt(clean);
        }

        // Normalisasi limit
        let limitNum = null;
        if (typeof limitAmount === 'number') {
            limitNum = limitAmount;
        } else if (typeof limitAmount === 'string' && limitAmount !== '-' && limitAmount.toLowerCase() !== 'tidak ada') {
            const clean = limitAmount.replace(/[^0-9]/g, '');
            if (clean) limitNum = parseInt(clean);
        }

        // Simpan hasil transformasi
        transformed.push({
            saleDate,
            customerName: customerName || 'UNKNOWN',
            customerPhone: customerPhone || '',
            pekerjaan: pekerjaanNormalized,
            penghasilan: penghasilanNum,
            hasNpwp,
            status: statusData.status,
            approvalStatus: statusData.approval,
            transactionStatus: statusData.transaction,
            limitAmount: limitNum,
            tipeHP: tipeHP || null,
            promotor,
            idToko,
            namaToko,
            // Untuk tracking
            _row: index + 1,
            _statusRaw: statusRaw,
            _pekerjaanRaw: pekerjaan
        });

    } catch (err) {
        errors.push({
            row: index + 1,
            error: err.message,
            data: row
        });
    }
});

console.log(`\n✅ Berhasil transform ${transformed.length} records`);
console.log(`⚠️ Warnings: ${warnings.length}`);
console.log(`❌ Errors: ${errors.length}`);

// ============================================================================
// STEP 9: ANALISIS HASIL TRANSFORMASI
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('STEP 9: ANALISIS HASIL');
console.log('='.repeat(80));

// Hitung distribusi status
const statusCount = {};
transformed.forEach(row => {
    statusCount[row.status] = (statusCount[row.status] || 0) + 1;
});

console.log('\n📊 Distribusi Status:');
Object.keys(statusCount).forEach(status => {
    console.log(`  ${status}: ${statusCount[status]} (${(statusCount[status] / transformed.length * 100).toFixed(1)}%)`);
});

// Hitung distribusi pekerjaan
const pekerjaanCount = {};
transformed.forEach(row => {
    pekerjaanCount[row.pekerjaan] = (pekerjaanCount[row.pekerjaan] || 0) + 1;
});

console.log('\n📊 Distribusi Pekerjaan:');
Object.keys(pekerjaanCount).forEach(pekerjaan => {
    console.log(`  ${pekerjaan}: ${pekerjaanCount[pekerjaan]}`);
});

// Cek promotor tanpa toko
const noTokoCount = transformed.filter(row => !row.idToko).length;
console.log(`\n⚠️ Records tanpa mapping toko: ${noTokoCount}`);

if (warnings.length > 0) {
    console.log('\n⚠️ WARNINGS (10 pertama):');
    warnings.slice(0, 10).forEach(w => {
        console.log(`  Row ${w.row}: ${w.warning}`);
    });
}

if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(e => {
        console.log(`  Row ${e.row}: ${e.error}`);
    });
}

// ============================================================================
// STEP 10: EXPORT HASIL
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('STEP 10: EXPORT HASIL');
console.log('='.repeat(80));

// Export transformed data
const outputPath = 'F:\\gpt_crazy_vast\\data\\migration_transformed.json';
fs.writeFileSync(outputPath, JSON.stringify({
    summary: {
        totalRecords: transformed.length,
        statusDistribution: statusCount,
        pekerjaanDistribution: pekerjaanCount,
        recordsWithoutStore: noTokoCount,
        warnings: warnings.length,
        errors: errors.length
    },
    data: transformed,
    warnings,
    errors,
    mappings: {
        promotorToToko: promotorTokoMap,
        idTokoToNama: idTokoToNamaMap
    }
}, null, 2));

console.log(`\n✅ Data berhasil di-export ke: ${outputPath}`);
console.log('\n📋 Sample data (5 pertama):');
console.log(JSON.stringify(transformed.slice(0, 5), null, 2));

console.log('\n\n' + '='.repeat(80));
console.log('✅ TRANSFORMASI SELESAI!');
console.log('='.repeat(80));
console.log('\nNext steps:');
console.log('1. Review file: migration_transformed.json');
console.log('2. Fix warnings/errors jika ada');
console.log('3. Jalankan script generate SQL');
