// ============================================================================
// BACA SHEET "Data Penjualan Bersih" - 965 baris data Desember
// ============================================================================

const XLSX = require('xlsx');
const fs = require('fs');

const excelPath = 'F:\\gpt_crazy_vast\\Data Sheet Vast (3).xlsx';

console.log('='.repeat(80));
console.log('ANALISIS SHEET: Data Penjualan Bersih');
console.log('='.repeat(80));

const workbook = XLSX.readFile(excelPath);

// Baca sheet "Data Penjualan Bersih"
const sheetName = 'Data Penjualan Bersih';
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log(`\n📊 Total baris di sheet "${sheetName}": ${data.length}`);

// Cek struktur kolom
if (data.length > 0) {
    console.log('\n📋 KOLOM YANG ADA:');
    const columns = Object.keys(data[0]);
    columns.forEach((col, idx) => {
        console.log(`  ${idx + 1}. "${col}"`);
    });

    console.log('\n\n📊 SAMPLE DATA (10 baris pertama):');
    console.log(JSON.stringify(data.slice(0, 10), null, 2));

    // Analisis isi kolom
    console.log('\n\n📊 ANALISIS KOLOM:');
    columns.forEach(col => {
        const sampleValues = data.slice(0, 5).map(row => row[col]);
        const uniqueValues = [...new Set(data.map(row => row[col]))];

        console.log(`\n"${col}":`);
        console.log(`  Sample: ${JSON.stringify(sampleValues.slice(0, 3))}`);
        console.log(`  Unique values count: ${uniqueValues.length}`);

        // Jika unique values sedikit (< 20), tampilkan semua
        if (uniqueValues.length < 20) {
            console.log(`  All values: ${JSON.stringify(uniqueValues)}`);
        }
    });
}

// Baca juga sheet "Master Data All" untuk cross-reference
console.log('\n\n' + '='.repeat(80));
console.log('CROSS-CHECK: Master Data All vs Data Penjualan Bersih');
console.log('='.repeat(80));

const masterSheet = workbook.Sheets['Master Data All'];
const masterData = XLSX.utils.sheet_to_json(masterSheet);

console.log(`\nMaster Data All: ${masterData.length} baris`);
console.log(`Data Penjualan Bersih: ${data.length} baris`);
console.log(`\nSelisih: ${Math.abs(masterData.length - data.length)} baris`);

// Cek apakah ada kolom yang berbeda
const masterColumns = masterData.length > 0 ? Object.keys(masterData[0]) : [];
const bersihColumns = data.length > 0 ? Object.keys(data[0]) : [];

console.log('\n📋 PERBEDAAN KOLOM:');
console.log(`Master Data All: ${masterColumns.length} kolom`);
console.log(`Data Penjualan Bersih: ${bersihColumns.length} kolom`);

const onlyInMaster = masterColumns.filter(c => !bersihColumns.includes(c));
const onlyInBersih = bersihColumns.filter(c => !masterColumns.includes(c));

if (onlyInMaster.length > 0) {
    console.log('\n✅ Kolom hanya di Master Data All:');
    onlyInMaster.forEach(c => console.log(`  - ${c}`));
}

if (onlyInBersih.length > 0) {
    console.log('\n✅ Kolom hanya di Data Penjualan Bersih:');
    onlyInBersih.forEach(c => console.log(`  - ${c}`));
}

// Export untuk analisis
const outputPath = 'F:\\gpt_crazy_vast\\data\\penjualan_bersih_analysis.json';
fs.writeFileSync(outputPath, JSON.stringify({
    totalRows: data.length,
    columns: bersihColumns,
    sampleData: data.slice(0, 20),
    columnAnalysis: bersihColumns.map(col => ({
        name: col,
        uniqueCount: [...new Set(data.map(row => row[col]))].length,
        sampleValues: data.slice(0, 3).map(row => row[col])
    }))
}, null, 2));

console.log(`\n\n✅ Analysis exported to: ${outputPath}`);
