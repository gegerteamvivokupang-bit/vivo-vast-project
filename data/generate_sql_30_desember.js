// ============================================================================
// GENERATE SQL INSERT TANGGAL 30 DESEMBER 2025
// ============================================================================

const fs = require('fs');
const path = require('path');

// Load transformed data 30 Desember
const transformedPath = path.join(__dirname, 'migration_30_desember_transformed.json');
const transformedData = JSON.parse(fs.readFileSync(transformedPath, 'utf8'));

console.log('='.repeat(80));
console.log('GENERATE SQL INSERT - 30 DESEMBER 2025');
console.log('='.repeat(80));

// ============================================================================
// MAPPING UUID PROMOTOR (dari database)
// ============================================================================
const DB_PROMOTOR_UUID = {
    'ADRIANA': '9b2e793b-e1b8-45ec-a2ba-fc5c57059742',
    'AINI RAHMATINI NATALIA MOESTAKIM': '218f4692-3309-4fc5-bab0-8bd119af7b7e',
    'ALDIANA WELIA PANIE': '067c47ba-9638-4b56-add4-3c59d9ec328a',
    'ALITA D PAU': '44e3bdda-3da6-444f-bd32-f01d869bbc3b',
    'AMBU BAIQ JUMENAH': '0fca68bb-4445-4043-b851-50a405d54901',
    'ANAK AGUNG SRI WULANTIWI': '65b22826-5c27-4ff8-8276-bbc664f2e8f0',
    'ANDHIKA ULLY': 'd87b788c-b59a-4994-abdd-b94a34188b46',
    'ANGELA BOUKA BERI': '08dac9ab-85ac-4906-81c2-da9bf30b817c',
    'ANITA ANA AMAH': '328d11fd-74c1-4fd8-a788-722ab3b51885',
    'ANNA RAHMATIA JUFRI': 'cabd42dc-048d-46c3-bfa5-13f75a894689',
    'ANYARMITHA SOPHIA SUEK': 'a5a7fb67-2524-47d9-819f-c8f3dfde398a',
    'ARMINDA TEKU MANEK': 'd0d4a13e-6c5c-4d2f-8eb5-ab93654cdcd6',
    'ASRI NINGSI RAMBU ATA ENDI': 'cba59c3e-56b1-4953-b328-0edeceaaca9d',
    'ASTUTI BELA WAWO': '0ee3305f-60e7-48e3-b6c6-88161be113b8',
    'AZ ZAHRA SITI ZAINAB': '6b72905b-a553-4f12-8d40-730237dbd13e',
    'BERGITHA NIA OLIN': '7232802a-727e-40da-ab08-c891177fd1b0',
    'CHESIA ALBERTI BALIK': '00245452-1cbb-407c-8b4f-f0dc76380174',
    'CHOIRUNISA ILHAM': 'ad58a293-fa8b-4554-810d-d488e290427d',
    'DEWI RAHMAN': 'f6a85c85-8f61-4aec-9c44-df5958f9220c',
    'DINDA CHRISTANTI': '185acbd0-5361-47cd-83d4-da4750c80c58',
    'DWITNEY PRETY WANGGANDIMA': '03202fc3-fbb7-4e7c-8964-22a29c144a01',
    'EMPI FRANGKI LIEM': '59529ff7-2e5a-4ce6-b4a6-a657521f8d75',
    'ESTER LUDJI': '457d49fb-1cce-432d-b455-c3d30c517955',
    'FEBRIANTHY ELISABET NA\'U': '0de011a6-2330-49ba-bf03-06a3d40fe8ab',
    'FERI ELI KURNIAWAN': '710b6209-33cd-459b-bf65-73dde6eb05d0',
    'FREDERIKA ALVONSIA LENGO': '9318c7b0-43f0-4a2c-b8e3-3695cc609bc1',
    'GRACELLA SARI HIVANA MANAFE': 'd9f82137-597e-47f9-92bd-8d3d860f22fc',
    'HERONIMUS NAMU WALI': 'c5af0ece-c462-4efd-ad12-3c90e3de69b4',
    'IDMAL YUSDIRAN YUSUF': 'abffc3f2-5c0c-443a-8c5d-c4f30015a4c6',
    'IMELDA KULLA': '2f41ed84-7604-4454-9d90-4160129a39e2',
    'IRENE NOVALIA KADJU': 'fb12577b-6194-4da9-b715-32122917da4d',
    'ISWAN ASAMAU': '177302f3-bffb-4e91-8e67-ff5d0bf881a5',
    'JULIA DESY CASANDRA DA SILVA FREITAS': '80cd819c-4bf0-41a3-a37d-2a73fd2b2dc0',
    'KAMARIA ANDI BASO': '95e8ae03-8a99-49c4-a22c-33c4ac7c50ca',
    'KESIA NATALIA I. BENU': 'c92999ff-830c-4750-8838-523f4d96fdb1',
    'LASTRIANA PALUS': 'a3cdc96d-cba9-4885-8cb6-5154a678a94d',
    'LILIK ERMA KEHI': '05fa78b8-8552-4c59-b027-dacf4b0dc00b',
    'LINDA MELSIANA ELLO': '6093e1e5-4afe-45d8-8ca5-6e36b8ecda3a',
    'MARATHA MARLINDA FANGGIDAE': '6dd59a64-2f66-4da2-8067-9c97792ff194',
    'MARIA DENTIANA L HAUMETAN': '9c1921ed-d216-4da4-ba6a-24aa54b66d67',
    'MARIA ISABELA NONIS': '90aa7d38-8e31-4cb4-9bc7-83180fd8055e',
    'MARIA MELAN ANANCE BILI': 'c9cdedbc-7fdb-482a-b000-f80b07c07c45',
    'MARNITHA JUWIKE TIMORATI RUNESI': '567e02f4-edc5-4f59-b3d6-8624694bf18b',
    'MELIYANI RATNASARI SYUKRI': 'fe526ce9-21be-4fe6-a561-7d58698dce74',
    'MERDA PUTRI BUNGSU KENAT': 'acf6bc66-b910-48d1-8b2e-0b7db36d6125',
    'MEXY ALEXANDER HETMINA': '713f0cd2-6e68-490a-bf81-e8005c4328a1',
    'NABILA RAHMAWATI': '9d4fd5c0-1e31-438b-ba47-416b6ac7501b',
    'NENY MERLIANTI NA\'U': '9841cbd4-576b-48ac-81b3-e9a7da646625',
    'NOVANTRY RUTHANIA NAFFIE': '5ab210aa-6822-458c-a4f4-3f9bba11b5a3',
    'NOVLIANA BARBALINA MISA': '0e6c4493-1ff5-4d0a-ad66-dd1ecf764c22',
    'NUR FATIMAH MOLBANG': '466ffb89-a3f9-463e-bc6b-d0300cf7981c',
    'PATRIANI MENGI ULY': '82a2f9ab-5fea-46a0-a78f-924c34d544f0',
    'PAULINA FRANSISKA GELI': 'ea9ef5ec-fc02-4440-87d4-c8ed5f3d28d3',
    'PRETI SISILIA SILA': 'c2728582-44c3-41f5-b6e9-5b05d3f97a55',
    'PUSPA ANGGREINI': '26efd086-af8b-40b0-87a2-ea51a8aac9e2',
    'RESTIANY MARIA LUAN KALI': 'f326ecff-f7f8-49b0-a3b6-73a05a64812f',
    'ROS YANE KANA LUDJI': 'a39cebcc-66b2-441c-b353-e755e5663c65',
    'SANDRA LAU': 'cf8a7c95-fe2c-403c-8e7e-6c494f58e5da',
    'SANTI MARIA LUKMINI NAHAK': '467f8aaa-4d3a-4e0e-b0a9-1c7cb4975508',
    'SELVINCE BAKO': 'a39647d5-40c7-484e-a185-cc348f04b540',
    'SKOLASTIKA B TAUNAES': '2c5e2271-2638-467c-ac09-9ce95393ad37',
    'SULIS NURAINI INSYATUN': '35b0e659-e854-435f-b8d1-1778cefcc1ba',
    'TERSIANA KADJA PAU': '1dfd5f4e-9510-4240-9086-2e5f459f0a91',
    'WARDIA': '10658c60-0301-495f-8349-a99cc07b1ce9',
    'WINDRI MANOE': '63543570-efb1-4884-b5e7-5e69934ef110',
    'YASINTHA MBU': 'a332c68a-e8ff-4cee-91f6-0b043afa3557',
    'YENDRI ELISHABET BERELOE': '45c05e43-c2ea-4a75-9dc4-52d2f43f21b9',
    'YEREMIAS MBAWA KANJAPI': '6d546282-d152-44fc-9db7-d758c2c0376c',
    'YOHANA NOVIANA MARIANA GAA': '4901728f-0710-4f14-bde7-def9b3bd66d1',
    'YOHANIS TIPNONI': '389caa2b-e0a1-478e-a008-0ad9c20b5d5c',
    'YOMELIANA MARIA MAGNO': '18b60e1b-c7c6-43e1-aea7-1b50071c0874',
    'YOVANDA KATRINA NAE': '3fb63edf-9cb7-4222-9d9c-cbdf6f5fde99',
    'YUNITA TAMELAB': '822701a1-5eb4-4c80-8f83-d35f857f8845'
};

// ============================================================================
// MAPPING UUID TOKO (dari database)
// ============================================================================
const DB_STORE_UUID = {
    'ALIONG CELL': '873ea438-4751-490c-8017-8cd12c77cb82',
    'ANDYS CELL': 'c67687dd-043b-4d91-a2ab-81cd6730effd',
    'AZIZAH CELL': 'a6f39956-898b-4ce1-9206-7885005b195e',
    'BEST GADGET': '0ffc3891-c7b1-4988-80d2-14ed3c3090e6',
    'CELLULER WORLD': '7974307a-2d95-4d17-8e54-f7015cbe5334',
    'DCELL': 'ff2927d4-1af8-43d1-91cc-360e044bd777',
    'ERAFONE LIPPO': '78a17f5b-c318-435b-b8fd-4ca569f44c15',
    'ERAFONE MEGASTORE': '107e00ce-0d2d-4234-914a-25651d73b5e0',
    'FATIMA CELL': '530afbb8-6e7a-4b9d-bc6a-16847c01c23d',
    'GARUDA CELL': '30b2dbb6-50f9-4888-a331-d53efd9fac1b',
    'GISMCELL': '546e48cb-cbad-450d-9fa5-804650a39079',
    'GLOBAL TEKNIK 1': '2c77c57b-14ca-49fe-a48d-7644ad67982f',
    'GLOBAL TEKNIK 2': '5281ee23-6a2c-47b4-96de-5c2e47d0f4f0',
    'GLOBAL TEKNIK 3': '9eab12f4-1ed9-4eda-84ad-f1796c8ace3f',
    'GLOBAL TEKNIK 4': '5e262410-0b38-4c22-83b8-35830f6e084e',
    'INFINITY CELL': 'fbcd4eec-cf39-485c-86e1-2c9103d04cd2',
    'KERSEN CELL': '6b24681c-c352-4bd1-a27f-05309a85efa2',
    'KHAIR CELL': '53e5db25-fbaa-443c-aeaa-fb39929f80c3',
    'KHAIRIL CELL': '2abc8cc8-b07f-471b-9cfd-9b5103828c87',
    'KING CELL': '1c8ca68b-d578-4ef9-9f3c-e7262be8a108',
    'MARIA': '35bbdd95-49cb-4e4f-987a-de5cb86c604c',
    'MCELL': 'a91832d8-6c2d-403c-bf02-e4fc1fa6cfb8',
    'MUTIARA CELL': '89cca833-3a3d-4c35-bb28-352eaeacd4a6',
    'NABILA CELL': 'c0f644e4-aba2-4565-b038-71da7db6b976',
    'PAKARENA': 'dc1202cb-f67c-4b78-9666-beada1b46e4f',
    'PITSTOP CELL': 'f49312e5-d606-401d-9d6e-a2923d0258e0',
    'PLANET GADGET': 'f1bc905d-aa3e-430b-8efe-8db2e42c2817',
    'PRIMA ELEKTRONIK': 'b3003fb9-8017-4a3b-b975-951dd1c71fab',
    'PUTRA SULAWESI': '0977a42d-3d4e-4c1e-8671-2e12edec5897',
    'QINARA CELL': '0dd45a4d-fa22-4db1-9d22-e394da8d690c',
    'QUEEN CELL': '6fb1bbdc-ba3c-469b-ab77-e2baa328095d',
    'RESKY CELL': 'fbf750de-ca6c-4670-b967-c92db1b911da',
    'SACCA CELL': 'f24ec343-7c17-48ce-9917-c8e38b732acd',
    'SOCCO CELL': '9a1622cd-c0ad-43cd-8271-ea20d8b2310c',
    'SOCCO CELL 3': '530b1666-deb2-4330-bf54-369921b50f49',
    'SPC ATAMBUA': '09f655e6-cbc7-4730-9301-acb2ee2ea7ff',
    'SPC JAWARA': '77e52a1a-282a-413c-a111-98de491cf8ea',
    'SPC KEFAMENANU': '4e433321-7d99-4732-b3f8-31cc5b5221c2',
    'SPC KUANINO': '1e5d09aa-d60e-462c-951c-19ff603ac495',
    'SPC MASTER CELL': '676a8a4c-0dd1-4f4d-a975-8baa7237285c',
    'SPC OESAO': '2d4dd36a-1dfa-4755-98f6-ef8025985d65',
    'SPC OESAPA': '43032de3-edac-4d21-888d-53eba194a296',
    'SPC PLATINUM': '3a13994a-febb-4f45-a4de-e77f3e01f405',
    'SPC SAHABAT': 'c6241064-132c-4d4c-9882-da9a82571065',
    'SPC SOE': 'bb2acd1d-63b3-4440-88fd-053dd31048ea',
    'SPC STARLIGHT': 'c33cee99-e082-409d-bb4a-1a380f20ce7c',
    'SPC TDM': '315b8157-0c24-47e4-a507-b4a0204d0f40',
    'SPC TERMINAL': '67519478-4983-422f-b0da-9ca6c02ec901',
    'SPC WAINGAPU': 'aeabee75-817a-40c2-9dd3-8ebdb3971871',
    'SRISOLO MANDIRI': 'a4ded095-58a9-488a-aae3-06ee5e394a29',
    'SRT CELL': '50dbdebf-52c0-4cb6-ba10-22e86f9b3ee3',
    'SUPER CELL OESAPA': 'b1964988-64f1-48be-a817-71bb48eda470',
    'TERMINAL HP': 'b0a5426c-938b-42e9-8381-9de81ebb35ae',
    'TIMOR CELL': '458160cb-6735-41cd-b5b0-3a4dba5e9140',
    'WIN CELL': '530bb079-c326-4449-a9e2-1341369c01cf'
};

// Mapping tipe HP
const DB_PHONE_TYPE_UUID = {
    'Y21d series': 'ccd53aa2-13d7-48e1-a849-4eea47b91af1',
    'Y21d Series': 'ccd53aa2-13d7-48e1-a849-4eea47b91af1',
    'Y400 series': 'c28af8e6-7c48-4d7c-acc4-2aa549b50eea',
    'Y400 Series': 'c28af8e6-7c48-4d7c-acc4-2aa549b50eea',
    'V60 Lite series': 'bd74b84f-9a0f-4ca9-9444-3828635e3aa7',
    'V60 Lite Series': 'bd74b84f-9a0f-4ca9-9444-3828635e3aa7',
    'V60 Series': 'bd74b84f-9a0f-4ca9-9444-3828635e3aa7',
    'V60 series': 'bd74b84f-9a0f-4ca9-9444-3828635e3aa7',
    'IQOO Series': '402297b5-8f4e-43c6-b9e4-354182df4adc',
    'iqoo series': '402297b5-8f4e-43c6-b9e4-354182df4adc',
    'X Series': '7bee4b48-e53e-4d26-bf4d-11ab4592d7d6',
    'x series': '7bee4b48-e53e-4d26-bf4d-11ab4592d7d6',
    'Y04 Series': '0bf7ca3e-7cab-462f-9076-9bca67a67fb6',
    'y04 series': '0bf7ca3e-7cab-462f-9076-9bca67a67fb6'
};

console.log(`\nTotal Promotor di mapping: ${Object.keys(DB_PROMOTOR_UUID).length}`);
console.log(`Total Toko di mapping: ${Object.keys(DB_STORE_UUID).length}`);

// Helper SQL escape
function sqlEscape(str) {
    if (str === null || str === undefined) return 'NULL';
    if (typeof str === 'number') return str;
    if (typeof str === 'boolean') return str;
    return `'${String(str).replace(/'/g, "''")}'`;
}

// Generate SQL
const records = transformedData.data;
const sqlStatements = [];
const warnings = [];
const stats = {
    total: records.length,
    promotorNotFound: 0,
    storeNotFound: 0,
    success: 0
};

console.log(`\n${'='.repeat(80)}`);
console.log('GENERATE SQL STATEMENTS');
console.log('='.repeat(80));

records.forEach((record, index) => {
    const promotorUuid = DB_PROMOTOR_UUID[record.promotor];
    const storeUuid = DB_STORE_UUID[record.namaToko];
    const phoneTypeUuid = record.tipeHP ? DB_PHONE_TYPE_UUID[record.tipeHP] : null;

    if (!promotorUuid) {
        warnings.push(`Row ${index + 1}: Promotor "${record.promotor}" tidak ditemukan di mapping UUID`);
        stats.promotorNotFound++;
    }

    if (!storeUuid) {
        warnings.push(`Row ${index + 1}: Toko "${record.namaToko}" tidak ditemukan di mapping UUID`);
        stats.storeNotFound++;
    }

    if (promotorUuid && storeUuid) {
        stats.success++;

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
    ${sqlEscape(record.customerPhone)},
    ${sqlEscape(record.pekerjaan)},
    ${record.penghasilan || 'NULL'},
    ${record.hasNpwp},
    ${sqlEscape(record.status)},
    ${record.limitAmount || 'NULL'},
    ${phoneTypeUuid ? sqlEscape(phoneTypeUuid) : 'NULL'},
    ${sqlEscape(record.approvalStatus)},
    ${sqlEscape(record.transactionStatus)},
    'excel',
    TIMESTAMP '${record.saleDate} 10:00:00' AT TIME ZONE 'Asia/Makassar',
    TIMESTAMP '${record.saleDate} 10:00:00' AT TIME ZONE 'Asia/Makassar'
);`;

        sqlStatements.push(sql);
    }
});

console.log(`\n📊 STATISTIK:`);
console.log(`  Total records: ${stats.total}`);
console.log(`  ✅ Success: ${stats.success}`);
console.log(`  ⚠️ Promotor not found: ${stats.promotorNotFound}`);
console.log(`  ⚠️ Store not found: ${stats.storeNotFound}`);

if (warnings.length > 0) {
    console.log(`\n⚠️ WARNINGS (10 pertama):`);
    warnings.slice(0, 10).forEach(w => console.log(`  ${w}`));
}

// Export SQL file
const sqlOutput = `-- ============================================================================
-- SQL MIGRATION: Data 30 Desember 2025
-- Generated: ${new Date().toISOString()}
-- Total Records: ${stats.success}
-- ============================================================================

-- ⚠️ CATATAN: Ini adalah data TAMBAHAN untuk tanggal 30 Desember 2025
-- Data sebelumnya (1-29 Desember) sudah ada di database
-- JANGAN hapus data yang sudah ada!

-- ============================================================================
-- INSERT DATA 30 DESEMBER 2025 (${stats.success} records)
-- ============================================================================

${sqlStatements.join('\n\n')}

-- ============================================================================
-- SELESAI!
-- ============================================================================

-- Verify hasil insert untuk tanggal 30 Desember
SELECT 
    TO_CHAR(sale_date, 'YYYY-MM-DD') AS tanggal,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'acc') AS acc,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE status = 'reject') AS reject
FROM vast_finance_data_new
WHERE source = 'excel'
  AND sale_date = '2025-12-30'
GROUP BY TO_CHAR(sale_date, 'YYYY-MM-DD');

-- Verify total Desember 2025
SELECT 
    TO_CHAR(sale_date, 'YYYY-MM-DD') AS tanggal,
    COUNT(*) AS total
FROM vast_finance_data_new
WHERE source = 'excel'
  AND sale_date >= '2025-12-01'
  AND sale_date <= '2025-12-31'
GROUP BY TO_CHAR(sale_date, 'YYYY-MM-DD')
ORDER BY tanggal;

-- Total keseluruhan Desember 2025
SELECT 
    'Desember 2025' AS periode,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'acc') AS acc,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE status = 'reject') AS reject
FROM vast_finance_data_new
WHERE source = 'excel'
  AND sale_date >= '2025-12-01'
  AND sale_date <= '2025-12-31';
`;

const sqlFilePath = path.join(__dirname, '..', 'migration_30_desember2025.sql');
fs.writeFileSync(sqlFilePath, sqlOutput);

console.log(`\n\n✅ SQL file exported to: ${sqlFilePath}`);
console.log(`\n📄 File berisi ${stats.success} INSERT statements siap execute!`);

// Export warnings
if (warnings.length > 0) {
    const warningsPath = path.join(__dirname, '..', 'migration_30_desember_warnings.txt');
    fs.writeFileSync(warningsPath, warnings.join('\n'));
    console.log(`\n⚠️ Warnings exported to: ${warningsPath}`);
}

console.log(`\n${'='.repeat(80)}`);
console.log('✅ GENERATION SELESAI!');
console.log('='.repeat(80));
console.log('\n📋 NEXT STEPS:');
console.log('1. Review file: migration_30_desember2025.sql');
console.log('2. Execute SQL di Supabase SQL Editor');
console.log('3. Verify hasil dengan query yang sudah disediakan di file SQL');
console.log(`\n🎯 ${stats.success} records siap dimigrate ke database!`);
