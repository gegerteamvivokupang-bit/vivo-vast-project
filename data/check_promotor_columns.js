// ============================================================================
// CEK SEMUA KOLOM PROMOTOR DI MASTER DATA ALL
// ============================================================================

const XLSX = require('xlsx');
const fs = require('fs');

const excelPath = 'F:\\gpt_crazy_vast\\Data Sheet Vast (3).xlsx';
const workbook = XLSX.readFile(excelPath);
const masterSheet = workbook.Sheets['Master Data All'];
const masterData = XLSX.utils.sheet_to_json(masterSheet);

console.log('='.repeat(80));
console.log('CEK KOLOM PROMOTOR');
console.log('='.repeat(80));

// Cari semua kolom yang ada
const allColumns = masterData.length > 0 ? Object.keys(masterData[0]) : [];

console.log(`\nTotal kolom: ${allColumns.length}`);
console.log('\nSemua kolom:');
allColumns.forEach((col, idx) => {
    console.log(`  ${idx + 1}. "${col}"`);
});

// Cari kolom yang mengandung "Promotor"
const promotorColumns = allColumns.filter(col => col.toLowerCase().includes('promotor'));

console.log(`\n\n📋 KOLOM YANG MENGANDUNG "PROMOTOR": ${promotorColumns.length}`);
promotorColumns.forEach(col => {
    console.log(`  - "${col}"`);
});

// Hitung berapa record yang punya nilai di tiap kolom promotor
console.log('\n\n📊 ANALISIS ISI KOLOM PROMOTOR:');
promotorColumns.forEach(col => {
    const filled = masterData.filter(row => row[col] && row[col] !== '').length;
    const percentage = (filled / masterData.length * 100).toFixed(1);
    console.log(`\n"${col}": ${filled}/${masterData.length} (${percentage}%)`);

    // Sample values
    const samples = masterData.filter(row => row[col]).slice(0, 5).map(row => row[col]);
    console.log(`  Sample: ${JSON.stringify(samples.slice(0, 3))}`);
});

// Cek apakah ada record yang tidak punya promotor sama sekali
console.log('\n\n⚠️ CEK RECORD TANPA PROMOTOR:');
const noPromotor = masterData.filter(row => {
    return !promotorColumns.some(col => row[col] && row[col] !== '');
});

console.log(`Records tanpa promotor sama sekali: ${noPromotor.length}`);

if (noPromotor.length > 0) {
    console.log('\nSample record tanpa promotor:');
    console.log(JSON.stringify(noPromotor.slice(0, 2), null, 2));
}
