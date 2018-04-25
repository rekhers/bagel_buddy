const { readFile, createWriteStream } = require('fs');
const { promisify } = require('util');

const GoogleSpreadsheet = require('google-spreadsheet');
const PDFDocument = require('pdfkit');
const config = require('config');
const request = require('request-promise-native');

const { Client } = require('scp2');

const googleCreds = config.get('google');
const atlCreds = config.get('theatlantic');
const slackInfo = config.get('slack');

// stack some || statements
if (
  !googleCreds ||
  !atlCreds ||
  !slackInfo
) {
  console.error('There\'s some credentials missing somewhere...');
  process.exit();
}

const { spreadsheet_id } = googleCreds;
const { useServiceAccountAuth, getInfo } = new GoogleSpreadsheet(spreadsheet_id);
const doc = new PDFDocument;

const readFileAsync = promisify(readFile);
const useServiceAccountAuthAsync = promisify(useServiceAccountAuth);
const getInfoAsync = promisify(getInfo);


/**
 * Get the rows of the Spreadsheet
 * @param  {Object} info  The Spreadsheet Info
 * @param  {Number} tabId The Spreadsheet tab number
 * @return {Promise}      A promise to return the rows
 */
async function getRows(info, tabId = 1) {
  const { getRows } = info.worksheets[tabId];
  const getRowsAsync = promisify(getRows);
  return getRowsAsync();
}

/**
 * Handle the scp upload
 * @param  {Buffer} content The content buffer
 */
function handleSCP(content) {
  const filename = `bagel-${Date.now()}.pdf`;
  const destination = `/www/cmsprod/shared/assets/media/files/dso-bagels/${filename}`;
  const client = new Client(atlCreds);

  client.write({ destination, content }, (err) => {
    if (err) {
      console.error(err);
    }
    sendFax(filename);
  });
}

/**
 * Send a fax to Twilio
 * @param  {String} filename The file name
 */
function sendFax(filename) {
  // just pass through for meow
  handleNotifications(filename);
}

/**
 * Notify parties of successful delivery
 * @param  {String} filename The file name
 */
async function handleNotifications(filename) {
  const options = {
    method: 'POST',
    uri: slackInfo.webhookURL,
    body: {
      channel: '@jgreen',
      icon_emoji: ':bagel:',
      username: 'Bagel.Bot',
      mrkdwn: true,
      text: `
*I've sent the bagel order!*

Hi there, this is a friendly reminder that I have sent the bagel order for the week.

You can see the current order by navigating to: https://cdn.theatlantic.com/assets/media/files/dso-bagels/${filename}.
      `
    },
    json: true
  };

  try {
    const parsedBody = await request(options);
  } catch (error) {
    console.error(error);
  }
  process.exit();
}

/**
 * Kick off the thing
 */
async function init() {
  try {
    await useServiceAccountAuthAsync(googleCreds);

    const info = await getInfoAsync();
    const bagelCount = await getRows(info, 1);
    const contactInfo = await getRows(info, 2);

    const buffer = [];

    doc.on('data', d => buffer.push(d));
    doc.on('end', () => handleSCP(Buffer.concat(buffer)));

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

      if (message.trim() !== '') {
        output += `${message}`;
      }

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
