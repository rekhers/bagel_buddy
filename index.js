const { readFile } = require('fs');

const { promisify } = require('util');

const GoogleSpreadsheet = require('google-spreadsheet');

const readFileAsync = promisify(readFile);

const spreadsheetId = '1wtzFCEh40lqH9OEArcQ7mdKhAZ3JxP1areoxOpBS6gI';

const { useServiceAccountAuth, getInfo } = new GoogleSpreadsheet(spreadsheetId);

const useServiceAccountAuthAsync = promisify(useServiceAccountAuth);

const getInfoAsync = promisify(getInfo);

function readConfig() {
  return readFileAsync('./credentials.json', 'utf-8');
}

async function init() {
  const creds = await readConfig();
  const json = JSON.parse(creds);
  await useServiceAccountAuthAsync(json);

  try {
    const info = await getInfoAsync();
    const { getRows } = info.worksheets[1];
    const getRowsAsync = promisify(getRows);
    const rows = await getRowsAsync();
    const bagelData = rows.map(row => row.type.toLowerCase()).filter(item => item.trim() !== '').reduce((allNames, name) => {
      if (name in allNames) {
        allNames[name]++;
      } else {
        allNames[name] = 1;
      }
      return allNames;
    }, {});

    console.log(bagelData);
  } catch (error) {
    console.error(error);
  }
}

init();
