const { readFile, createWriteStream, statSync } = require('fs');
const { join } = require('path');
const { promisify } = require('util');

const GoogleSpreadsheet = require('google-spreadsheet');
const PDFDocument = require('pdfkit');
const Twilio = require('twilio');
const config = require('config');
const request = require('request-promise-native');

const googleCreds = config.get('google');
const slackInfo = config.get('slack');
const twilioCreds = config.get('twilio');

// stack some || statements
if (
  !googleCreds ||
  !slackInfo ||
  !twilioCreds
) {
  console.error('There\'s some credentials missing somewhere...');
  process.exit();
}

const { accountSID, authToken } = twilioCreds;
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
 * Send a fax to Twilio
 * @param  {String} filename The file name
 */
async function sendFax(filename) {
  try {

    const twilio = Twilio(accountSID, authToken);
    const mediaUrl = `https://cdn.theatlantic.com/assets/media/files/dso-bagels/${filename}`;
    const opts = {
      // ATL helpdesk
      // to: '+12022666001',

      // Bagel people
      to: '+12024667961',
      from: '+15025136369',
      mediaUrl,
    };
    await twilio.fax.v1.faxes.create(opts);
    handleNotifications(mediaUrl);
  } catch(err) {
    console.log(err);
  }
}

/**
 * Notify parties of successful delivery
 * @param  {String} filename The file name
 */
async function handleNotifications(mediaUrl) {
  const options = {
    method: 'POST',
    uri: slackInfo.webhookURL,
    body: {
      channel: '#dso-bagels',
      icon_emoji: ':bagel:',
      username: 'Bagel.Bot',
      mrkdwn: true,
      text: `Yes, hello. I've sent <${mediaUrl}|this week's order>.`
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

    const filename = `bagel-${Date.now()}.pdf`;
    const dir = '/www/cmsprod/shared/assets/media/files/dso-bagels';
    const destination = join(dir, filename);

    doc.on('end', () => sendFax(filename));
    doc.pipe(createWriteStream(destination));

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
