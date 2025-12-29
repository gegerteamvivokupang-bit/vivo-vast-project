// ============================================================================
// GENERATE SQL INSERT untuk MIGRASI DATA
// ============================================================================

const fs = require('fs');

// Baca hasil transformasi
const transformedPath = 'F:\\gpt_crazy_vast\\data\\migration_transformed.json';
const transformedData = JSON.parse(fs.readFileSync(transformedPath, 'utf8'));

// Mapping dari database (dari query SQL yang sudah dijalankan)
const DB_PROMOTOR_UUID = {
    'SANTI MARIA LUKMINI NAHAK': '218f4692-3309-4fc5-bab0-8bd119af7b7e',  // Misalnya AINI
    'YOMELIANA MARIA MAGNO': '9b2e793b-e1b8-45ec-a2ba-fc5c57059742',      // Misalnya ADRIANA
    'SANDRA LAU': '218f4692-3309-4fc5-bab0-8bd119af7b7e',                  // Placeholder
    'DINDA CHRISTANTI': '218f4692-3309-4fc5-bab0-8bd119af7b7e',            // Placeholder
    // TAMBAHKAN MAPPING LENGKAP DI SINI
};

const DB_STORE_UUID = {
    'PAKARENA': 'dc1202cb-f67c-4b78-9666-beada1b46e4f',
    'SPC ATAMBUA': 'dc1202cb-f67c-4b78-9666-beada1b46e4f',  // Placeholder
    'ANDYS CELL': 'c67687dd-043b-4d91-a2ab-81cd6730effd',
    'BEST GADGET': '0ffc3891-c7b1-4988-80d2-14ed3c3090e6',
    'FATIMA CELL': '530afbb8-6e7a-4b9d-bc6a-16847c01c23d',
    'GARUDA CELL': '30b2dbb6-50f9-4888-a331-d53efd9fac1b',
    'INFINITY CELL': 'fbcd4eec-cf39-485c-86e1-2c9103d04cd2',
    'KERSEN CELL': '6b24681c-c352-4bd1-a27f-05309a85efa2',
    'MARIA': '35bbdd95-49cb-4e4f-987a-de5cb86c604c',
    'MUTIARA CELL': '89cca833-3a3d-4c35-bb28-352eaeacd4a6',
    'NABILA CELL': 'c0f644e4-aba2-4565-b038-71da7db6b976',
    // TAMBAHKAN MAPPING LENGKAP DI SINI
};

const DB_PHONE_TYPE_UUID = {
    'Y21d series': 'ccd53aa2-13d7-48e1-a849-4eea47b91af1',
    'Y400 series': 'c28af8e6-7c48-4d7c-acc4-2aa549b50eea',
    'V60 Lite series': 'bd74b84f-9a0f-4ca9-9444-3828635e3aa7',
    'IQOO Series': '402297b5-8f4e-43c6-b9e4-354182df4adc',
    'V60 Series': 'bd74b84f-9a0f-4ca9-9444-3828635e3aa7',
    'X Series': '7bee4b48-e53e-4d26-bf4d-11ab4592d7d6',
    'Y04 Series': '0bf7ca3e-7cab-462f-9076-9bca67a67fb6',
};

console.log('='.repeat(80));
console.log('GENERATE SQL INSERT STATEMENTS');
console.log('='.repeat(80));

const records = transformedData.data;
const sqlStatements = [];
const warnings = [];

console.log(`\nTotal records: ${records.length}`);

// Helper function untuk escape string SQL
function sqlEscape(str) {
    if (str === null || str === undefined) return 'NULL';
    if (typeof str === 'number') return str;
    if (typeof str === 'boolean') return str;

    // Escape single quotes
    return `'${String(str).replace(/'/g, "''")}'`;
}

// Generate SQL untuk setiap record
records.forEach((record, index) => {
    const promotorUuid = DB_PROMOTOR_UUID[record.promotor];
    const storeUuid = DB_STORE_UUID[record.namaToko];
    const phoneTypeUuid = record.tipeHP ? DB_PHONE_TYPE_UUID[record.tipeHP] : null;

    if (!promotorUuid) {
        warnings.push(`Row ${index + 1}: Promotor "${record.promotor}" tidak ditemukan di mapping UUID`);
    }
    if (!storeUuid) {
        warnings.push(`Row ${index + 1}: Toko "${record.namaToko}" tidak ditemukan di mapping UUID`);
    }

    // Normalize phone
    let phone = String(record.customerPhone || '');
    if (phone && !phone.startsWith('+')) {
        // Jika dimulai dengan 0, ganti dengan +62
        if (phone.startsWith('0')) {
            phone = '+62' + phone.substring(1);
        } else if (!phone.startsWith('62')) {
            phone = '+62' + phone;
        } else {
            phone = '+' + phone;
        }
    }

    const sql = `INSERT INTO vast_finance_data_new (
    created_by_user_id,
    store_id,
    sale_date,
    customer_name,
    customer_phone,
    pekerjaan,
    penghasilan,
    has_npwp,
    status,
    limit_amount,
    phone_type_id,
    approval_status,
    transaction_status,
    source,
    created_at,
    updated_at
) VALUES (
    ${sqlEscape(promotorUuid)},
    ${sqlEscape(storeUuid)},
    ${sqlEscape(record.saleDate)},
    ${sqlEscape(record.customerName)},
    ${sqlEscape(phone)},
    ${sqlEscape(record.pekerjaan)},
    ${record.penghasilan || 'NULL'},
    ${record.hasNpwp},
    ${sqlEscape(record.status)},
    ${record.limitAmount || 'NULL'},
    ${phoneTypeUuid ? sqlEscape(phoneTypeUuid) : 'NULL'},
    ${sqlEscape(record.approvalStatus)},
    ${sqlEscape(record.transactionStatus)},
    'migration_excel_dec2025',
    TIMESTAMP '${record.saleDate} 10:00:00' AT TIME ZONE 'Asia/Makassar',
    TIMESTAMP '${record.saleDate} 10:00:00' AT TIME ZONE 'Asia/Makassar'
);`;

    sqlStatements.push(sql);
});

console.log(`\n✅ Generated ${sqlStatements.length} SQL statements`);
console.log(`⚠️ Warnings: ${warnings.length}`);

if (warnings.length > 0) {
    console.log('\n⚠️ WARNINGS (10 pertama):');
    warnings.slice(0, 10).forEach(w => console.log(`  ${w}`));
}

// Export SQL file
const sqlOutput = `-- ============================================================================
-- SQL MIGRATION: Data Desember 2025
-- Generated: ${new Date().toISOString()}
-- Total Records: ${sqlStatements.length}
-- ============================================================================

-- BACKUP DATA TESTING (JALANKAN DULU!)
-- CREATE TABLE vast_finance_data_new_backup AS SELECT * FROM vast_finance_data_new;

-- HAPUS DATA TESTING (HATI-HATI!)
-- DELETE FROM vast_finance_data_new;

-- INSERT DATA DESEMBER 2025
${sqlStatements.join('\n\n')}

-- ============================================================================
-- SELESAI!
-- ============================================================================

-- Verify hasil insert
SELECT 
    TO_CHAR(sale_date, 'YYYY-MM-DD') AS tanggal,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'acc') AS acc,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE status = 'reject') AS reject
FROM vast_finance_data_new
WHERE source = 'migration_excel_dec2025'
GROUP BY TO_CHAR(sale_date, 'YYYY-MM-DD')
ORDER BY tanggal;
`;

const sqlFilePath = 'F:\\gpt_crazy_vast\\data\\migration_desember2025.sql';
fs.writeFileSync(sqlFilePath, sqlOutput);

console.log(`\n\n✅ SQL file berhasil di-export ke: ${sqlFilePath}`);
console.log('\n📋 Sample SQL (2 statement pertama):');
console.log(sqlStatements[0]);
console.log('\n---\n');
console.log(sqlStatements[1]);

console.log('\n\n' + '='.repeat(80));
console.log('⚠️ IMPORTANT NOTES:');
console.log('='.repeat(80));
console.log('1. File SQL sudah siap, tapi masih pakai UUID PLACEHOLDER untuk promotor/toko!');
console.log('2. Anda HARUS update mapping UUID di script ini terlebih dahulu');
console.log('3. Query ke database untuk dapat UUID asli:');
console.log('   - SELECT name, id FROM users WHERE role = \\'promotor\\' ORDER BY name;');
console.log('   - SELECT name, id FROM stores ORDER BY name;');
console.log('4. Setelah mapping di-update, jalankan ulang script ini');
console.log('5. Baru kemudian execute SQL file di Supabase');
console.log('='.repeat(80));
