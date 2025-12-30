// Script untuk membaca Excel file migrasi data Desember
const XLSX = require('xlsx');
const fs = require('fs');

const excelFilePath = 'F:\\gpt_crazy_vast\\Data Sheet Vast data desmber.xlsx';

console.log('='.repeat(80));
console.log('MEMBACA FILE EXCEL: Data Sheet Vast data desmber.xlsx');
console.log('='.repeat(80));

try {
    // Baca file Excel
    const workbook = XLSX.readFile(excelFilePath);

    console.log('\n📋 DAFTAR SHEET YANG ADA:');
    console.log(workbook.SheetNames);
    console.log('');

    // Cek setiap sheet
    workbook.SheetNames.forEach((sheetName, index) => {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`SHEET ${index + 1}: "${sheetName}"`);
        console.log('='.repeat(80));

        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log(`\nJumlah baris: ${data.length}`);

        // Tampilkan header (baris pertama)
        if (data.length > 0) {
            console.log('\n📌 HEADER (Kolom):');
            console.log(data[0]);

            // Tampilkan 3 baris pertama sebagai sample
            console.log('\n📊 SAMPLE DATA (3 baris pertama):');
            for (let i = 0; i < Math.min(4, data.length); i++) {
                console.log(`\nBaris ${i + 1}:`);
                console.log(data[i]);
            }
        }
    });

    // Fokus ke sheet "master data all" atau yang mirip
    console.log('\n\n' + '='.repeat(80));
    console.log('MENCARI SHEET "MASTER DATA ALL"...');
    console.log('='.repeat(80));

    const masterSheetName = workbook.SheetNames.find(name =>
        name.toLowerCase().includes('master') ||
        name.toLowerCase().includes('data all')
    );

    if (masterSheetName) {
        console.log(`\n✅ DITEMUKAN: "${masterSheetName}"\n`);

        const masterSheet = workbook.Sheets[masterSheetName];
        const masterData = XLSX.utils.sheet_to_json(masterSheet);

        console.log(`Total records: ${masterData.length}`);
        console.log('\n📋 STRUKTUR DATA (5 record pertama):');
        console.log(JSON.stringify(masterData.slice(0, 5), null, 2));

        // Analisis kolom
        if (masterData.length > 0) {
            console.log('\n\n📊 ANALISIS KOLOM:');
            console.log('='.repeat(80));

            const columns = Object.keys(masterData[0]);
            columns.forEach((col, idx) => {
                // Cek sample nilai
                const sampleValues = masterData.slice(0, 3).map(row => row[col]);
                console.log(`\n${idx + 1}. "${col}"`);
                console.log(`   Sample: ${JSON.stringify(sampleValues)}`);
            });
        }

        // Export ke JSON untuk analisis lebih lanjut
        const outputPath = 'F:\\gpt_crazy_vast\\data\\excel_analysis.json';
        fs.writeFileSync(outputPath, JSON.stringify({
            sheetNames: workbook.SheetNames,
            masterSheetName: masterSheetName,
            totalRecords: masterData.length,
            columns: masterData.length > 0 ? Object.keys(masterData[0]) : [],
            sampleData: masterData.slice(0, 10)
        }, null, 2));

        console.log(`\n\n✅ Data berhasil di-export ke: ${outputPath}`);

    } else {
        console.log('\n⚠️ SHEET "MASTER DATA ALL" TIDAK DITEMUKAN');
        console.log('Sheet yang tersedia:');
        workbook.SheetNames.forEach((name, idx) => {
            console.log(`${idx + 1}. ${name}`);
        });
    }

} catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
}
