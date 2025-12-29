const fs = require('fs');
const data = JSON.parse(fs.readFileSync('F:\\gpt_crazy_vast\\data\\migration_transformed_final.json', 'utf8'));

const dinda = data.data.filter(r => r.promotor === 'DINDA CHRISTANTI');

console.log('Total records DINDA CHRISTANTI:', dinda.length);
console.log('Toko:', dinda[0]?.namaToko);
console.log('ID Toko:', dinda[0]?.idToko);
console.log('\nSample records (3 pertama):');
console.log(JSON.stringify(dinda.slice(0, 3), null, 2));

// Cek toko UUID
const storeUUID = dinda[0]?.idToko === 'SPC001' ? '09f655e6-cbc7-4730-9301-acb2ee2ea7ff' : 'UNKNOWN';
console.log('\nStore UUID:', storeUUID);
console.log('Store Name:', dinda[0]?.namaToko);
