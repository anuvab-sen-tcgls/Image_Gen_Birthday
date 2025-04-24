const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const csv = require('csv-parser');
const axios = require('axios');
const FormData = require('form-data');
const { Parser } = require('json2csv');

const csvFilePath = path.resolve(__dirname, 'data.csv');
const outputDir = path.resolve(__dirname, 'output');
const outputCsvPath = path.resolve(__dirname, 'output_with_urls.csv');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const records = [];
const outputRecords = [];

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', (row) => records.push(row))
  .on('end', async () => {
    console.log('📄 CSV loaded. Generating images...');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    for (const row of records) {
      const name = (row.Name || row['\uFEFFName'] || '').trim();
      const gender = (row.Gender || '').trim().toLowerCase();

      if (!name || !gender) {
        console.warn(`⚠️ Skipping invalid row:`, row);
        continue;
      }

      const isMale = gender === 'male';
      const imagePath = path.resolve(__dirname, isMale ? 'Y_M.png' : 'Y_G.png');
      const nameColor = isMale ? '#007BFF' : '#d2368c';

      const imageBuffer = fs.readFileSync(imagePath);
      const imageBase64 = imageBuffer.toString('base64');
      const imageDataURL = `data:image/png;base64,${imageBase64}`;

      const htmlContent = `
        <html>
          <head>
            <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Segoe UI', sans-serif; }
              .container {
                position: relative;
                width: 768px;
                height: 768px;
              }
              .container img {
                width: 100%;
                height: 100%;
                display: block;
              }
              .text-overlay {
                position: absolute;
                top: 18%;
                left: 50%;
                transform: translateX(-50%);
                text-align: center;
                color: #000;
                font-weight: 600;
              }
              .name {
                font-family: 'Great Vibes', cursive;
                font-size: 60px;
                color: ${nameColor};
                margin-top: 10px;
                margin-bottom: 20px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <img src="${imageDataURL}" />
              <div class="text-overlay">
                <div class="name">${name}</div>
              </div>
            </div>
          </body>
        </html>
      `;

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      await page.setViewport({ width: 768, height: 768 });

      const outputFilePath = path.join(outputDir, `birthday_${name}.png`);
      await page.screenshot({ path: outputFilePath });

      console.log(`🎉 Created: ${outputFilePath}`);

      // Upload to API
      try {
        const form = new FormData();
        form.append('data', JSON.stringify({ name, date: new Date().toISOString().slice(0, 10) }));
        form.append('files.template', fs.createReadStream(outputFilePath));

        const response = await axios.post(
          'https://uat.yukio.in/strapi-yukio/api/birthday-images?populate=*',
          form,
          {
            headers: {
              Authorization: 'Bearer 9eb04dfcf45939598df2228362dafa8e51271432b3613bcd17608b3e4eeb71475c865318a7f54645cf1314191869ccbc66a3cca99165a99b609469e2e2eaf52f0b307c193b374bd2c7ef94482a82376439c702c955b56d800320c4e6f621a18fa5cb2b9a69822fdaa27204f40d1b8e386c5eca10ccd1ecfc46b0f6ada94fabdf',
              ...form.getHeaders(),
            },
          }
        );

        const uploadedUrl = response.data.data.attributes.template?.data?.attributes?.url || 'URL not found';
        console.log(`✅ Uploaded: ${name}`);
        console.log(`📸 URL: ${uploadedUrl}`);
        console.log(JSON.stringify(response.data, null, 2));

        outputRecords.push({ name, url: uploadedUrl });
      } catch (err) {
        console.error(`❌ Upload failed for ${name}:`, err.message);
        outputRecords.push({ name, url: 'Upload failed' });
      }
    }

    await browser.close();

    // Write output CSV
    const json2csvParser = new Parser({ fields: ['name', 'url'] });
    const csvOutput = json2csvParser.parse(outputRecords);
    fs.writeFileSync(outputCsvPath, csvOutput);
    console.log(`📁 output_with_urls.csv saved at: ${outputCsvPath}`);
    console.log('✅ All done.');
  })
  .on('error', (err) => {
    console.error('❌ CSV read error:', err);
  });
