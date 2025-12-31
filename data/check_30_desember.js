// ============================================================================
// CHECK DATA 30 DESEMBER 2025 dari data migrasi.xlsx
// ============================================================================
const XLSX = require('xlsx');
const path = require('path');

// Baca Excel
const excelPath = path.join(__dirname, '..', 'data migrasi.xlsx');
console.log('Reading:', excelPath);

const workbook = XLSX.readFile(excelPath);

// List semua sheets
console.log('\n📋 SHEET NAMES:');
console.log(workbook.SheetNames);

// Akses sheet pertama (atau "Master Data All" jika ada)
const sheetName = workbook.SheetNames.includes('Master Data All')
    ? 'Master Data All'
    : workbook.SheetNames[0];

console.log(`\n📄 Using sheet: "${sheetName}"`);

const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

console.log(`\n📊 Total records in sheet: ${data.length}`);

// Helper: Convert Excel Date  
function excelDateToJSDate(excelDate) {
    if (!excelDate) return null;
    if (excelDate instanceof Date) return excelDate;
    if (typeof excelDate === 'string') {
        // Try parsing as date string
        const parsed = new Date(excelDate);
        if (!isNaN(parsed)) return parsed;
        return null;
    }
    // Excel date number
    return new Date((excelDate - 25569) * 86400 * 1000);
}

// Show kolom yang ada
if (data.length > 0) {
    console.log('\n📋 COLUMNS:');
    Object.keys(data[0]).forEach((col, i) => {
        console.log(`  ${i + 1}. ${col}`);
    });
}

// Filter data tanggal 30 Desember 2025
const targetDate = new Date('2025-12-30');
const targetDateStr = '2025-12-30';

console.log('\n' + '='.repeat(80));
console.log('FILTER DATA TANGGAL 30 DESEMBER 2025');
console.log('='.repeat(80));

// Cari kolom timestamp (bisa berbeda nama)
const timestampColumn = Object.keys(data[0] || {}).find(col =>
    col.toLowerCase().includes('timestamp') ||
    col.toLowerCase().includes('tanggal')
);

console.log(`\n🔍 Timestamp column found: "${timestampColumn}"`);

// Filter dan group berdasarkan tanggal
const dateDistribution = {};
const data30Dec = [];

data.forEach((row, index) => {
    const timestamp = row[timestampColumn];
    if (!timestamp) return;

    const date = excelDateToJSDate(timestamp);
    if (!date || isNaN(date)) return;

    const dateStr = date.toISOString().split('T')[0];

    // Count distribution
    dateDistribution[dateStr] = (dateDistribution[dateStr] || 0) + 1;

    // Filter for 30 Dec
    if (dateStr === targetDateStr) {
        data30Dec.push({
            ...row,
            _parsedDate: dateStr,
            _rowIndex: index + 1
        });
    }
});

// Sort dan tampilkan distribusi tanggal
console.log('\n📅 DATE DISTRIBUTION (Desember 2025):');
const sortedDates = Object.entries(dateDistribution)
    .filter(([date]) => date.startsWith('2025-12'))
    .sort((a, b) => a[0].localeCompare(b[0]));

sortedDates.forEach(([date, count]) => {
    const marker = date === targetDateStr ? ' ⬅️ TARGET' : '';
    console.log(`  ${date}: ${count} records${marker}`);
});

console.log('\n' + '='.repeat(80));
console.log(`DATA 30 DESEMBER 2025: ${data30Dec.length} records`);
console.log('='.repeat(80));

if (data30Dec.length > 0) {
    // Preview beberapa data
    console.log('\n📝 SAMPLE DATA (5 pertama):');
    data30Dec.slice(0, 5).forEach((row, i) => {
        console.log(`\n--- Record ${i + 1} (Row ${row._rowIndex}) ---`);
        Object.entries(row).forEach(([key, value]) => {
            if (!key.startsWith('_') && value) {
                console.log(`  ${key}: ${value}`);
            }
        });
    });

    // Statistik promotor
    const promotorColumn = Object.keys(data30Dec[0]).find(col =>
        col.toLowerCase().includes('promotor') ||
        col.toLowerCase().includes('promoter')
    );

    if (promotorColumn) {
        console.log('\n📊 PROMOTOR DISTRIBUTION:');
        const promotorStats = {};
        data30Dec.forEach(row => {
            const promotor = row[promotorColumn] || 'UNKNOWN';
            promotorStats[promotor] = (promotorStats[promotor] || 0) + 1;
        });

        Object.entries(promotorStats)
            .sort((a, b) => b[1] - a[1])
            .forEach(([promotor, count]) => {
                console.log(`  ${promotor}: ${count}`);
            });
    }

    // Statistik status
    const statusColumn = Object.keys(data30Dec[0]).find(col =>
        col.toLowerCase().includes('status')
    );

    if (statusColumn) {
        console.log('\n📊 STATUS DISTRIBUTION:');
        const statusStats = {};
        data30Dec.forEach(row => {
            const status = row[statusColumn] || 'UNKNOWN';
            statusStats[status] = (statusStats[status] || 0) + 1;
        });

        Object.entries(statusStats).forEach(([status, count]) => {
            console.log(`  ${status}: ${count}`);
        });
    }
} else {
    console.log('\n⚠️ Tidak ada data untuk tanggal 30 Desember 2025');
}

// Export data 30 Dec ke JSON
const outputPath = path.join(__dirname, 'data_30_desember.json');
const fs = require('fs');
fs.writeFileSync(outputPath, JSON.stringify({
    summary: {
        totalRecords: data30Dec.length,
        targetDate: targetDateStr,
        extractedAt: new Date().toISOString()
    },
    dateDistribution: dateDistribution,
    data: data30Dec
}, null, 2));

console.log(`\n✅ Data exported to: ${outputPath}`);
