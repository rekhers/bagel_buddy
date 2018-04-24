const { readFile, createWriteStream } = require('fs');
const { promisify } = require('util');

const GoogleSpreadsheet = require('google-spreadsheet');
const PDFDocument = require('pdfkit');
const client = require('scp2');

const spreadsheetId = '1wtzFCEh40lqH9OEArcQ7mdKhAZ3JxP1areoxOpBS6gI';
const { useServiceAccountAuth, getInfo } = new GoogleSpreadsheet(spreadsheetId);
const doc = new PDFDocument;

const readFileAsync = promisify(readFile);
const useServiceAccountAuthAsync = promisify(useServiceAccountAuth);
const getInfoAsync = promisify(getInfo);

async function getRows(info, tabId = 1) {
  const { getRows } = info.worksheets[tabId];
  const getRowsAsync = promisify(getRows);
  return getRowsAsync();
}

function readConfig() {
  return readFileAsync('./credentials.json', 'utf-8');
}

async function init() {
  try {
    const creds = await readConfig();
    const json = JSON.parse(creds);

    await useServiceAccountAuthAsync(json);

    const info = await getInfoAsync();
    const bagelCount = await getRows(info, 1);
    const contactInfo = await getRows(info, 2);

    doc.pipe(createWriteStream('./bagel.pdf'));
    doc.fontSize(24);
    doc.text(`${info.title}`, {
      align: 'center'
    });

    doc.fontSize(16);
    doc.text(`\n\n`, {
      align: 'center'
    });

    doc.fontSize(12);
    contactInfo.map((row) => {
      const { name, email, phone, message } = row;
      let output = '';

      output += `Name: ${name}\n`;
      output += `Email: ${email}\n`;
      output += `Phone Number: ${phone}\n`;
      output += `${message}`;

      doc.text(output, {
        align: 'center'
      });
    });

    doc.text(`\n\n`, {
      align: 'center'
    });

    let output = '';
    bagelCount.map((row) => {
      output += `${row.type}: ${row.count}\n`;
    });

    doc.fontSize(16);
    doc.text(output);
    doc.end();

  } catch (error) {
    console.error(error);
  }
}

init();
