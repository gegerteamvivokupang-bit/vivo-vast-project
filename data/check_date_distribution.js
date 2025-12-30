// ============================================================================
// CEK DISTRIBUSI TANGGAL DI MASTER DATA ALL
// Tujuan: Cari tau bulan mana yang punya 965 records
// ============================================================================

const XLSX = require('xlsx');
const fs = require('fs');

const excelPath = 'F:\\gpt_crazy_vast\\Data Sheet Vast data desmber.xlsx';

console.log('='.repeat(80));
console.log('CEK DISTRIBUSI TANGGAL - MASTER DATA ALL');
console.log('='.repeat(80));

const workbook = XLSX.readFile(excelPath);
const masterSheet = workbook.Sheets['Master Data All'];
const masterData = XLSX.utils.sheet_to_json(masterSheet);

console.log(`\nTotal records: ${masterData.length}`);

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

// Analisis distribusi per TAHUN-BULAN
const dateDistribution = {};
const sampleDates = [];

masterData.forEach((row, index) => {
    const timestamp = row['Timestamp'];
    if (timestamp) {
        const date = excelDateToJSDate(timestamp);
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        dateDistribution[yearMonth] = (dateDistribution[yearMonth] || 0) + 1;

        // Sample 10 tanggal pertama untuk ditampilkan
        if (index < 10) {
            sampleDates.push({
                row: index + 1,
                timestamp,
                date: formatDate(date),
                yearMonth
            });
        }
    }
});

console.log('\n📅 SAMPLE TANGGAL (10 pertama):');
sampleDates.forEach(s => {
    console.log(`  Row ${s.row}: ${s.date} (Excel: ${s.timestamp.toFixed(2)})`);
});

console.log('\n\n📊 DISTRIBUSI PER BULAN:');
console.log('='.repeat(80));

// Sort by year-month
const sorted = Object.keys(dateDistribution).sort();
sorted.forEach(yearMonth => {
    const count = dateDistribution[yearMonth];
    const bar = '█'.repeat(Math.min(50, Math.floor(count / 20)));
    console.log(`${yearMonth}: ${count.toString().padStart(4)} records ${bar}`);
});

console.log('\n\n🎯 MENCARI BULAN DESEMBER:');
console.log('='.repeat(80));

const desemberMonths = sorted.filter(ym => ym.endsWith('-12'));
if (desemberMonths.length > 0) {
    console.log('\nDitemukan bulan Desember:');
    desemberMonths.forEach(ym => {
        console.log(`  ${ym}: ${dateDistribution[ym]} records`);
    });
} else {
    console.log('❌ Tidak ada data bulan Desember!');
}

// Cari bulan dengan ~965 records
console.log('\n\n🔍 BULAN DENGAN ~965 RECORDS:');
console.log('='.repeat(80));

const target = 965;
const tolerance = 50;

const candidates = sorted.filter(ym => {
    const count = dateDistribution[ym];
    return Math.abs(count - target) <= tolerance;
});

if (candidates.length > 0) {
    console.log(`\nBulan yang punya record mendekati ${target}:`);
    candidates.forEach(ym => {
        console.log(`  ✅ ${ym}: ${dateDistribution[ym]} records (selisih: ${Math.abs(dateDistribution[ym] - target)})`);
    });
} else {
    console.log(`\n❌ Tidak ada bulan dengan ~${target} records`);
    console.log('\nBulan dengan record terbanyak:');
    const max = Math.max(...Object.values(dateDistribution));
    const maxMonth = sorted.find(ym => dateDistribution[ym] === max);
    console.log(`  ${maxMonth}: ${max} records`);
}

// Export detail
const outputPath = 'F:\\gpt_crazy_vast\\data\\date_distribution.json';
fs.writeFileSync(outputPath, JSON.stringify({
    totalRecords: masterData.length,
    distribution: dateDistribution,
    desemberMonths: desemberMonths.map(ym => ({
        month: ym,
        count: dateDistribution[ym]
    })),
    candidatesFor965: candidates.map(ym => ({
        month: ym,
        count: dateDistribution[ym],
        diff: Math.abs(dateDistribution[ym] - target)
    }))
}, null, 2));

console.log(`\n\n✅ Detail exported to: ${outputPath}`);
