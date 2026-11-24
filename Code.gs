/**
 * Christmas Potluck — backend (Google Apps Script bound to a Google Sheet)
 *
 * Setup:
 *  1. Create a new Google Sheet (any name). The script creates a "Dishes" tab itself.
 *  2. Extensions > Apps Script. Delete the sample code, paste this whole file, Save.
 *  3. Deploy > New deployment > type "Web app"
 *       Execute as:      Me
 *       Who has access:  Anyone
 *     Click Deploy, authorize, and copy the Web app URL (ends in /exec).
 *  4. Paste that URL into API_URL at the top of index.html.
 *
 * You can delete or edit any row directly in the Sheet to moderate.
 */

const SHEET = 'Dishes';
const HEAD = ['id', 'ts', 'name', 'cat', 'dish', 'serves', 'token'];
const CATS = ['app', 'main', 'des'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
    sh.hideColumns(7); // token column
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Strip spreadsheet formula triggers and trim length
function clean_(v, max) {
  let s = String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function list_() {
  const rows = sheet_().getDataRange().getValues().slice(1);
  return rows
    .filter(r => r[0] && r[4])
    .map(r => ({
      id: String(r[0]), ts: Number(r[1]) || 0,
      name: String(r[2]).replace(/^'/, ''),
      cat: CATS.indexOf(r[3]) >= 0 ? r[3] : 'app',
      dish: String(r[4]).replace(/^'/, ''),
      serves: Number(r[5]) || null
    }));
}

function doGet() {
  return json_({ ok: true, items: list_() });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();

    if (body.action === 'add') {
      const name = clean_(body.name, 40), dish = clean_(body.dish, 80);
      const cat = CATS.indexOf(body.cat) >= 0 ? body.cat : 'app';
      const serves = Math.max(0, Math.min(99, parseInt(body.serves, 10) || 0)) || '';
      if (!name || !dish) return json_({ ok: false, error: 'missing' });
      if (sh.getLastRow() > 500) return json_({ ok: false, error: 'full' });
      const id = Utilities.getUuid().slice(0, 8);
      const token = Utilities.getUuid();
      sh.appendRow([id, Date.now(), name, cat, dish, serves, token]);
      return json_({ ok: true, id: id, token: token, items: list_() });
    }

    if (body.action === 'remove') {
      const data = sh.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(body.id) && String(data[i][6]) === String(body.token)) {
          sh.deleteRow(i + 1);
          return json_({ ok: true, items: list_() });
        }
      }
      return json_({ ok: false, error: 'not_found' });
    }

    return json_({ ok: false, error: 'unknown_action' });
  } finally {
    lock.releaseLock();
  }
}
