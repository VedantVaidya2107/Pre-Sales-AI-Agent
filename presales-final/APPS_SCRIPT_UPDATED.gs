// ═══════════════════════════════════════════════════════════
//  Fristine Presales — Google Apps Script (REPLACE ALL)
//  Handles: Email sending, Event tracking, Proposal storage
// ═══════════════════════════════════════════════════════════

const SHEET_ID = "1U-kaTF-TEAd835RQVnZd4aCH5c9Wx9PVrzsENaJRtog";
const TRACKING_TAB = "tracking";
const PROPOSALS_TAB = "proposals";

// ── GET requests (read data) ──────────────────────────────
function doGet(e) {
  const action = e.parameter.action;
  const clientId = e.parameter.client_id;

  try {
    if (action === "get_tracking" && clientId) {
      return getTracking(clientId);
    }
    if (action === "get_proposal" && clientId) {
      return getProposal(clientId);
    }
    return jsonResponse({ error: "Unknown action" });
  } catch(err) {
    return jsonResponse({ error: err.toString() });
  }
}

// ── POST requests (write data) ───────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === "log_event") {
      return logEvent(body.client_id, body.event, body.timestamp);
    }
    if (action === "send_email") {
      return sendBotEmail(body.to, body.company, body.client_id, body.bot_url);
    }
    if (action === "save_proposal") {
      return saveProposal(body.client_id, body.proposal_html, body.timestamp);
    }

    return jsonResponse({ error: "Unknown action: " + action });
  } catch(err) {
    return jsonResponse({ error: err.toString() });
  }
}

// ── Log a tracking event ─────────────────────────────────
function logEvent(clientId, event, timestamp) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(TRACKING_TAB);

  if (!sheet) {
    sheet = ss.insertSheet(TRACKING_TAB);
    sheet.appendRow(["client_id", "event", "timestamp"]);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
  }

  const ts = timestamp || new Date().toISOString();
  sheet.appendRow([clientId, event, ts]);
  return jsonResponse({ success: true, client_id: clientId, event: event });
}

// ── Get all tracking events for a client ─────────────────
function getTracking(clientId) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(TRACKING_TAB);

  if (!sheet) return jsonResponse([]);

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return jsonResponse([]);

  const events = rows.slice(1)
    .filter(row => String(row[0]).trim() === String(clientId).trim())
    .map(row => ({
      client_id: row[0],
      event: row[1],
      timestamp: row[2]
    }));

  return jsonResponse(events);
}

// ── Save proposal HTML ────────────────────────────────────
function saveProposal(clientId, proposalHtml, timestamp) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(PROPOSALS_TAB);

  if (!sheet) {
    sheet = ss.insertSheet(PROPOSALS_TAB);
    sheet.appendRow(["client_id", "timestamp", "proposal_html"]);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
  }

  // Check if proposal already exists for this client — update it
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(clientId).trim()) {
      sheet.getRange(i + 1, 2).setValue(timestamp || new Date().toISOString());
      sheet.getRange(i + 1, 3).setValue(proposalHtml);
      return jsonResponse({ success: true, updated: true });
    }
  }

  // New entry
  sheet.appendRow([clientId, timestamp || new Date().toISOString(), proposalHtml]);
  return jsonResponse({ success: true, updated: false });
}

// ── Get proposal HTML for a client ───────────────────────
function getProposal(clientId) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(PROPOSALS_TAB);

  if (!sheet) return jsonResponse({ proposal_html: null });

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(clientId).trim()) {
      return jsonResponse({ proposal_html: rows[i][2], timestamp: rows[i][1] });
    }
  }

  return jsonResponse({ proposal_html: null });
}

// ── Send email via Gmail ──────────────────────────────────
function sendBotEmail(to, company, clientId, botUrl) {
  if (!to || !botUrl) {
    return jsonResponse({ success: false, error: "Missing to or botUrl" });
  }

  const subject = `Your Zoho Discovery Agent is Ready — ${company}`;
  const htmlBody = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #F0F4FB; padding: 32px 20px;">
      <div style="background: linear-gradient(145deg, #0B1120, #0D3AB5); border-radius: 16px; padding: 40px 36px; text-align: center; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; background: #2B72F5; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 16px;">F</div>
        <h1 style="color: #fff; font-size: 24px; margin: 0 0 8px; font-weight: 800;">Your Zoho Discovery Agent<br/>is Ready</h1>
        <p style="color: rgba(255,255,255,0.6); margin: 0; font-size: 14px;">Fristine Infotech · Premium Zoho Partner</p>
      </div>

      <div style="background: #fff; border-radius: 16px; padding: 32px 36px; margin-bottom: 16px; box-shadow: 0 4px 24px rgba(26,79,214,0.08);">
        <p style="color: #1A2540; font-size: 16px; margin: 0 0 16px;">Hi <strong>${company} Team</strong>,</p>
        <p style="color: #4F6282; font-size: 14px; line-height: 1.7; margin: 0 0 24px;">
          We've set up a <strong>personalized Zoho Discovery Session</strong> for your organization.
          Our AI-powered agent will guide you through a strategic consultation to understand your
          business needs and prepare a tailored Zoho implementation proposal.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${botUrl}" style="display: inline-block; background: linear-gradient(135deg, #1A4FD6, #2B72F5); color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 12px; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
            🚀 Start My Discovery Session →
          </a>
        </div>

        <p style="color: #7A91B3; font-size: 12px; text-align: center; margin: 0;">
          Or copy this link: <a href="${botUrl}" style="color: #2B72F5;">${botUrl}</a>
        </p>
      </div>

      <p style="color: #7A91B3; font-size: 12px; text-align: center; margin: 0;">
        This session was prepared by Fristine Infotech Pre-Sales Team · Confidential
      </p>
    </div>
  `;

  try {
    GmailApp.sendEmail(to, subject, `Hi ${company} Team,\n\nYour Zoho Discovery Agent is ready.\n\nStart your session here: ${botUrl}\n\nBest regards,\nFristine Infotech Pre-Sales Team`, {
      htmlBody: htmlBody,
      name: "Fristine Infotech Pre-Sales"
    });

    // Also log the bot_sent event automatically
    logEvent(clientId, "bot_sent", new Date().toISOString());

    return jsonResponse({ success: true, sent_to: to });
  } catch(err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ── Helper: return JSON response ─────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
