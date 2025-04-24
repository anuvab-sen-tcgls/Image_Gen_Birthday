const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const csvFilePath = path.resolve(__dirname, 'data.csv');

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', (row) => {
    // Handle BOM: '\uFEFFName' is a common hidden header issue
    const name = (row.Name || row['\uFEFFName'] || '').trim();
    const gender = (row.Gender || '').trim();

    if (name && gender) {
      console.log(`👤 Name: ${name}, Gender: ${gender}`);
    } else {
      console.warn('⚠️ Skipping row with missing data:', row);
    }
  })
  .on('end', () => {
    console.log('✅ Done reading CSV file.');
  })
  .on('error', (err) => {
    console.error('❌ Error reading CSV:', err);
  });
