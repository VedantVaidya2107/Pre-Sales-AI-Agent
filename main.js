import './style.css';
import { parseCSV, parseClientCSV } from './src/services/csv-service.js';
import { gem, safeJ } from './src/services/gemini.js';
import { uploadFileToDrive } from './src/services/google-drive.js';
import mammoth from 'mammoth';

/* ══════════════════════════════════════════════
   CONFIG — Update APPS_SCRIPT_URL after deploying
   your Google Apps Script Web App
══════════════════════════════════════════════ */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzeQkhQclsvGDQfMVcKxRx3ngabIr7igGKZhkTG9oW20pm4D7wosLx1mQvZvNdOX1xyNA/exec";
const CLIENT_SHEET_ID = "1U-kaTF-TEAd835RQVnZd4aCH5c9Wx9PVrzsENaJRtog";
const DEPLOY_URL = "https://vedantvaidya2107.github.io/Pre-Sales-AI-Agent/";

/* ══ STATE ══ */
let staffClients = [];
let manualLeads = JSON.parse(localStorage.getItem('f_manual_leads') || '[]');
let cli = null, prof = null, convo = [], reqs = null, sol = null;
let phase = "login", rn = 0, discoveryComplete = false;
let pendingBlob = null, pendingName = '', fileContent = '';
let currentTrackingClient = null;
let activeClientId = null;

/* ══ ZOHO KNOWLEDGE BASE ══ */
const ZK = `You are a high-performing Senior Presales Solutions Architect at Fristine Infotech (India's leading Premium Zoho Partner, 10 years experience, 200+ implementations).

YOUR COMPANY — FRISTINE INFOTECH:
- India's leading Premium Zoho Partner
- Awards: Zoho Creator Partner Award 2021 — Innovator of the Year & Regional Champion (ANZ)
- Key clients: eBay, Pepperfry, Edelweiss, YES Securities, Mahindra Solarize, NPCI, Jio, Suzlon, Mercedes-Benz, Samsonite, TATA MD, CARE Ratings, CRISIL, TeamLease, Transasia

YOUR MISSION:
Conduct a strategic discovery session. Move beyond "features" and uncover "business value". Use the MEDDPICC framework to guide your questioning without being overly formal.

ZOHO PRODUCTS:
• Zoho CRM — Sales pipeline, leads, deals, territory mgmt. Plans: Standard $14, Professional $23, Enterprise $40, Ultimate $52/user/month
• Zoho Books — Accounting, GST/VAT, invoicing. Plans: Free, Standard $15, Professional $40/org/month
• Zoho Desk — Ticketing, SLA, multi-channel. Plans: Free, Standard $14, Professional $23, Enterprise $40/agent/month
• Zoho Projects — Gantt, tasks, timesheets. Plans: Free, Premium $4, Enterprise $9/user/month
• Zoho Inventory — Stock, orders, multi-warehouse. Plans: Standard $39, Professional $99/org/month
• Zoho People — HR, attendance, leave, payroll. Plans: Free, Essential $1.25, Professional $2, Premium $3/user/month
• Zoho Analytics — BI dashboards, data blending. Plans: Basic $22, Standard $45, Premium $112/month
• Zoho Campaigns — Email marketing. Plans: Free, Standard $3, Professional $4.5/month
• Zoho Sign — e-Signatures. Plans: Standard $10, Professional $20/month
• Zoho Creator — Low-code apps, custom modules. Plans: Starter $8, Professional $20/user/month
• Zoho Flow — Cross-app automation, 800+ connectors. Plans: Free, Standard $10, Professional $25/month
• Zoho One — ALL 45+ apps. $37/user/month (all employees) or $90 flexible
• Zoho Bigin — Simple pipeline CRM. Plans: Express $7, Premier $12/user/month

FRISTINE PROPOSAL FORMAT (use when generating proposals):
Every proposal must follow this structure:
1. COVER PAGE: Company name, date, Created By (Fristine Presales)
2. ABOUT FRISTINE INFOTECH: Standard intro + awards + client logos mention
3. PROPOSAL / SCOPE OF WORK: Table with columns: Requirement | Status | User Persona | Fristine Remark
   - Status options: "Requirement Analysis", "Configuration / Customization", "Customization", "Time & Material"
   - Group by: [Product Name], then Integrations, then Training/UAT
4. PROJECT TEAM: Table with Sr.no | Role | Role Description (CTO, PM, Sr BA, Jr BA, Sr Developer, QA)
5. PROJECT PLAN: Gantt-style timeline with phases
6. ESCALATION PROCESS: 3-level table (Sr BA → CTO → CEO with response times)
7. PROJECT GOVERNANCE & CHECKPOINTS: 9-step list
8. CONSTRAINTS & ASSUMPTIONS: Bullet points

CONSULTATION RULES:
1. BE WARM & HELPFUL: Start with a friendly, contextual greeting based on research. Then ask how you can help.
2. DYNAMIC KNOWLEDGE: Use research context when asked about the company or industry.
3. CONCISE & BULLETED: Limit responses to 3-4 sentences maximum.
4. CHALLENGE & PROBE: If answers are shallow or repetitive, ask a sharp, industry-specific follow-up.
5. MEDDPICC FOCUS: Uncover Pain and Metrics (success measurement).
6. PROFESSIONAL TONE: Authoritative yet helpful. No pricing talk.
7. JSON TRIGGER: After 4-6 meaningful exchanges, output REQUIREMENTS_COMPLETE followed by this EXACT JSON structure — fill every field as completely as possible:
{
  "business_overview": "2-3 sentence narrative describing the company's current operational challenges and what they're trying to achieve",
  "departments": ["Dept 1", "Dept 2"],
  "current_tools": ["Tool 1", "Tool 2"],
  "pain_points": ["Pain 1", "Pain 2"],
  "must_have": ["Requirement 1", "Requirement 2"],
  "nice_to_have": ["Nice 1", "Nice 2"],
  "automation_opportunities": ["Opportunity 1", "Opportunity 2"],
  "integrations": ["Integration 1", "Integration 2"],
  "success_metrics": ["Metric 1", "Metric 2"],
  "zoho_products": ["Zoho CRM", "Zoho Desk"],
  "user_count": 50,
  "industry": "Healthcare",
  "summary": "One sentence overall summary"
}`;

/* ══════════════════════════════════════════════
   BOOT — Check URL for ?client= param
══════════════════════════════════════════════ */
async function init() {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('client');

    if (clientId) {
        activeClientId = clientId;
        await bootClientSession(clientId);
    } else {
        await bootStaffLogin();
    }
}

async function bootStaffLogin() {
    showLdr('Connecting to secure vault…');
    try {
        const r = await fetch(`https://docs.google.com/spreadsheets/d/${CLIENT_SHEET_ID}/export?format=csv&gid=0`);
        const csv = await r.text();
        staffClients = parseClientCSV(csv);
        setSS('ok', `Connected · ${staffClients.length} clients loaded`);
    } catch (e) {
        setSS('er', 'Could not load client sheet — using manual leads only');
    }
    hideLdr();
}

async function bootClientSession(clientId) {
    showLdr('Loading your personalized session…');
    try {
        const r = await fetch(`https://docs.google.com/spreadsheets/d/${CLIENT_SHEET_ID}/export?format=csv&gid=0`);
        const csv = await r.text();
        staffClients = parseClientCSV(csv);
    } catch (e) {
        console.warn('Sheet load failed, checking manual leads');
    }
    hideLdr();

    const allClients = getAllClients();
    const found = allClients.find(c => (c.client_id || '').toLowerCase() === clientId.toLowerCase());

    if (found) {
        cli = found;
        await logEvent(clientId, 'bot_accessed');
        startSession();
    } else {
        document.getElementById('L').classList.remove('hidden');
        setSS('er', `Invalid session link. Please contact Fristine Infotech.`);
        document.getElementById('em').closest('.field').style.display = 'none';
        document.getElementById('pw').closest('.field').style.display = 'none';
        document.getElementById('loginBtn').style.display = 'none';
        hideLdr();
    }
}

/* ══════════════════════════════════════════════
   TRACKING — Apps Script + localStorage fallback
══════════════════════════════════════════════ */
async function logEvent(clientId, event) {
    const timestamp = new Date().toISOString();

    // POST to Apps Script (Google Sheet) — real source of truth across all devices
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'log_event', client_id: clientId, event, timestamp })
        });
    } catch (e) {
        console.warn('[Tracking] POST failed:', e);
    }

    // Cache locally for instant UI feedback
    const key = `tracking_${clientId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    if (!existing.find(ev => ev.event === event)) {
        existing.push({ client_id: clientId, event, timestamp });
        localStorage.setItem(key, JSON.stringify(existing));
    }
}

async function getTrackingEvents(clientId) {
    // Always start with localStorage events (instant, works offline)
    const localRaw = JSON.parse(localStorage.getItem(`tracking_${clientId}`) || '[]');
    const localMap = {};
    localRaw.forEach(e => { localMap[e.event] = e; });

    // Try to fetch from Apps Script sheet (authoritative cross-device source)
    try {
        const r = await fetch(`${APPS_SCRIPT_URL}?action=get_tracking&client_id=${encodeURIComponent(clientId)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'text/plain' }
        });
        if (r.ok) {
            const remoteEvents = await r.json();
            if (Array.isArray(remoteEvents) && remoteEvents.length > 0) {
                // Merge: remote is authoritative; fill in any missing local events
                const remoteMap = {};
                remoteEvents.forEach(e => { remoteMap[e.event] = e; });
                // Add local events not in remote yet (might have been logged before sheet write)
                Object.values(localMap).forEach(le => {
                    if (!remoteMap[le.event]) remoteMap[le.event] = le;
                });
                const merged = Object.values(remoteMap).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                localStorage.setItem(`tracking_${clientId}`, JSON.stringify(merged));
                return merged;
            }
        }
    } catch (e) {
        console.warn('[Tracking] Sheet fetch failed, using localStorage:', e.message);
    }

    // Return localStorage events as fallback (already sorted by insertion order)
    return localRaw.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}


/* ══════════════════════════════════════════════
   AUTH — Presales-only login with per-user passwords
   Storage key: f_pw_<email-hash>
   First-time: no stored password → show Set Password screen
   Forgot: user picks new password for their email
══════════════════════════════════════════════ */
function pwKey(email) { return 'f_pw_' + email.toLowerCase().replace(/[^a-z0-9]/g, '_'); }
function getStoredPw(email) { return localStorage.getItem(pwKey(email)); }
function setStoredPw(email, pw) { localStorage.setItem(pwKey(email), pw); }

function setSS(type, txt) {
    const el = document.getElementById('ss'), t = document.getElementById('stxt');
    el.className = 'ss ' + type;
    t.textContent = txt;
}

document.getElementById('loginBtn').addEventListener('click', () => {
    const em = document.getElementById('em').value.trim().toLowerCase();
    const pw = document.getElementById('pw').value.trim();
    const err = document.getElementById('lerr');
    err.style.display = 'none';

    // Only @fristinetech.com emails allowed
    if (!em.endsWith('@fristinetech.com')) {
        err.textContent = 'Access restricted to @fristinetech.com presales accounts only.';
        err.style.display = 'block';
        return;
    }

    const stored = getStoredPw(em);

    // First-time login — no password set yet
    if (!stored) {
        document.getElementById('L').classList.add('hidden');
        document.getElementById('SP').classList.remove('hidden');
        document.getElementById('sp-email-show').textContent = `Setting up account for ${em}`;
        document.getElementById('SP').dataset.email = em;
        return;
    }

    // Returning login
    if (pw === stored) {
        startStaffPortal(em);
        return;
    }

    err.textContent = 'Incorrect password. Use "Forgot Password?" to reset.';
    err.style.display = 'block';
});

document.getElementById('pw').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
});

// Forgot Password link
document.getElementById('forgotLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('L').classList.add('hidden');
    document.getElementById('FP').classList.remove('hidden');
    document.getElementById('fp-form-wrap').style.display = '';
    document.getElementById('fp-success').style.display = 'none';
});

// Set Password screen (first time)
document.getElementById('setPwBtn').addEventListener('click', () => {
    const email = document.getElementById('SP').dataset.email;
    const pw1 = document.getElementById('sp-pw1').value.trim();
    const pw2 = document.getElementById('sp-pw2').value.trim();
    const err = document.getElementById('sp-err');
    err.style.display = 'none';

    if (pw1.length < 8) { err.textContent = 'Password must be at least 8 characters.'; err.style.display = 'block'; return; }
    if (pw1 !== pw2) { err.textContent = 'Passwords do not match.'; err.style.display = 'block'; return; }

    setStoredPw(email, pw1);
    document.getElementById('SP').classList.add('hidden');
    startStaffPortal(email);
});

// Reset Password screen (forgot)
document.getElementById('resetPwBtn').addEventListener('click', () => {
    const em = document.getElementById('fp-em').value.trim().toLowerCase();
    const pw1 = document.getElementById('fp-pw1').value.trim();
    const pw2 = document.getElementById('fp-pw2').value.trim();
    const err = document.getElementById('fp-err');
    err.style.display = 'none';

    if (!em.endsWith('@fristinetech.com')) { err.textContent = 'Must be a @fristinetech.com email.'; err.style.display = 'block'; return; }
    if (pw1.length < 8) { err.textContent = 'Password must be at least 8 characters.'; err.style.display = 'block'; return; }
    if (pw1 !== pw2) { err.textContent = 'Passwords do not match.'; err.style.display = 'block'; return; }

    setStoredPw(em, pw1);
    document.getElementById('fp-form-wrap').style.display = 'none';
    document.getElementById('fp-success').style.display = 'block';
});

document.getElementById('backToLoginFromFP')?.addEventListener('click', () => {
    document.getElementById('FP').classList.add('hidden');
    document.getElementById('L').classList.remove('hidden');
});

document.getElementById('backToLoginBtn2')?.addEventListener('click', () => {
    document.getElementById('FP').classList.add('hidden');
    document.getElementById('L').classList.remove('hidden');
});

/* ══════════════════════════════════════════════
   STAFF PORTAL — Client Dashboard
══════════════════════════════════════════════ */
function getAllClients() {
    const sheetIds = new Set(staffClients.map(c => c.client_id));
    const manual = manualLeads.filter(l => !sheetIds.has(l.client_id));
    return [...staffClients, ...manual];
}

async function startStaffPortal(email) {
    if (email) document.getElementById('agentChip').textContent = email.split('@')[0];
    document.getElementById('L').classList.add('hidden');
    document.getElementById('H').classList.remove('hidden');
    await renderClientTable();
}

async function renderClientTable() {
    const tbody = document.getElementById('clientTableBody');
    const allClients = getAllClients();

    document.getElementById('clientCount').textContent = `${allClients.length} clients in pipeline`;
    document.getElementById('statTotal').textContent = allClients.length;

    if (allClients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="tbl-loading">No clients found. Add leads manually or populate your Google Sheet.</td></tr>';
        document.getElementById('statSent').textContent = '0';
        document.getElementById('statActive').textContent = '0';
        document.getElementById('statProposal').textContent = '0';
        return;
    }

    tbody.innerHTML = '';
    let sentCount = 0, activeCount = 0, proposalCount = 0;

    for (const client of allClients) {
        const clientId = client.client_id || '';
        const events = JSON.parse(localStorage.getItem(`tracking_${clientId}`) || '[]');
        const status = getClientStatus(events);

        if (status.sent) sentCount++;
        if (status.active) activeCount++;
        if (status.proposal) proposalCount++;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="tbl-co-wrap">
                    <div class="tbl-co-ico">${(client.company || '?')[0].toUpperCase()}</div>
                    <div>
                        <div class="tbl-co-name">${client.company || '—'}</div>
                        <div class="tbl-co-id">${clientId || '—'}</div>
                    </div>
                </div>
            </td>
            <td><span class="tbl-industry">${client.industry || '—'}</span></td>
            <td><span class="tbl-email">${client.email || '—'}</span></td>
            <td>${renderStatusBadge(status)}</td>
            <td>
                <div class="tbl-actions">
                    <button class="btn-tbl-send" title="Send bot link to client">📨 Send Bot</button>
                    <button class="btn-tbl-track" title="View tracking dashboard">📊 Track</button>
                    <button class="btn-tbl-del" title="Remove lead">🗑</button>
                </div>
            </td>`;
        tbody.appendChild(tr);

        tr.querySelector('.btn-tbl-send').addEventListener('click', () => sendBotEmail(clientId));
        tr.querySelector('.btn-tbl-track').addEventListener('click', () => openTracking(clientId));
        tr.querySelector('.btn-tbl-del').addEventListener('click', () => deleteLead(clientId));
        tr.querySelector('.tbl-co-name').style.cursor = 'pointer';
        tr.querySelector('.tbl-co-name').addEventListener('click', () => openTracking(clientId));
    }

    document.getElementById('statSent').textContent = sentCount;
    document.getElementById('statActive').textContent = activeCount;
    document.getElementById('statProposal').textContent = proposalCount;
}

function getClientStatus(events) {
    const names = events.map(e => e.event);
    return {
        sent: names.includes('bot_sent'),
        accessed: names.includes('bot_accessed'),
        active: names.includes('conversation_started'),
        proposal: names.includes('proposal_generated'),
        submitted: names.includes('proposal_submitted')
    };
}

function renderStatusBadge(s) {
    if (s.submitted) return '<span class="badge badge-done">✅ Submitted</span>';
    if (s.proposal) return '<span class="badge badge-proposal">📄 Proposal Ready</span>';
    if (s.active) return '<span class="badge badge-active">💬 In Session</span>';
    if (s.accessed) return '<span class="badge badge-accessed">👁️ Accessed</span>';
    if (s.sent) return '<span class="badge badge-sent">📨 Sent</span>';
    return '<span class="badge badge-pending">⏳ Not Started</span>';
}

/* ══════════════════════════════════════════════
   SEND BOT EMAIL
══════════════════════════════════════════════ */
async function sendBotEmail(clientId) {
    const client = getAllClients().find(c => c.client_id === clientId);
    if (!client) return;

    const botUrl = `${DEPLOY_URL}/?client=${encodeURIComponent(clientId)}`;

    // Find the send button and show loading state
    const allBtns = document.querySelectorAll('.btn-tbl-send');
    let btn = null;
    allBtns.forEach(b => { if (b.closest('tr') && b.closest('tr').querySelector('.tbl-co-id') && b.closest('tr').querySelector('.tbl-co-id').textContent.includes(clientId)) btn = b; });
    if (btn) { btn.textContent = '⏳ Sending…'; btn.disabled = true; }

    try {
        // Send via Apps Script (uses Gmail under the hood)
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'send_email',
                to: client.email,
                company: client.company,
                client_id: clientId,
                bot_url: botUrl
            })
        });
        // Log the event
        await logEvent(clientId, 'bot_sent');
        if (btn) { btn.textContent = '✅ Sent!'; }
        setTimeout(() => renderClientTable(), 1200);
    } catch (e) {
        console.error('[Email] Send failed:', e);
        if (btn) { btn.textContent = '❌ Failed'; btn.disabled = false; }
        alert('Could not send email. Check Apps Script permissions.');
    }
}


/* ══════════════════════════════════════════════
   CLIENT TRACKING PAGE
══════════════════════════════════════════════ */
async function openTracking(clientId) {
    const client = getAllClients().find(c => c.client_id === clientId);
    if (!client) return;

    currentTrackingClient = client;
    document.getElementById('H').classList.add('hidden');
    document.getElementById('T').classList.remove('hidden');

    // Update header with client company name
    const nameSpan = document.getElementById('trackingClientName');
    if (nameSpan) nameSpan.textContent = client.company || 'Client';

    document.getElementById('tClientIco').textContent = (client.company || '?')[0].toUpperCase();
    document.getElementById('tClientName').textContent = client.company || '—';
    document.getElementById('tClientMeta').textContent = `${client.industry || '—'} · ${client.email || '—'}`;
    document.getElementById('tClientId').textContent = `Client ID: ${clientId}`;

    showLdr('Loading tracking data…');
    const events = await getTrackingEvents(clientId);
    hideLdr();

    renderPipeline(events);
    renderEventLog(events);

    // Check for proposal — from sheet, localStorage, or any event
    const proposalHtml = localStorage.getItem(`proposal_${clientId}`);
    const hasProposalEvent = events.find(e => e.event === 'proposal_generated' || e.event === 'proposal_submitted');
    document.getElementById('proposalSection').style.display =
        (proposalHtml || hasProposalEvent) ? 'block' : 'none';

    // Show uploaded files for this client
    renderClientFiles(clientId);

    document.getElementById('resendBotBtn').onclick = () => sendBotEmail(clientId);

    document.getElementById('copyLinkBtn').onclick = () => {
        const url = `${DEPLOY_URL}/?client=${encodeURIComponent(clientId)}`;
        navigator.clipboard.writeText(url).then(() => {
            document.getElementById('copyLinkBtn').textContent = '✅ Copied!';
            setTimeout(() => { document.getElementById('copyLinkBtn').textContent = '🔗 Copy Link'; }, 2000);
        });
    };

    document.getElementById('viewProposalBtn').onclick = async () => {
        let html = localStorage.getItem(`proposal_${clientId}`);
        if (!html) {
            showLdr('Fetching proposal…');
            try {
                const r = await fetch(`${APPS_SCRIPT_URL}?action=get_proposal&client_id=${encodeURIComponent(clientId)}`);
                const data = await r.json();
                if (data && data.proposal_html) {
                    html = data.proposal_html;
                    localStorage.setItem(`proposal_${clientId}`, html);
                }
            } catch (e) { console.warn('Proposal fetch failed:', e); }
            hideLdr();
        }
        if (html) {
            document.getElementById('proposalIframe').srcdoc = html;
            openModal('proposalModal');
        } else {
            alert('Proposal not found. The client may not have completed the session yet.');
        }
    };

    document.getElementById('markSentBtn').onclick = async () => {
        await logEvent(clientId, 'proposal_submitted');
        const events2 = await getTrackingEvents(clientId);
        renderPipeline(events2);
        renderEventLog(events2);
        document.getElementById('markSentBtn').textContent = '✅ Marked as Submitted';
        document.getElementById('markSentBtn').disabled = true;
    };
}

function renderPipeline(events) {
    const eventMap = {};
    events.forEach(e => { if (!eventMap[e.event]) eventMap[e.event] = e.timestamp; });

    const stages = [
        { key: 'bot_sent', id: 0 },
        { key: 'bot_accessed', id: 1 },
        { key: 'conversation_started', id: 2 },
        { key: 'proposal_generated', id: 3 },
        { key: 'proposal_submitted', id: 4 }
    ];

    stages.forEach(({ key, id }) => {
        const el = document.getElementById(`ps${id}`);
        const timeEl = document.getElementById(`pt${id}`);
        const statusEl = document.getElementById(`pst${id}`);

        if (eventMap[key]) {
            el.classList.add('done');
            statusEl.className = 'pipe-status done';
            statusEl.textContent = '✅ Done';
            timeEl.textContent = formatTime(eventMap[key]);
        } else {
            el.classList.remove('done');
            statusEl.className = 'pipe-status pending';
            statusEl.textContent = 'Pending';
            timeEl.textContent = '—';
        }
    });
}

function renderEventLog(events) {
    const log = document.getElementById('eventLog');
    if (!events.length) {
        log.innerHTML = '<div class="event-empty">No activity recorded yet.</div>';
        return;
    }
    const labels = {
        'bot_sent': '📨 Bot link sent to client',
        'bot_accessed': '👁️ Client accessed the bot',
        'conversation_started': '💬 Client initiated a conversation',
        'proposal_generated': '📄 Proposal was generated by client',
        'proposal_submitted': '✅ Proposal submitted to presales agent'
    };
    log.innerHTML = [...events].reverse().map(e => `
        <div class="event-row">
            <div class="event-icon">${(labels[e.event] || e.event).split(' ')[0]}</div>
            <div class="event-desc">${labels[e.event] || e.event}</div>
            <div class="event-time">${formatTime(e.timestamp)}</div>
        </div>`).join('');
}

function formatTime(ts) {
    try {
        return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return ts || '—'; }
}

/* ══════════════════════════════════════════════
   LEAD MANAGEMENT
══════════════════════════════════════════════ */
function deleteLead(clientId) {
    const client = getAllClients().find(c => c.client_id === clientId);
    const isManual = manualLeads.find(l => l.client_id === clientId);
    if (!isManual) {
        alert('This client comes from your Google Sheet and cannot be deleted here. Remove them from the sheet instead.');
        return;
    }
    if (!confirm(`Delete lead "${client?.company}"?`)) return;
    manualLeads = manualLeads.filter(l => l.client_id !== clientId);
    localStorage.setItem('f_manual_leads', JSON.stringify(manualLeads));
    renderClientTable();
}

document.getElementById('openCreateBtn').addEventListener('click', async () => {
    // Try to get the authoritative next ID from the sheet (so multiple agents stay in sync)
    const preview = document.getElementById('nl-id-preview');
    preview.textContent = generateClientId(); // instant local estimate
    openModal('createLeadModal');
    try {
        const r = await fetch(`${APPS_SCRIPT_URL}?action=get_next_client_id`);
        const d = await r.json();
        if (d && d.next_id) preview.textContent = d.next_id;
    } catch (e) {
        console.warn('[ID] Could not fetch from sheet, using local estimate');
    }
});
document.getElementById('closeCreateBtn').addEventListener('click', () => {
    closeModal('createLeadModal');
    ['nl-co', 'nl-ind', 'nl-em'].forEach(fid => { document.getElementById(fid).value = ''; });
    const p = document.getElementById('nl-id-preview'); if (p) p.textContent = '—';
});

function generateClientId() {
    // Local estimate from in-memory clients (used as instant fallback)
    const allClients = getAllClients();
    const existing = allClients
        .map(c => c.client_id || '')
        .filter(id => /^FRIST\d{3,}$/.test(id))
        .map(id => parseInt(id.replace('FRIST', ''), 10))
        .filter(n => !isNaN(n));
    const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
    return 'FRIST' + String(next).padStart(3, '0');
}

// Called by oninput on company name field for live preview (keeps estimate current)
window.previewClientId = function () {
    const preview = document.getElementById('nl-id-preview');
    if (preview && preview.textContent === '—') preview.textContent = generateClientId();
};

document.getElementById('saveLeadBtn').addEventListener('click', async () => {
    const co = document.getElementById('nl-co').value.trim();
    const ind = document.getElementById('nl-ind').value.trim();
    const em = document.getElementById('nl-em').value.trim();
    const previewEl = document.getElementById('nl-id-preview');

    if (!co || !em) { alert('Company name and email are required.'); return; }

    // Use whatever ID is shown in the preview (sheet-authoritative if fetch succeeded)
    const id = previewEl?.textContent?.trim() || generateClientId();

    const btn = document.getElementById('saveLeadBtn');
    btn.textContent = '⏳ Saving…'; btn.disabled = true;

    // 1. Write to Google Sheet via Apps Script (makes the bot link work from any device)
    let savedToSheet = false;
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'add_client', client_id: id, company: co, industry: ind, email: em })
        });
        savedToSheet = true;
        console.log(`[Lead] Saved to Google Sheet: ${id} — ${co}`);
    } catch (e) {
        console.warn('[Lead] Sheet write failed, saving to localStorage only:', e);
    }

    // 2. Also save to localStorage so dashboard shows it immediately
    // If saved to sheet, it'll appear in staffClients on next reload;
    // for instant display this session, add to manualLeads as well
    manualLeads.push({ client_id: id, company: co, industry: ind, email: em });
    localStorage.setItem('f_manual_leads', JSON.stringify(manualLeads));

    btn.textContent = savedToSheet ? '✅ Saved!' : '⚠️ Saved locally';
    setTimeout(() => { btn.textContent = 'Create & Save'; btn.disabled = false; }, 1500);

    await renderClientTable();
    closeModal('createLeadModal');
    ['nl-co', 'nl-ind', 'nl-em'].forEach(fid => { document.getElementById(fid).value = ''; });
    if (previewEl) previewEl.textContent = '—';
});

/* ══════════════════════════════════════════════
   CLIENT BOT SESSION
══════════════════════════════════════════════ */
async function startSession() {
    document.getElementById('L').classList.add('hidden');
    document.getElementById('A').classList.remove('hidden');
    document.getElementById('topco').textContent = cli.company;
    document.getElementById('sbi').textContent = cli.industry || 'Detecting…';
    document.getElementById('sbs').textContent = cli.size || '—';

    // Try to restore session memory first
    const restored = activeClientId ? loadConversationMemory(activeClientId) : false;

    if (restored && convo.length > 0) {
        // Session was resumed — replay conversation history in chat feed
        setStg(0, 'done'); setStg(1, 'done');
        if (prof) renderSidebar();

        // Replay messages into the feed
        const feed = document.getElementById('feed');
        feed.innerHTML = ''; // clear default
        convo.forEach(msg => {
            if (msg.role === 'assistant') {
                addAg(msg.content);
            } else if (msg.role === 'user' && !msg.content.startsWith('[File uploaded:')) {
                addUs(msg.content);
            }
        });

        if (discoveryComplete && reqs) {
            // Already did discovery — show summary again
            setStg(2, 'done'); setStg(3, 'act');
            showReqSummary();
        } else {
            setStg(2, 'act'); setPhase('Discovery Phase: Requirements');
            addAg(`Welcome back! I remember our conversation. Where were we — would you like to continue?`);
        }
        return;
    }

    // Fresh session
    setStg(0, 'act'); setPhase('Investigating market footprint…');
    showLdr('Researching ' + cli.company + '…');
    try {
        const researchPrompt = `${ZK}\n\nResearch "${cli.company}". Industry: ${cli.industry}. Size: ${cli.size}. Notes: ${cli.notes || ''}\n\nReturn JSON: {"industries":["..."],"description":"...","pain_points":["..."],"tech":"...","zoho_fit":["..."],"user_est":{"CRM":10}}`;
        const res = await gem(researchPrompt, 1000, 0.3);
        prof = safeJ(res) || fallback();
        renderSidebar();
    } catch (e) {
        prof = fallback();
    }
    hideLdr();
    setStg(0, 'done');

    const inds = getInds();
    if (inds.length > 1) {
        setStg(1, 'act'); setPhase('Confirming Industry Focus…');
        askInd(inds);
    } else {
        prof.confirmed = inds[0] || cli.industry;
        setStg(1, 'done');
        beginGather();
    }
}

function renderSidebar() {
    document.getElementById('sbi').textContent = (prof.industries || [cli.industry]).join(' · ');
    document.getElementById('sbs').textContent = prof.size || cli.size || 'Medium';
    document.getElementById('sbt').textContent = prof.tech || 'High';
    updateCov(20);
}

function fallback() {
    return { industries: [cli.industry || 'Technology'], size: cli.size || 'Medium', pain_points: ['Process Optimization'], tech: 'Medium', zoho_fit: ['Zoho CRM'], confirmed: cli.industry };
}

function getInds() {
    let inds = prof.industries || [];
    if (!inds.length) inds = (cli.industry || '').split(',').map(s => s.trim()).filter(Boolean);
    return [...new Set(inds)];
}

function askInd(inds) {
    addAg(`Welcome! I've researched <strong>${cli.company}</strong>. Which specific sector should we optimize today?`, { inds });
}

async function beginGather() {
    setStg(2, 'act'); setPhase('Discovery Phase: Requirements'); phase = 'gather';
    if (activeClientId) await logEvent(activeClientId, 'conversation_started');
    showLdr('Tailoring consultation strategy…');
    try {
        const open = await nextQ(true);
        addAg(open);
        convo.push({ role: 'assistant', content: open });
    } catch (e) {
        addAg(`I'm ready to dive into your requirements. Based on our research into ${cli.company}, what are the high-priority business challenges you're looking to solve?`);
    }
    hideLdr();
}

async function nextQ(isOpen = false) {
    const sys = `${ZK}\n\nCURRENT CONTEXT:\n- Client: ${cli.company}\n- Internal Research: ${JSON.stringify(prof)}\n${fileContent ? `- Uploaded Doc Summary: ${fileContent}\n` : ''}- Discovery Round: ${rn}/6`;
    
    let p = sys;
    if (isOpen) {
        p += `\n\nTASK: Warm, professional opening. Reference your research into ${cli.company}. Ask a broad opening question about their goals for today.`;
    } else {
        p += `\n\nTASK: ${rn >= 5 ? 'Summarize requirements and output REQUIREMENTS_COMPLETE + JSON.' : 'Continue discovery. Ask a probe-seeking question to uncover pain or success metrics.'}`;
    }

    const forcePro = rn >= 5;
    return gem(p, 1000, 0.7, forcePro, convo);
}

/* ═══ File upload — handles text, PDF, images ═══ */
const fBtn = document.getElementById('fileBtn'), fIn = document.getElementById('fileIn');
if (fBtn && fIn) {
    fBtn.onclick = () => fIn.click();
    fIn.onchange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;

        const isImage = f.type.startsWith('image/');
        const isPDF = f.type === 'application/pdf';
        const isText = f.type.startsWith('text/') || f.name.match(/\.(txt|csv|json|md|docx|doc|xls|xlsx)$/i);

        showLdr(`Reading ${f.name}…`);
        addUs(`[Uploaded File: ${f.name}]`);

        // Store file metadata in session memory
        const fileMeta = { name: f.name, type: f.type, size: f.size, ts: Date.now() };

        try {
            if (isImage || isPDF) {
                // Read as base64 and send to Gemini vision
                const base64 = await new Promise((res, rej) => {
                    const reader = new FileReader();
                    reader.onload = ev => res(ev.target.result.split(',')[1]);
                    reader.onerror = rej;
                    reader.readAsDataURL(f);
                });

                // Use Gemini to extract text/requirements from the file
                const mimeType = isPDF ? 'application/pdf' : f.type;
                const extractionPrompt = `You are analyzing a file uploaded by a client during a Zoho presales session.
File: ${f.name}
Task: Extract ALL business requirements, pain points, current tools, departments, process flows, and any other information relevant to understanding what Zoho solutions they need.
Return a structured text summary of everything you find. Be comprehensive — include every detail.`;

                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyDnOmsfj0_uhXkjjFON0Ji3roF5VIZg-VM`;
                const body = {
                    contents: [{
                        parts: [
                            { inline_data: { mime_type: mimeType, data: base64 } },
                            { text: extractionPrompt }
                        ]
                    }],
                    generationConfig: { maxOutputTokens: 2000, temperature: 0.2 }
                };
                const r = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
                const d = await r.json();
                fileContent = d.candidates?.[0]?.content?.parts?.[0]?.text || `[File: ${f.name} - could not extract text]`;
            } else if (f.name.endsWith('.docx')) {
                // Parse DOCX via mammoth
                const arrayBuffer = await new Promise((res, rej) => {
                    const reader = new FileReader();
                    reader.onload = ev => res(ev.target.result);
                    reader.onerror = rej;
                    reader.readAsArrayBuffer(f);
                });
                const result = await mammoth.extractRawText({ arrayBuffer });
                fileContent = result.value;
                if (fileContent.length > 8000) fileContent = fileContent.slice(0, 8000) + '\n...[truncated]';
            } else {
                // Text-based file — read directly
                fileContent = await new Promise((res, rej) => {
                    const reader = new FileReader();
                    reader.onload = ev => res(ev.target.result);
                    reader.onerror = rej;
                    reader.readAsText(f);
                });
                // Truncate if very long
                if (fileContent.length > 8000) fileContent = fileContent.slice(0, 8000) + '\n...[truncated]';
            }

            // Save file to session memory (localStorage for this client)
            saveFileToMemory(activeClientId, fileMeta, fileContent);

            // Add to conversation so AI remembers the upload
            convo.push({ role: 'user', content: `[File uploaded: ${f.name}]\n\nFile contents:\n${fileContent}` });

            // Now ask AI to respond to the uploaded content intelligently
            hideLdr();
            showLdr('Analyzing your document…');
            rn++;
            const sys = `${ZK}\nRESEARCH CONTEXT for ${cli.company}:\n${JSON.stringify(prof)}\nRound: ${rn}/6\nHistory: ${JSON.stringify(convo.slice(-10))}`;
            const filePrompt = `${sys}

The client just uploaded a file: "${f.name}"

FILE CONTENTS:
${fileContent}

TASK: Acknowledge the file by name. Then, based on what you've extracted from this document:
1. Summarize the key requirements or pain points you found in 2-3 sentences
2. Ask ONE sharp follow-up question to clarify or deepen your understanding of their needs
3. If the file content alone is comprehensive enough (covers: current tools, pain points, departments, requirements, user count), then output REQUIREMENTS_COMPLETE followed by the full JSON.

Do NOT give a generic reply. Reference specific details from the file.`;

            const resp = await gem(filePrompt, 1500, 0.5, false);
            hideLdr();

            if (resp.includes('REQUIREMENTS_COMPLETE')) {
                const parts = resp.split('REQUIREMENTS_COMPLETE');
                if (parts[0].trim()) addAg(parts[0].trim());
                reqs = safeJ(parts[1]) || { summary: fileContent.slice(0, 200), must_have: ['Zoho Implementation'] };
                discoveryComplete = true;
                showReqSummary();
            } else {
                addAg(resp);
                convo.push({ role: 'assistant', content: resp });
            }

        } catch (err) {
            hideLdr();
            console.error('[File] Processing error details:', err.message, err.stack, err);
            addAg(`I've received your file <strong>${f.name}</strong>. Could you briefly summarize the key requirements or challenges it covers? I'll incorporate everything into our solution.`);
        }

        fIn.value = ''; // reset so same file can be re-uploaded
    };
}

// Save uploaded file metadata + content to localStorage for this client session
function saveFileToMemory(clientId, meta, content) {
    const key = `files_${clientId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    // Avoid duplicate by name
    const idx = existing.findIndex(f => f.name === meta.name);
    const entry = { ...meta, content: content.slice(0, 5000), ts: Date.now() };
    if (idx >= 0) existing[idx] = entry; else existing.push(entry);
    localStorage.setItem(key, JSON.stringify(existing));
}

// Render files panel in tracking page
function renderClientFiles(clientId) {
    const container = document.getElementById('clientFilesSection');
    if (!container) return;
    const files = JSON.parse(localStorage.getItem(`files_${clientId}`) || '[]');
    if (!files.length) { container.style.display = 'none'; return; }
    container.style.display = 'block';
    const list = container.querySelector('#filesList');
    if (!list) return;
    list.innerHTML = files.map(f => `
        <div class="file-row">
            <div class="file-icon">${f.type?.startsWith('image/') ? '🖼️' : f.type === 'application/pdf' ? '📄' : '📁'}</div>
            <div class="file-info">
                <div class="file-name">${f.name}</div>
                <div class="file-meta">${(f.size / 1024).toFixed(1)}KB · ${new Date(f.ts).toLocaleString()}</div>
            </div>
        </div>
    `).join('');
}

/* Send message */
document.getElementById('sendBtn').addEventListener('click', async () => {
    const inp = document.getElementById('msgIn');
    const msg = inp.value.trim();
    if (!msg || discoveryComplete) return;
    addUs(msg);
    convo.push({ role: 'user', content: msg });
    inp.value = '';
    rn++;
    updateCov(Math.min(95, 20 + rn * 20));
    showLdr('Thinking…');
    try {
        const resp = await nextQ();
        if (resp.includes('REQUIREMENTS_COMPLETE')) {
            const parts = resp.split('REQUIREMENTS_COMPLETE');
            if (parts[0].trim()) addAg(parts[0].trim());
            reqs = safeJ(parts[1]) || { summary: 'Requirement analysis complete', must_have: ['Zoho One Implementation'] };
            discoveryComplete = true;
            showReqSummary();
        } else {
            addAg(resp);
            convo.push({ role: 'assistant', content: resp });
        }
    } catch (e) {
        if (rn >= 5) {
            discoveryComplete = true;
            reqs = { summary: 'Discovery session concluded.', must_have: ['Zoho One Implementation'] };
            showReqSummary();
        } else {
            addAg("Could you clarify your current setup a bit more?");
        }
    }
    hideLdr();
});

document.getElementById('msgIn').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('sendBtn').click();
});

/* ══════════════════════════════════════════════
   MIC BUTTON — Web Speech API Voice Input
══════════════════════════════════════════════ */
(function initMic() {
    const micBtn = document.getElementById('micBtn');
    if (!micBtn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        // Browser doesn't support speech — show tooltip and disable
        micBtn.title = 'Voice input not supported in this browser. Try Chrome.';
        micBtn.style.opacity = '0.35';
        micBtn.style.cursor = 'not-allowed';
        micBtn.addEventListener('click', () => {
            alert('Voice input is not supported in this browser. Please use Google Chrome for voice input.');
        });
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Indian English as primary
    let isListening = false;
    let finalTranscript = '';

    // Visual states
    const setMicState = (state) => {
        micBtn.classList.remove('mic-idle', 'mic-listening', 'mic-processing');
        micBtn.classList.add(`mic-${state}`);
        micBtn.title = state === 'listening' ? 'Listening… click to stop' : 'Voice Input';
    };

    micBtn.addEventListener('click', () => {
        if (discoveryComplete) return;
        if (isListening) {
            // Manual stop should send IMMEDIATELY
            recognition.stop();
            const inp = document.getElementById('msgIn');
            setTimeout(() => {
                if (inp.value.trim()) document.getElementById('sendBtn').click();
            }, 100); 
            return;
        }
        finalTranscript = '';
        try {
            recognition.start();
        } catch (e) {
            console.warn('[Mic] Could not start:', e);
        }
    });

    recognition.onstart = () => {
        isListening = true;
        setMicState('listening');
        const inp = document.getElementById('msgIn');
        inp.placeholder = '🎤 Listening… speak now';
    };

    recognition.onresult = (e) => {
        let interim = '';
        finalTranscript = '';
        for (let i = 0; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
                finalTranscript += e.results[i][0].transcript;
            } else {
                interim += e.results[i][0].transcript;
            }
        }
        // Show live transcript in input box
        const inp = document.getElementById('msgIn');
        inp.value = finalTranscript || interim;
    };

    recognition.onend = () => {
        isListening = false;
        setMicState('idle');
        const inp = document.getElementById('msgIn');
        inp.placeholder = 'Type your response here...';

        if (finalTranscript.trim()) {
            inp.value = finalTranscript.trim();
            // Auto-send after a longer pause (2s) so user has time to review/breathe
            setTimeout(() => {
                // Only auto-send if we are NOT listening anymore (prevents double sends)
                if (!isListening && inp.value.trim()) {
                     document.getElementById('sendBtn').click();
                }
            }, 2000);
        } else {
            inp.value = '';
        }
    };

    recognition.onerror = (e) => {
        isListening = false;
        setMicState('idle');
        const inp = document.getElementById('msgIn');
        inp.placeholder = 'Type your response here...';
        inp.value = '';
        if (e.error === 'not-allowed') {
            alert('Microphone access was denied. Please allow microphone access in your browser settings and try again.');
        } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
            console.warn('[Mic] Error:', e.error);
        }
    };
})();

/* ══════════════════════════════════════════════
   CONVERSATION MEMORY — persist everything to localStorage
══════════════════════════════════════════════ */
function saveConversationMemory() {
    if (!activeClientId) return;
    const memKey = `session_${activeClientId}`;
    localStorage.setItem(memKey, JSON.stringify({
        convo,
        reqs,
        sol,
        prof,
        rn,
        fileContent: fileContent ? fileContent.slice(0, 4000) : '',
        discoveryComplete,
        ts: Date.now()
    }));
}

function loadConversationMemory(clientId) {
    const memKey = `session_${clientId}`;
    const saved = localStorage.getItem(memKey);
    if (!saved) return false;
    try {
        const m = JSON.parse(saved);
        // Only restore if session was recent (within 7 days)
        if (Date.now() - m.ts > 7 * 24 * 60 * 60 * 1000) return false;
        convo = m.convo || [];
        reqs = m.reqs || null;
        sol = m.sol || null;
        prof = m.prof || null;
        rn = m.rn || 0;
        fileContent = m.fileContent || '';
        discoveryComplete = m.discoveryComplete || false;
        return true;
    } catch (e) { return false; }
}

function showReqSummary() {
    if (!reqs) reqs = { summary: 'Ready to proceed with solution design.', must_have: [] };
    setStg(2, 'done'); setStg(3, 'act'); setPhase('Reviewing Requirements…');

    // Save to memory immediately
    saveConversationMemory();

    const company = cli?.company || 'Your Company';

    // Build rich summary card matching the format in image
    const makeChips = (arr, icon) => (arr || []).map(t => `<span class="req-chip">${icon} ${t}</span>`).join('');
    const makeList = (arr) => (arr || []).map(i => `<li>${i}</li>`).join('');

    const html = `
    <div class="reqcard-full">
      <div class="reqcard-intro">
        Here's a complete summary of everything we've captured in our conversation. 
        Please review carefully — if this accurately reflects your requirements, confirm and I'll generate 
        your formal proposal document and save it to the Fristine Infotech Drive folder. 
        If anything needs changing, let me know.
      </div>

      <div class="reqcard-box">
        <div class="reqcard-title">📋 Requirements Summary — ${company}</div>

        ${reqs.business_overview ? `
        <div class="reqs-section">
          <div class="reqs-label">BUSINESS OVERVIEW</div>
          <div class="reqs-text">${reqs.business_overview}</div>
        </div>` : ''}

        ${(reqs.departments || []).length ? `
        <div class="reqs-section">
          <div class="reqs-label">DEPARTMENTS / TEAMS</div>
          <div class="reqs-chips">${makeChips(reqs.departments, '🏢')}</div>
        </div>` : ''}

        ${(reqs.current_tools || []).length ? `
        <div class="reqs-section">
          <div class="reqs-label">CURRENT TOOLS</div>
          <div class="reqs-chips">${makeChips(reqs.current_tools, '🔧')}</div>
        </div>` : ''}

        ${(reqs.pain_points || []).length ? `
        <div class="reqs-section">
          <div class="reqs-label">PAIN POINTS</div>
          <ul class="reqs-list">${makeList(reqs.pain_points)}</ul>
        </div>` : ''}

        ${(reqs.must_have || []).length ? `
        <div class="reqs-section">
          <div class="reqs-label">MUST-HAVE REQUIREMENTS</div>
          <ul class="reqs-list">${makeList(reqs.must_have)}</ul>
        </div>` : ''}

        ${(reqs.nice_to_have || []).length ? `
        <div class="reqs-section">
          <div class="reqs-label">NICE TO HAVE</div>
          <ul class="reqs-list">${makeList(reqs.nice_to_have)}</ul>
        </div>` : ''}

        ${(reqs.automation_opportunities || []).length ? `
        <div class="reqs-section">
          <div class="reqs-label">AUTOMATION OPPORTUNITIES</div>
          <ul class="reqs-list">${makeList(reqs.automation_opportunities)}</ul>
        </div>` : ''}

        ${(reqs.integrations || []).length ? `
        <div class="reqs-section">
          <div class="reqs-label">INTEGRATION REQUIREMENTS</div>
          <ul class="reqs-list">${makeList(reqs.integrations)}</ul>
        </div>` : ''}

        ${(reqs.success_metrics || []).length ? `
        <div class="reqs-section">
          <div class="reqs-label">SUCCESS METRICS</div>
          <ul class="reqs-list">${makeList(reqs.success_metrics)}</ul>
        </div>` : ''}

        <div class="reqs-actions">
          <button class="reqs-btn-confirm" id="confirmProposal">✅ Requirements Confirmed — Generate Proposal</button>
          <button class="reqs-btn-clarify" id="clarifyBtn">✏️ Add / Clarify Something</button>
          <button class="reqs-btn-wrong" id="wrongBtn">❌ Something's Not Right</button>
        </div>
      </div>
    </div>`;

    addAg(html, { noEscape: true });

    // Wire up buttons
    setTimeout(() => {
        document.getElementById('confirmProposal')?.addEventListener('click', buildSolution);
        document.getElementById('clarifyBtn')?.addEventListener('click', () => {
            discoveryComplete = false;
            addAg("Of course! What would you like to add or clarify?");
            document.getElementById('msgIn').focus();
        });
        document.getElementById('wrongBtn')?.addEventListener('click', () => {
            discoveryComplete = false;
            reqs = null;
            addAg("No problem — let's go back and revisit. What didn't look right?");
            document.getElementById('msgIn').focus();
        });
    }, 100);
}

async function buildSolution() {
    setStg(3, 'done'); setStg(4, 'act'); setPhase('Architecting Proposal…');
    showLdr('Designing Solution…');
    const p = `${ZK}\nDesign Zoho solution for ${cli.company} based on: ${JSON.stringify(reqs)}\nReturn JSON with primary_products, implementation_phases, team_structure, and monthly_cost.`;
    const res = await gem(p, 2000, 0.4, true); // forcePro: solution design needs deep reasoning
    sol = safeJ(res);
    hideLdr();
    setStg(4, 'done');
    addAg("Your Zoho Transformation Roadmap is ready! Let's take a look.", { video: true });
    openModal('videoModal');
}

async function generateProposal() {
    showLdr('Generating Fristine Format Proposal…');
    const fname = `Zoho_Proposal_${(cli.company || 'Client').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const mustHaves = reqs.must_have || ['Zoho Implementation'];
    const zohoProducts = reqs.zoho_products || (sol?.primary_products) || ['Zoho CRM'];
    const userCount = reqs.user_count || '—';
    const industry = reqs.industry || cli.industry || '—';
    const integrations = reqs.integrations || [];

    // Build scope of work rows from must-haves
    const scopeRows = mustHaves.map((m, i) => `
        <tr>
            <td style="font-weight:500">${m}</td>
            <td><span class="badge-config">Configuration / Customization</span></td>
            <td>Admin / Business Team</td>
            <td>
                <ul style="margin:0;padding-left:16px;font-size:12.5px;color:#4F6282">
                    <li>Configure module as per requirements</li>
                    <li>Set up workflows, validations, and custom fields</li>
                    <li>Enable role-based visibility and reporting</li>
                </ul>
            </td>
        </tr>`).join('');

    const integrationRows = integrations.length ? integrations.map(intg => `
        <tr>
            <td style="font-weight:500">${intg}</td>
            <td><span class="badge-custom">Customization</span></td>
            <td>IT / Admin Team</td>
            <td><ul style="margin:0;padding-left:16px;font-size:12.5px;color:#4F6282"><li>Integrate ${intg} with Zoho platform</li><li>Configure data sync and error handling</li><li>Perform end-to-end integration testing</li></ul></td>
        </tr>`).join('') : '';

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Zoho Implementation Proposal — ${cli.company}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;color:#1A2540;line-height:1.6;background:#f5f7fa}
.page{max-width:960px;margin:0 auto;background:#fff;box-shadow:0 4px 40px rgba(0,0,0,0.1)}

/* COVER */
.cover{background:#fff;padding:60px 60px 48px;border-bottom:4px solid #1A4FD6;position:relative}
.cover-logo-area{display:flex;align-items:center;gap:10px;margin-bottom:40px}
.cover-logo-box{width:36px;height:36px;background:#1A4FD6;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px}
.cover-logo-name{font-weight:700;font-size:14px;color:#1A4FD6;letter-spacing:0.5px}
.cover-title{font-size:32px;font-weight:800;color:#1A4FD6;margin-bottom:10px}
.cover-client-name{font-size:24px;font-weight:700;color:#0B1120;margin-bottom:8px}
.cover-subtitle{font-size:14px;color:#4F6282;margin-bottom:40px}
.cover-img{width:100%;max-height:200px;object-fit:cover;border-radius:12px;background:linear-gradient(135deg,#EEF4FF,#C8DAFF);margin-bottom:40px;display:flex;align-items:center;justify-content:center;min-height:120px}
.cover-img-inner{font-size:48px;opacity:0.4}
.cover-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:32px;border-top:1px solid #E8EFF8;padding-top:24px}
.cover-meta-item label{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#7A91B3;display:block;margin-bottom:3px}
.cover-meta-item span{font-size:14px;font-weight:600;color:#1A2540}

/* SECTIONS */
.body-section{padding:48px 60px}
.body-section + .body-section{border-top:1px solid #E8EFF8}
.sec-header{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.sec-num{width:32px;height:32px;background:#1A4FD6;border-radius:8px;color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sec-title{font-size:20px;font-weight:700;color:#1A4FD6}
p{font-size:14px;color:#4F6282;line-height:1.75;margin-bottom:12px}

/* TABLES */
table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px}
thead tr{background:#0B1120}
th{padding:12px 14px;text-align:left;font-size:11px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.5px}
td{padding:12px 14px;border-bottom:1px solid #E8EFF8;vertical-align:top;font-size:13px}
tr:last-child td{border-bottom:none}
tr:nth-child(even) td{background:#FAFBFD}
.badge-config{background:#EEF4FF;color:#1A4FD6;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;white-space:nowrap}
.badge-custom{background:#FFF3E0;color:#E65100;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;white-space:nowrap}
.badge-tm{background:#E8F5E9;color:#2E7D32;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;white-space:nowrap}

/* ABOUT */
.about-box{background:linear-gradient(135deg,#0B1120,#132040);border-radius:14px;padding:28px 32px;margin-bottom:24px}
.about-box p{color:rgba(255,255,255,0.7);margin-bottom:0}
.awards-row{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}
.award-chip{background:#1A4FD6;color:#fff;font-size:12px;font-weight:600;padding:8px 14px;border-radius:10px;display:inline-flex;align-items:center;gap:6px}
.clients-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.client-tag{background:#EEF4FF;color:#1A4FD6;font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px;border:1px solid #C8DAFF}

/* CONSTRAINTS */
ul.bullet{padding-left:20px}
ul.bullet li{font-size:13.5px;color:#4F6282;margin-bottom:8px;line-height:1.6}

/* PAYMENT */
.payment-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #E8EFF8}
.payment-row:last-child{border-bottom:none}
.payment-dot{width:8px;height:8px;border-radius:50%;background:#1A4FD6;flex-shrink:0}
.payment-txt{font-size:13.5px;color:#1A2540}

/* FOOTER */
.doc-footer{background:#0B1120;padding:24px 60px;display:flex;align-items:center;justify-content:space-between}
.footer-logo-row{display:flex;align-items:center;gap:10px}
.footer-logo-box{width:28px;height:28px;background:#1A4FD6;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#fff}
.footer-brand{font-size:13px;font-weight:600;color:rgba(255,255,255,0.65)}
.footer-conf{color:rgba(255,255,255,0.3);font-size:12px}

/* ACCEPTANCE */
.acceptance-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:16px}
.acceptance-col label{font-weight:700;font-size:14px;color:#1A2540;display:block;margin-bottom:16px}
.sign-line{border-bottom:1px solid #CBD5E1;margin-bottom:12px;height:40px}
.sign-field{font-size:12px;color:#7A91B3;margin-bottom:12px}
</style></head><body>
<div class="page">

<!-- COVER PAGE -->
<div class="cover">
    <div class="cover-logo-area">
        <div class="cover-logo-box">F</div>
        <div class="cover-logo-name">FRISTINE INFOTECH</div>
    </div>
    <div class="cover-title">Zoho Implementation Proposal For</div>
    <div class="cover-client-name">${cli.company}</div>
    <div class="cover-subtitle">${industry} · Prepared by Fristine Infotech Presales Team</div>
    <div class="cover-img"><div class="cover-img-inner">📊 ⚙️ 🚀</div></div>
    <div class="cover-meta">
        <div class="cover-meta-item"><label>Date</label><span>${dateStr}</span></div>
        <div class="cover-meta-item"><label>Prepared For</label><span>${cli.company}</span></div>
        <div class="cover-meta-item"><label>Prepared By</label><span>Fristine Infotech Presales</span></div>
        <div class="cover-meta-item"><label>Contact</label><span>sample@fristinetech.com</span></div>
    </div>
</div>

<!-- ABOUT FRISTINE -->
<div class="body-section">
    <div class="sec-header"><div class="sec-num">1</div><div class="sec-title">About Fristine Infotech</div></div>
    <div class="about-box">
        <p>Fristine Infotech is India's leading Premium Zoho Partner helping clients across markets, industries & geographies solve complex business problems through bespoke consultation, implementation, and adoption of various Zoho Applications.</p>
    </div>
    <p>We have been a strategic partner for Zoho for the last <strong>10 years</strong> and have successfully completed over <strong>200+ implementations</strong> across Marketing, Sales, Operations, Finance, and Support Functions.</p>
    <div class="awards-row">
        <div class="award-chip">🏆 Zoho Creator Partner Award 2021 — Innovator of the Year</div>
        <div class="award-chip">🌏 Regional Champion — Australia & New Zealand</div>
    </div>
    <p style="font-weight:600;color:#1A2540;margin-bottom:8px">Our Clients:</p>
    <div class="clients-grid">
        ${['eBay', 'Pepperfry', 'Edelweiss', 'YES Securities', 'Mahindra Solarize', 'NPCI', 'Jio', 'Suzlon', 'Mercedes-Benz', 'Samsonite', 'TATA MD', 'CARE Ratings', 'CRISIL', 'TeamLease', 'Transasia'].map(c => `<span class="client-tag">${c}</span>`).join('')}
    </div>
</div>

<!-- PROPOSAL / SCOPE OF WORK -->
<div class="body-section">
    <div class="sec-header"><div class="sec-num">2</div><div class="sec-title">Proposal</div></div>
    <p><strong>${cli.company}</strong> is looking to implement its business processes to provide a better and more engaging experience to existing and new customers. It has identified <strong>${zohoProducts.join(', ')}</strong> as the platform(s) to digitize and optimize these processes.</p>
    <p style="font-weight:700;font-size:15px;color:#1A4FD6;margin-bottom:12px">Scope of Work</p>
    ${zohoProducts.map(prod => `
    <p style="font-weight:700;color:#0B1120;font-size:14px;margin-top:20px;margin-bottom:10px">${prod}</p>
    <table>
        <thead><tr><th>Requirement</th><th>Status</th><th>User Persona</th><th>Fristine Remark</th></tr></thead>
        <tbody>${scopeRows}</tbody>
    </table>`).join('')}
    ${integrationRows ? `
    <p style="font-weight:700;color:#0B1120;font-size:14px;margin-top:20px;margin-bottom:10px">Integrations</p>
    <table>
        <thead><tr><th>Requirement</th><th>Status</th><th>User Persona</th><th>Fristine Remark</th></tr></thead>
        <tbody>${integrationRows}</tbody>
    </table>` : ''}
    <p style="font-weight:700;color:#0B1120;font-size:14px;margin-top:20px;margin-bottom:10px">Training, Help Document &amp; UAT</p>
    <table>
        <thead><tr><th>Requirement</th><th>Status</th><th>User Persona</th><th>Fristine Remark</th></tr></thead>
        <tbody>
            <tr><td>User Training, Help Document &amp; UAT</td><td><span class="badge-tm">Time &amp; Material</span></td><td>IT / Admin Team</td><td><ul style="margin:0;padding-left:16px;font-size:12.5px;color:#4F6282"><li>UAT</li><li>User Training</li><li>Help Documentation</li></ul></td></tr>
        </tbody>
    </table>
</div>

<!-- PROJECT TEAM -->
<div class="body-section">
    <div class="sec-header"><div class="sec-num">3</div><div class="sec-title">Project Team</div></div>
    <table>
        <thead><tr><th>Sr. No.</th><th>Role</th><th>Role Description</th></tr></thead>
        <tbody>
            <tr><td>1</td><td><strong>CTO</strong></td><td>Accountable for the Architecture Plan and Risk Mitigation.</td></tr>
            <tr><td>2</td><td><strong>Project Manager</strong></td><td>Accountable for overall project outcomes. Day-to-day control and management of progress &amp; status.</td></tr>
            <tr><td>3</td><td><strong>Sr Business Analyst</strong></td><td>Accountable for overall Business/functional requirements and User Training. Responsible for creating Business Process/Product Backlog.</td></tr>
            <tr><td>4</td><td><strong>Junior Business Analyst</strong></td><td>Accountable for helping in the documentation of Business/Functional requirements.</td></tr>
            <tr><td>5</td><td><strong>Sr Developer</strong></td><td>Accountable for Quality Development. Responsible for the Completion of the development/Implementation task.</td></tr>
            <tr><td>6</td><td><strong>QA / Software Test</strong></td><td>Accountable for QA/Testing of the application. Responsible for Test planning and execution.</td></tr>
        </tbody>
    </table>
</div>

<!-- ESCALATION PROCESS -->
<div class="body-section">
    <div class="sec-header"><div class="sec-num">4</div><div class="sec-title">Escalation Process</div></div>
    <p>While the project team will attempt to resolve issues amicably and in a timely manner, the escalation path below provides a mechanism for stakeholders to intervene, resolve issues, and bring the project back on track.</p>
    <table>
        <thead><tr><th>Sr. No.</th><th>Escalation Metrics</th><th>Response Time (Working Days)</th></tr></thead>
        <tbody>
            <tr><td>1</td><td>Level 1 — Sr Business Analyst</td><td>4 Hours</td></tr>
            <tr><td>2</td><td>Level 2 — CTO</td><td>1 Day</td></tr>
            <tr><td>3</td><td>Level 3 — CEO</td><td>3 Days</td></tr>
        </tbody>
    </table>
    <p>Fristine Infotech Business-day timings are defined as 10:00 AM to 6:00 PM, Monday to Friday, excluding public holidays.</p>
</div>

<!-- GOVERNANCE -->
<div class="body-section">
    <div class="sec-header"><div class="sec-num">5</div><div class="sec-title">Project Governance &amp; Checkpoints</div></div>
    <table>
        <thead><tr><th>Sr. No.</th><th>Type of Governance and Checkpoint</th></tr></thead>
        <tbody>
            ${[
            'Requirement gathering from all business stakeholders, based on the scope',
            'Functional Solution Document (FSD) Review',
            'FSD Sign-off',
            'Doubt clarification during the development phase',
            'User walkthrough session',
            'User Acceptance Testing Round',
            'Ticket submission on identified issues',
            `${zohoProducts.join(' & ')} Training`,
            'Stakeholder sign-off'
        ].map((g, i) => `<tr><td>${i + 1}</td><td>${g}</td></tr>`).join('')}
        </tbody>
    </table>
</div>

<!-- CONSTRAINTS -->
<div class="body-section">
    <div class="sec-header"><div class="sec-num">6</div><div class="sec-title">Constraints</div></div>
    <ul class="bullet">
        <li>The actual delivery date may change based on the timely response of various stakeholders.</li>
        <li>All third-party integrations will depend on the technical capabilities &amp; API support of those platforms.</li>
        <li>Implementation will depend on the Zoho platform's current capabilities and limitations.</li>
        <li>All Zoho Plans have limits on Records, Storage, Custom functions, and API calls. Additional add-ons may need to be purchased separately if limits are exceeded.</li>
        <li>The above scope is a basic initial understanding. Final scope may evolve over time as requirements are discovered in detail.</li>
        <li>Any additional reports, automations, or integrations beyond the agreed scope will be treated as change requests.</li>
    </ul>
</div>

<!-- ASSUMPTIONS -->
<div class="body-section">
    <div class="sec-header"><div class="sec-num">7</div><div class="sec-title">Assumptions</div></div>
    <ul class="bullet">
        <li>The scope baseline will be finalized through Requirement Gathering &amp; FSD sign-off, and configuration will be implemented as per the approved FSD.</li>
        <li>Data migration (if any) is assumed to be basic and limited unless separately specified. Detailed cleansing/dedup beyond configured rules is not included.</li>
        <li>Clean and validated master and transactional data will be provided by ${cli.company} for integration and analytics.</li>
        <li>The ${cli.company} team will provide timely access, test data, and stakeholder availability as needed.</li>
    </ul>
</div>

<!-- COMMERCIALS -->
<div class="body-section">
    <div class="sec-header"><div class="sec-num">8</div><div class="sec-title">Commercials</div></div>
    <p style="font-weight:700;color:#0B1120;margin-bottom:10px">Software License Commercials</p>
    <table>
        <thead><tr><th>Sr. No.</th><th>Product</th><th>Users</th><th>Payment Type</th><th>Annual Amount (INR)</th></tr></thead>
        <tbody>
            ${zohoProducts.map((p, i) => `<tr><td>${i + 1}</td><td>${p}</td><td>${userCount || '—'}</td><td>Recurring Annually</td><td>₹ (To be quoted)</td></tr>`).join('')}
        </tbody>
    </table>
    <p style="font-size:12px;color:#7A91B3;margin-bottom:20px">Note: The above pricing is exclusive of GST</p>

    <p style="font-weight:700;color:#0B1120;margin-bottom:10px">Zoho Software Implementation Commercials</p>
    <table>
        <thead><tr><th>Sr. No.</th><th>Particulars</th><th>Commercial Type</th><th>Estimated Hours</th><th>Total Amount (INR)</th></tr></thead>
        <tbody>
            <tr><td>1</td><td>Requirement Gathering &amp; FSD Creation</td><td><span class="badge-config">Project-based</span></td><td>NA</td><td>₹ (To be quoted)</td></tr>
            <tr><td>2</td><td>${zohoProducts.join(' &amp; ')} Implementation Cost</td><td><span class="badge-config">Project-based</span></td><td>NA</td><td>₹ (To be quoted)</td></tr>
            <tr><td>3</td><td>Data Migration</td><td><span class="badge-tm">Time &amp; Material</span></td><td>4 Day's</td><td>₹ (To be quoted)</td></tr>
            ${integrations.length ? `<tr><td>4</td><td>Integrations: ${integrations.join(', ')}</td><td><span class="badge-custom">Project-based</span></td><td>NA</td><td>₹ (To be quoted)</td></tr>` : ''}
            <tr><td>${integrations.length ? 5 : 4}</td><td>30 days of Hyper-care on the delivered item (no new change request)</td><td><span class="badge-config">Project-based</span></td><td>NA</td><td>₹ (To be quoted)</td></tr>
            <tr><td colspan="4" style="font-weight:700;color:#0B1120">Recommended Run Model (Silver Plan for 12 Months)</td><td>₹ (To be quoted)</td></tr>
            <tr style="background:#EEF4FF"><td colspan="4" style="font-weight:700;color:#1A4FD6;font-size:14px">Total With Run Model Cost [Exclusive of GST]</td><td style="font-weight:700;color:#1A4FD6">₹ (To be quoted)</td></tr>
        </tbody>
    </table>
    <p style="font-size:12px;color:#7A91B3">Note: Above pricing is exclusive of GST. Third-party software license cost not included. Training includes User training only; admin training is not provided.</p>
</div>

<!-- PAYMENT TERMS -->
<div class="body-section">
    <div class="sec-header"><div class="sec-num">9</div><div class="sec-title">Payment Terms</div></div>
    <div class="payment-row"><div class="payment-dot"></div><div class="payment-txt">The Zoho License cost needs to be paid in full upfront to Zoho in advance.</div></div>
    <div class="payment-row"><div class="payment-dot"></div><div class="payment-txt">60% Implementation Cost Payable in advance.</div></div>
    <div class="payment-row"><div class="payment-dot"></div><div class="payment-txt">40% Implementation Cost Payable Before Start of UAT Sign-Off.</div></div>
    <div class="payment-row"><div class="payment-dot"></div><div class="payment-txt">Run Model services will be billed monthly in advance.</div></div>
    <div style="margin-top:20px;padding:16px;background:#EEF4FF;border-radius:10px;border-left:4px solid #1A4FD6">
        <p style="color:#1A2540;font-weight:600;margin-bottom:4px">Timeline</p>
        <p style="margin:0">Post receipt of PO, the project will commence within 15 days. The entire project will take <strong>10 Weeks + 2 Weeks buffer</strong> after FSD Sign-Off.</p>
    </div>
</div>

<!-- NEXT STEPS -->
<div class="body-section">
    <div class="sec-header"><div class="sec-num">10</div><div class="sec-title">Next Steps</div></div>
    <table>
        <thead><tr><th>Steps</th><th>Agenda</th><th>Fristine Team</th><th>${cli.company}</th></tr></thead>
        <tbody>
            <tr><td><strong>Service Level Agreement</strong></td><td>Define Terms and conditions from both parties</td><td>Sales Representative</td><td>Champion</td></tr>
            <tr><td><strong>Software License</strong></td><td>License procurement</td><td>Sales Representative / Zoho Team</td><td>Champion</td></tr>
            <tr><td><strong>Vendor Registration</strong></td><td>If required for onboarding</td><td>Sales Representative</td><td>Champion</td></tr>
            <tr><td><strong>Purchase Order</strong></td><td>${cli.company} raises PO for Service &amp; License Fee separately</td><td>Not Applicable</td><td>Finance Team</td></tr>
            <tr><td><strong>Invoicing</strong></td><td>Process invoicing to Zoho and Fristine separately</td><td>Accounting Manager</td><td>Finance Team</td></tr>
        </tbody>
    </table>
</div>

<!-- ACCEPTANCE -->
<div class="body-section">
    <div class="sec-header"><div class="sec-num">11</div><div class="sec-title">Acceptance</div></div>
    <div class="acceptance-grid">
        <div class="acceptance-col">
            <label>For Fristine Infotech Pvt Ltd</label>
            <div class="sign-line"></div>
            <div class="sign-field">Signature:</div>
            <div class="sign-line"></div>
            <div class="sign-field">Name:</div>
            <div class="sign-line"></div>
            <div class="sign-field">Designation:</div>
            <div class="sign-line"></div>
            <div class="sign-field">Date:</div>
        </div>
        <div class="acceptance-col">
            <label>For ${cli.company}</label>
            <div class="sign-line"></div>
            <div class="sign-field">Signature:</div>
            <div class="sign-line"></div>
            <div class="sign-field">Name:</div>
            <div class="sign-line"></div>
            <div class="sign-field">Designation:</div>
            <div class="sign-line"></div>
            <div class="sign-field">Date:</div>
        </div>
    </div>
</div>

<!-- FOOTER -->
<div class="doc-footer">
    <div class="footer-logo-row">
        <div class="footer-logo-box">F</div>
        <div class="footer-brand">Fristine Infotech · India's Leading Premium Zoho Partner</div>
    </div>
    <div class="footer-conf">Confidential · ${new Date().getFullYear()}</div>
</div>

</div></body></html>`;

    if (activeClientId) {
        // Save proposal HTML to Apps Script (Google Sheet) so agent can view it from any device
        try {
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'save_proposal', client_id: activeClientId, proposal_html: html, timestamp: new Date().toISOString() })
            });
        } catch (e) { console.warn('Proposal save to sheet failed:', e); }
        // Also cache locally as fallback
        localStorage.setItem(`proposal_${activeClientId}`, html);
        await logEvent(activeClientId, 'proposal_generated');
    }

    pendingBlob = new Blob([html], { type: 'text/html' });
    pendingName = fname;
    hideLdr();

    // Change 1: Client sees confirmation message — NO download. Presales agent sends the formal proposal.
    if (activeClientId) await logEvent(activeClientId, 'proposal_submitted');
    addAg(`
        <div class="reqcard" style="text-align:center;padding:28px 20px;">
            <div style="font-size:48px;margin-bottom:14px">🎉</div>
            <div class="req-stitle" style="font-size:17px;margin-bottom:10px">You're all set!</div>
            <div style="font-size:13.5px;color:rgba(255,255,255,0.65);line-height:1.75;max-width:360px;margin:0 auto 18px;">
                Your requirements have been captured and a tailored Zoho proposal is being prepared by our presales team.<br/><br/>
                <strong style="color:rgba(255,255,255,0.85)">A Fristine presales specialist will share the detailed proposal with you shortly.</strong>
            </div>
            <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(43,114,245,0.15);border:1px solid rgba(43,114,245,0.3);border-radius:20px;padding:8px 18px;font-size:12px;color:#5B9BFF;font-weight:600;">
                ✅ Session Complete · Proposal Queued for Delivery
            </div>
        </div>
    `);
}

// handleUpload and downloadOnly kept for agent-side use only (not shown to client)
async function handleUpload() {
    const token = document.getElementById('gDriveToken')?.value?.trim();
    if (!token) return;
    showLdr('Uploading to Drive…');
    try {
        const data = await uploadFileToDrive(token, pendingName, pendingBlob);
        console.log('[Drive] Uploaded:', data.webViewLink);
    } catch (e) { console.warn('[Drive] Upload failed'); }
    hideLdr();
}

async function downloadOnly() {
    if (!pendingBlob) return;
    const url = URL.createObjectURL(pendingBlob);
    const a = document.createElement('a'); a.href = url; a.download = pendingName; a.click();
}

/* ══ MODAL HELPERS ══ */
function openModal(id) { document.getElementById(id).classList.add('visible'); }
function closeModal(id) { document.getElementById(id).classList.remove('visible'); }

document.getElementById('closeVideoBtn').addEventListener('click', () => {
    closeModal('videoModal');
    generateProposal();
});

document.getElementById('closeProposalBtn').addEventListener('click', () => closeModal('proposalModal'));

document.getElementById('downloadProposalBtn').addEventListener('click', () => {
    if (currentTrackingClient) {
        const html = localStorage.getItem(`proposal_${currentTrackingClient.client_id}`);
        if (html) {
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Proposal_${currentTrackingClient.company}.html`;
            a.click();
        }
    }
});

/* ══ UI HELPERS ══ */
function showLdr(txt) {
    const l = document.getElementById('ldr');
    if (l) { l.classList.remove('hidden'); document.getElementById('ltxt').textContent = txt; }
}
function hideLdr() { document.getElementById('ldr').classList.add('hidden'); }

function setStg(i, st) {
    const d = document.getElementById('s' + i), l = document.getElementById('sl' + i);
    if (!d || !l) return;
    d.className = 'sdg ' + st;
    l.className = 'slbl ' + st;
}

function setPhase(txt) { document.getElementById('phaseTxt').textContent = txt; }

function updateCov(p) {
    document.getElementById('cvb').style.width = p + '%';
    document.getElementById('cvp').textContent = p + '%';
}

function addAg(msg, opts = {}) {
    const f = document.getElementById('feed');
    const div = document.createElement('div');
    div.className = 'mr ag';

    // noEscape: msg is already full HTML (like the requirements card), render directly
    if (opts.noEscape) {
        div.innerHTML = `<div class="av ag">F</div><div class="bbl ag bbl-wide">${msg}</div>`;
    } else {
        div.innerHTML = `<div class="av ag">F</div><div class="bbl ag">${msg}</div>`;
    }
    f.appendChild(div);

    if (opts.inds) {
        const btns = document.createElement('div');
        btns.className = 'm-btns-v';
        opts.inds.forEach(ind => {
            const btn = document.createElement('button');
            btn.className = 'cbtn';
            btn.textContent = ind;
            btn.onclick = () => {
                prof.confirmed = ind;
                document.querySelectorAll('.cbtn').forEach(b => b.disabled = true);
                addUs(ind);
                setStg(1, 'done');
                beginGather();
            };
            btns.appendChild(btn);
        });
        div.querySelector('.bbl').appendChild(btns);
    }

    if (opts.extra) {
        const wrap = document.createElement('div');
        wrap.innerHTML = opts.extra;
        div.querySelector('.bbl').appendChild(wrap);
    }

    if (opts.video) {
        const vid = document.createElement('div');
        vid.className = 'vid-preview';
        vid.innerHTML = `<div class="v-play">▶</div><div style="font-size:12px;margin-top:4px">Strategy Brief</div>`;
        vid.onclick = () => openModal('videoModal');
        div.querySelector('.bbl').appendChild(vid);
    }

    f.scrollTop = f.scrollHeight;
    // Auto-save conversation memory after every agent message
    saveConversationMemory();

    // Add interactivity to new elements
    initDynamicUI();
}

function addUs(msg) {
    const f = document.getElementById('feed');
    const div = document.createElement('div');
    div.className = 'mr u';
    div.innerHTML = `<div class="av us">U</div><div class="bbl us">${msg}</div>`;
    f.appendChild(div);
    f.scrollTop = f.scrollHeight;
    saveConversationMemory();
}

/**
 * Ported from v5: Interactive UI enhancements
 */
function initDynamicUI() {
    // 1. Sidebar Stages (1-5) Clickable
    document.querySelectorAll('.stage').forEach((el, idx) => {
        el.style.cursor = 'pointer';
        el.onclick = () => {
            const status = document.getElementById('s' + idx).className;
            let info = "";
            if (status.includes('done')) info = "This phase is complete.";
            else if (status.includes('act')) info = "We are currently in this phase.";
            else info = "This phase will start soon.";

            const tip = document.createElement('div');
            tip.className = 'ui-tip';
            tip.innerHTML = `<strong>Stage ${idx + 1}</strong><br/>${info}`;
            document.body.appendChild(tip);
            const rect = el.getBoundingClientRect();
            tip.style.left = (rect.right + 10) + 'px';
            tip.style.top = rect.top + 'px';
            setTimeout(() => tip.remove(), 2000);
        };
    });

    // 2. MEDDPICC Coverage Bar interactivity
    const covBar = document.getElementById('cvb')?.parentElement;
    if (covBar) {
        covBar.style.cursor = 'help';
        covBar.title = "Click for discovery details";
        covBar.onclick = () => {
            const pct = document.getElementById('cvp').textContent;
            addAg(`We've completed <strong>${pct}</strong> of your MEDDPICC profile. I'm analyzing your Metric, Pain, and Decision Process to architect the right solution.`);
        };
    }

    // 3. Header Interactivity
    const logoMark = document.querySelector('.tb-logo-mark');
    if (logoMark) {
        logoMark.style.cursor = 'pointer';
        logoMark.onclick = () => addAg("Fristine Infotech is your Premium Zoho Partner. How can I help you today?");
    }

    const phaseChip = document.querySelector('.ph-chip');
    if (phaseChip) {
        phaseChip.style.cursor = 'help';
        phaseChip.onclick = () => {
            const txt = document.getElementById('phaseTxt').textContent;
            addAg(`Current System State: <strong>${txt}</strong>. I am processing data to provide strategic insights.`);
        };
    }

    // 4. Metadata Chips in Sidebar
    ['sbi', 'sbs', 'sbt'].forEach(id => {
        const el = document.getElementById(id)?.parentElement;
        if (el) {
            el.style.cursor = 'help';
            el.onclick = () => {
                const val = document.getElementById(id).textContent;
                const lbl = el.querySelector('span')?.textContent || "Detail";
                addAg(`Current ${lbl}: <strong>${val}</strong>. This target profile helps me tailor Zoho module selection.`);
            };
        }
    });
}

/* ══ LOGOUT / BACK ══ */
document.getElementById('staffLogout').addEventListener('click', () => location.reload());
document.getElementById('logoutBtn').addEventListener('click', () => { window.location.href = window.location.pathname; });
document.getElementById('trackLogout').addEventListener('click', () => location.reload());
document.getElementById('backToDashBtn').addEventListener('click', () => {
    document.getElementById('T').classList.add('hidden');
    document.getElementById('H').classList.remove('hidden');
    renderClientTable();
});

/* ══ BOOT ══ */
init().then(() => {
    // Initial call for static UI elements
    initDynamicUI();
});
