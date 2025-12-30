// Script untuk cek data dari 26 Desember 2025
const XLSX = require('xlsx');

const excelPath = 'F:\\gpt_crazy_vast\\Data Sheet Vast data desmber.xlsx';

console.log('='.repeat(80));
console.log('CEK DATA DARI 26 DESEMBER 2025');
console.log('='.repeat(80));

const workbook = XLSX.readFile(excelPath);
const masterSheet = workbook.Sheets['Master Data All'];
const masterData = XLSX.utils.sheet_to_json(masterSheet);

// Convert Excel timestamp to Date
function excelDateToJSDate(excelDate) {
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

// Filter data dari 26 Desember 2025
const targetDate = new Date('2025-12-26');
console.log(`\nTarget: Data >= ${formatDate(targetDate)}\n`);

let filtered = [];
let dateStats = {};

masterData.forEach((row, index) => {
    const timestamp = row['Timestamp'];
    if (!timestamp) return;

    const date = excelDateToJSDate(timestamp);
    const dateStr = formatDate(date);

    // Filter >= 26 Desember 2025
    if (date >= targetDate) {
        filtered.push({
            ...row,
            sale_date: dateStr
        });

        // Stats per tanggal
        dateStats[dateStr] = (dateStats[dateStr] || 0) + 1;
    }
});

console.log('📊 HASIL FILTER:');
console.log('='.repeat(80));
console.log(`Total records >= 26 Desember: ${filtered.length}`);

console.log('\n📅 DISTRIBUSI PER TANGGAL:');
console.log('='.repeat(80));
const sortedDates = Object.keys(dateStats).sort();
sortedDates.forEach(date => {
    console.log(`  ${date}: ${dateStats[date].toString().padStart(3)} records`);
});

console.log('\n📋 SAMPLE DATA (5 records pertama):');
console.log('='.repeat(80));
filtered.slice(0, 5).forEach((record, idx) => {
    console.log(`\n[${idx + 1}] ${record.sale_date}`);
    console.log(`  Promotor: ${record['Nama Promotor'] || record['Nama Promotor 2'] || 'N/A'}`);
    console.log(`  Customer: ${record['Nama Pemohon Kredit']}`);
    console.log(`  Status: ${record['Status pengajuan']}`);
});

console.log('\n\n✅ DATA SIAP UNTUK MIGRASI!');
console.log(`Total records yang akan di-migrate: ${filtered.length}`);
console.log(`Periode: ${sortedDates[0]} s/d ${sortedDates[sortedDates.length - 1]}`);
