/**
 * Christmas Potluck — backend (Google Apps Script bound to a Google Sheet)
 *
 * Setup / update:
 *  1. In the Sheet: Extensions > Apps Script. Replace all code with this file, Save.
 *  2. Set the host password (once): Project Settings (gear icon) > Script Properties >
 *     Add script property:  ADMIN_KEY = <a password you choose>. Save.
 *  3. Deploy > Manage deployments > pencil > Version: "New version" > Deploy.
 *     (Who has access must stay "Anyone"; execute as "Me".) Google will ask you to
 *     authorize again because the script now sends email from your Gmail.
 *
 * Invitations are sent from your Gmail (limit ~100 per day) and logged in an "Invites" tab.
 * You can delete or edit any row directly in the Sheet to moderate.
 */

const SHEET = 'Dishes';
const HEAD = ['id', 'ts', 'name', 'cat', 'dish', 'serves', 'token'];
const INV_SHEET = 'Invites';
const INV_HEAD = ['email', 'first_sent', 'last_sent', 'count'];
const CATS = ['app', 'main', 'des'];
const PARTY_DATE = 'Christmas Eve, Thursday December 24';

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

function invSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(INV_SHEET);
  if (!sh) {
    sh = ss.insertSheet(INV_SHEET);
    sh.appendRow(INV_HEAD);
    sh.setFrozenRows(1);
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

function esc_(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function isAdmin_(key) {
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  return !!real && !!key && String(key) === real;
}

function list_() {
  const rows = sheet_().getDataRange().getValues().slice(1);
  return rows
    .filter(r => r[0] && r[4])
    .map(r => ({
      id: String(r[0]), ts: Number(r[1]) || 0,
      name: String(r[2]).replace(/^'/, ''),
      cat: CATS.indexOf(r[3]) >= 0 ? r[3] : 'app',
      dish: String(r[4]).replace(/^'/, '')
    }));
}

function invites_() {
  return invSheet_().getDataRange().getValues().slice(1)
    .filter(r => r[0])
    .map(r => ({ email: String(r[0]), ts: new Date(r[2] || r[1]).getTime() || 0, count: Number(r[3]) || 1 }));
}

function inviteHtml_(site, note) {
  const noteHtml = note
    ? '<p style="margin:0 0 20px;padding:14px 16px;background:#fbf1dc;border-radius:10px;color:#5a4410;white-space:pre-wrap">' + esc_(note) + '</p>'
    : '';
  return '' +
    '<div style="background:#fbf6ee;padding:28px 12px;font-family:Helvetica,Arial,sans-serif;color:#2a2420">' +
    '<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #eadfd1;border-radius:16px;padding:28px;text-align:center">' +
    '<div style="color:#b7861f;font-size:20px;letter-spacing:8px">❄ ✦ ❄</div>' +
    '<h1 style="font-family:Georgia,serif;color:#b3261e;font-size:30px;margin:8px 0 4px">Christmas Potluck</h1>' +
    '<p style="color:#1f6b45;font-family:Georgia,serif;font-size:18px;margin:0 0 18px">' + PARTY_DATE + '</p>' +
    '<p style="margin:0 0 20px;line-height:1.5">You\'re invited! Everyone brings a dish — an appetizer, a main or a dessert. ' +
    'Please add yours to the list so we don\'t all bring the same thing.</p>' +
    noteHtml +
    '<a href="' + esc_(site) + '" style="display:inline-block;background:#b3261e;color:#fff;text-decoration:none;font-weight:bold;padding:13px 26px;border-radius:10px">Add my dish</a>' +
    '<p style="color:#7a6f66;font-size:12px;margin:22px 0 0">' + esc_(site) + '</p>' +
    '</div></div>';
}

function doGet() {
  return json_({ ok: true, items: list_() });
}

// Run this once from the editor (select "authorize", click Run) to grant the email permission.
function authorize() {
  Logger.log('Emails left today: ' + MailApp.getRemainingDailyQuota());
}

function doPost(e) {
  try {
    return handlePost_(e);
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function handlePost_(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }

  // Host-only actions
  if (body.action === 'invites' || body.action === 'invite') {
    if (!PropertiesService.getScriptProperties().getProperty('ADMIN_KEY')) return json_({ ok: false, error: 'no_admin_key' });
    if (!isAdmin_(body.adminKey)) return json_({ ok: false, error: 'unauthorized' });
    if (body.action === 'invites') return json_({ ok: true, invites: invites_() });
    return sendInvites_(body);
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();

    if (body.action === 'add') {
      const name = clean_(body.name, 40), dish = clean_(body.dish, 80);
      const cat = CATS.indexOf(body.cat) >= 0 ? body.cat : 'app';
      if (!name || !dish) return json_({ ok: false, error: 'missing' });
      if (sh.getLastRow() > 500) return json_({ ok: false, error: 'full' });
      const id = Utilities.getUuid().slice(0, 8);
      const token = Utilities.getUuid();
      sh.appendRow([id, Date.now(), name, cat, dish, '', token]);
      return json_({ ok: true, id: id, token: token, items: list_() });
    }

    if (body.action === 'remove') {
      const admin = isAdmin_(body.adminKey);
      const data = sh.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(body.id) && (admin || String(data[i][6]) === String(body.token))) {
          sh.deleteRow(i + 1);
          return json_({ ok: true, items: list_() });
        }
      }
      return json_({ ok: false, error: 'not_found', items: list_() });
    }

    return json_({ ok: false, error: 'unknown_action' });
  } finally {
    lock.releaseLock();
  }
}

function sendInvites_(body) {
  const site = String(body.site || '');
  if (!/^https:\/\/[^\s"'<>]+$/.test(site)) return json_({ ok: false, error: 'bad_site' });
  const note = String(body.note || '').slice(0, 600);
  const emails = (Array.isArray(body.emails) ? body.emails : [])
    .map(s => String(s).trim().toLowerCase())
    .filter(s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s))
    .slice(0, 50);
  if (!emails.length) return json_({ ok: false, error: 'no_emails' });
  if (MailApp.getRemainingDailyQuota() < emails.length) return json_({ ok: false, error: 'quota' });

  const html = inviteHtml_(site, note);
  const plain = "You're invited to our Christmas Potluck on " + PARTY_DATE + "!\n" +
    (note ? '\n' + note + '\n' : '') +
    '\nPlease add the dish you\'ll bring here: ' + site + '\n';

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = invSheet_();
    const data = sh.getDataRange().getValues();
    const rowOf = {};
    for (let i = 1; i < data.length; i++) rowOf[String(data[i][0]).toLowerCase()] = i + 1;

    let sent = 0; const failed = [];
    const now = new Date();
    emails.forEach(email => {
      try {
        MailApp.sendEmail({ to: email, subject: '🎄 Christmas Potluck — ' + PARTY_DATE, body: plain, htmlBody: html, name: 'Christmas Potluck' });
        sent++;
        if (rowOf[email]) {
          const r = rowOf[email];
          sh.getRange(r, 3, 1, 2).setValues([[now, (Number(sh.getRange(r, 4).getValue()) || 1) + 1]]);
        } else {
          sh.appendRow([email, now, now, 1]);
          rowOf[email] = sh.getLastRow();
        }
      } catch (err) {
        failed.push(email);
      }
    });
    return json_({ ok: true, sent: sent, failed: failed, invites: invites_() });
  } finally {
    lock.releaseLock();
  }
}
