// Script untuk extract daftar promotor dari data yang akan di-migrate
const fs = require('fs');

console.log('='.repeat(80));
console.log('CEK DAFTAR PROMOTOR DALAM DATA MIGRASI');
console.log('='.repeat(80));

// Baca hasil transformasi
const transformedData = JSON.parse(
    fs.readFileSync('F:\\gpt_crazy_vast\\data\\migration_transformed_final.json', 'utf8')
);

const data = transformedData.data;
console.log(`\nTotal records: ${data.length}`);

// Extract unique promotor
const promotorSet = new Set();
const promotorStats = {};

data.forEach(record => {
    const promotor = record.promotor;
    if (promotor) {
        promotorSet.add(promotor);
        promotorStats[promotor] = (promotorStats[promotor] || 0) + 1;
    }
});

const promotorList = Array.from(promotorSet).sort();

console.log(`\n📋 TOTAL UNIQUE PROMOTOR: ${promotorList.length}`);
console.log('='.repeat(80));

// Tampilkan daftar dengan statistik
console.log('\n📊 DAFTAR PROMOTOR + JUMLAH RECORDS:');
promotorList.forEach((promotor, idx) => {
    const count = promotorStats[promotor];
    console.log(`${(idx + 1).toString().padStart(3)}. ${promotor.padEnd(40)} (${count} records)`);
});

// Generate SQL untuk cek di Supabase
console.log('\n\n' + '='.repeat(80));
console.log('SQL QUERY UNTUK CEK DI SUPABASE:');
console.log('='.repeat(80));

const sqlCheckPromotor = `-- CEK PROMOTOR YANG ADA DI DATABASE
SELECT 
    name,
    id,
    email,
    role,
    status,
    store_id
FROM users
WHERE role = 'promotor'
  AND UPPER(name) IN (
${promotorList.map(p => `    '${p}'`).join(',\n')}
)
ORDER BY name;

-- CEK PROMOTOR YANG MISSING (tidak ada di database)
SELECT DISTINCT 
    unnest(ARRAY[${promotorList.map(p => `'${p}'`).join(', ')}]) AS promotor_name
EXCEPT
SELECT UPPER(name) FROM users WHERE role = 'promotor';
`;

console.log(sqlCheckPromotor);

// Save SQL ke file
fs.writeFileSync('F:\\gpt_crazy_vast\\check_promotor_migration.sql', sqlCheckPromotor);
console.log('\n✅ SQL query disave ke: check_promotor_migration.sql');

// Export daftar promotor
const output = {
    totalRecords: data.length,
    totalUniquePromotor: promotorList.length,
    promotorList: promotorList,
    promotorStats: promotorStats
};

fs.writeFileSync(
    'F:\\gpt_crazy_vast\\data\\promotor_list_migration.json',
    JSON.stringify(output, null, 2)
);

console.log('✅ Daftar promotor disave ke: data/promotor_list_migration.json');
