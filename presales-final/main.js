import './style.css';
import { parseCSV, parseClientCSV } from './src/services/csv-service.js';
import { gem, safeJ } from './src/services/gemini.js';
import { uploadFileToDrive } from './src/services/google-drive.js';

/* ══════════════════════════════════════════════
   CONFIG — Update APPS_SCRIPT_URL after deploying
   your Google Apps Script Web App
══════════════════════════════════════════════ */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzeQkhQclsvGDQfMVcKxRx3ngabIr7igGKZhkTG9oW20pm4D7wosLx1mQvZvNdOX1xyNA/exec";
const CLIENT_SHEET_ID = "1U-kaTF-TEAd835RQVnZd4aCH5c9Wx9PVrzsENaJRtog";
const DEPLOY_URL = "https://presales-sample.netlify.app";

/* ══ STATE ══ */
let staffClients = [];
let manualLeads = JSON.parse(localStorage.getItem('f_manual_leads') || '[]');
let cli = null, prof = null, convo = [], reqs = null, sol = null;
let phase = "login", rn = 0, discoveryComplete = false;
let pendingBlob = null, pendingName = '', fileContent = '';
let currentTrackingClient = null;
let activeClientId = null;

/* ══ ZOHO KNOWLEDGE BASE ══ */
const ZK = `You are a high-performing Senior Presales Solutions Architect at Fristine Infotech (Premium Zoho Partner).

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

CONSULTATION RULES:
1. BE WARM & HELPFUL: Start with a friendly greeting. Ask "What type of help do you need today?"
2. DYNAMIC KNOWLEDGE: Use research context when asked about the company or industry.
3. CONCISE & BULLETED: Limit responses to 3-4 sentences maximum.
4. CHALLENGE & PROBE: If answers are shallow, ask a sharp, industry-specific follow-up.
5. MEDDPICC FOCUS: Uncover Pain and Metrics (success measurement).
6. PROFESSIONAL TONE: Authoritative yet helpful. No pricing talk.
7. JSON TRIGGER: After 4-6 meaningful exchanges, output REQUIREMENTS_COMPLETE followed by JSON: {"pain_points":[], "must_have":[], "summary":"", "success_metrics":[]}`;

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
    // Always fetch from Apps Script (Google Sheet) so agent sees cross-device events
    try {
        const r = await fetch(`${APPS_SCRIPT_URL}?action=get_tracking&client_id=${encodeURIComponent(clientId)}`);
        const remoteEvents = await r.json();
        if (Array.isArray(remoteEvents) && remoteEvents.length > 0) {
            // Also update local cache
            localStorage.setItem(`tracking_${clientId}`, JSON.stringify(remoteEvents));
            return remoteEvents;
        }
    } catch (e) {
        console.warn('[Tracking] GET failed, falling back to localStorage:', e);
    }
    // Fallback to localStorage if sheet unreachable
    return JSON.parse(localStorage.getItem(`tracking_${clientId}`) || '[]');
}

/* ══════════════════════════════════════════════
   AUTH — Staff login (presales agent only)
══════════════════════════════════════════════ */
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

    if (em.endsWith('@fristinetech.com') && pw === 'admin123') {
        startStaffPortal();
        return;
    }
    err.textContent = 'Invalid credentials. This portal is for Fristine Presales Agents only.';
    err.style.display = 'block';
});

document.getElementById('pw').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
});

/* ══════════════════════════════════════════════
   STAFF PORTAL — Client Dashboard
══════════════════════════════════════════════ */
function getAllClients() {
    const sheetIds = new Set(staffClients.map(c => c.client_id));
    const manual = manualLeads.filter(l => !sheetIds.has(l.client_id));
    return [...staffClients, ...manual];
}

async function startStaffPortal() {
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

    document.getElementById('trackingClientName').textContent = `/ ${client.company}`;
    document.getElementById('tClientIco').textContent = (client.company || '?')[0].toUpperCase();
    document.getElementById('tClientName').textContent = client.company || '—';
    document.getElementById('tClientMeta').textContent = `${client.industry || '—'} · ${client.email || '—'}`;
    document.getElementById('tClientId').textContent = `Client ID: ${clientId}`;

    showLdr('Loading tracking data…');
    const events = await getTrackingEvents(clientId);
    hideLdr();

    renderPipeline(events);
    renderEventLog(events);

    const proposalHtml = localStorage.getItem(`proposal_${clientId}`);
    if (proposalHtml || events.find(e => e.event === 'proposal_generated')) {
        document.getElementById('proposalSection').style.display = 'block';
    } else {
        document.getElementById('proposalSection').style.display = 'none';
    }

    document.getElementById('resendBotBtn').onclick = () => sendBotEmail(clientId);

    document.getElementById('copyLinkBtn').onclick = () => {
        const url = `${DEPLOY_URL}/?client=${encodeURIComponent(clientId)}`;
        navigator.clipboard.writeText(url).then(() => {
            document.getElementById('copyLinkBtn').textContent = '✅ Copied!';
            setTimeout(() => { document.getElementById('copyLinkBtn').textContent = '🔗 Copy Link'; }, 2000);
        });
    };

    document.getElementById('viewProposalBtn').onclick = async () => {
        // Try localStorage first (fast), then fetch from Apps Script
        let html = localStorage.getItem(`proposal_${clientId}`);
        if (!html) {
            showLdr('Fetching proposal…');
            try {
                const r = await fetch(`${APPS_SCRIPT_URL}?action=get_proposal&client_id=${encodeURIComponent(clientId)}`);
                const data = await r.json();
                if (data && data.proposal_html) {
                    html = data.proposal_html;
                    localStorage.setItem(`proposal_${clientId}`, html); // cache it
                }
            } catch(e) { console.warn('Proposal fetch failed:', e); }
            hideLdr();
        }
        if (html) {
            document.getElementById('proposalIframe').srcdoc = html;
            openModal('proposalModal');
        } else {
            alert('Proposal not found. The client may not have completed the session yet, or it was generated on a different browser before the remote sync was enabled.');
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

document.getElementById('openCreateBtn').addEventListener('click', () => openModal('createLeadModal'));
document.getElementById('closeCreateBtn').addEventListener('click', () => closeModal('createLeadModal'));

document.getElementById('saveLeadBtn').addEventListener('click', () => {
    const co = document.getElementById('nl-co').value.trim();
    const ind = document.getElementById('nl-ind').value.trim();
    const em = document.getElementById('nl-em').value.trim();
    let id = document.getElementById('nl-id').value.trim().replace(/\s+/g, '');

    if (!co || !em) { alert('Company name and email are required.'); return; }
    if (!id) id = co.replace(/\s+/g, '').toUpperCase().slice(0, 6) + Math.floor(100 + Math.random() * 900);

    manualLeads.push({ client_id: id, company: co, industry: ind, email: em });
    localStorage.setItem('f_manual_leads', JSON.stringify(manualLeads));
    renderClientTable();
    closeModal('createLeadModal');
    ['nl-co', 'nl-ind', 'nl-em', 'nl-id'].forEach(fid => { document.getElementById(fid).value = ''; });
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
    const sys = `${ZK}\nRESEARCH CONTEXT for ${cli.company}:\n${JSON.stringify(prof)}\n${fileContent ? `UPLOADED FILE:\n${fileContent}\n` : ''}Round: ${rn}/6\nHistory: ${JSON.stringify(convo.slice(-10))}`;
    const p = isOpen
        ? `${sys}\nOpen with a warm, personal greeting. Then: "I've completed my research into your operations in the ${prof.confirmed || cli.industry} sector. To start, what type of help do you need today?"`
        : `${sys}\nKeep under 4 sentences. ${rn >= 5 ? 'CRITICAL: Output REQUIREMENTS_COMPLETE + JSON summary now.' : 'Output REQUIREMENTS_COMPLETE + JSON after 4-5 meaningful exchanges.'}`;
    return gem(p, 1000, 0.7);
}

/* File upload */
const fBtn = document.getElementById('fileBtn'), fIn = document.getElementById('fileIn');
if (fBtn && fIn) {
    fBtn.onclick = () => fIn.click();
    fIn.onchange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        showLdr('Analyzing requirements file…');
        const r = new FileReader();
        r.onload = (ev) => {
            fileContent = ev.target.result;
            addUs(`[Uploaded File: ${f.name}]`);
            addAg(`I've received and analyzed your file: <strong>${f.name}</strong>. I'll incorporate these requirements into our solution design.`);
            hideLdr();
        };
        r.readAsText(f);
    };
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

function showReqSummary() {
    if (!reqs) reqs = { summary: 'Ready to proceed with solution design.', must_have: [] };
    setStg(2, 'done'); setStg(3, 'act'); setPhase('Reviewing Profile…');
    const html = `<div class="reqcard"><div class="reqh">📋 Requirements Summary</div>
        <div class="req-section"><div class="req-stitle">Summary</div><div style="font-size:13px;color:var(--sub)">${reqs.summary || 'Summary generated.'}</div></div>
        <div class="req-section"><div class="req-stitle">Must-Haves</div>${(reqs.must_have || ['Custom Workflow Automation']).map(m => `<div class="req-item">${m}</div>`).join('')}</div>
        <div class="req-btns"><button class="btn-create" id="confirmProposal">Confirm & Generate Solution</button></div></div>`;
    addAg("I've analyzed our discussion. Here's what I've captured. Does this look right?", { extra: html });
    document.getElementById('confirmProposal').addEventListener('click', buildSolution);
}

async function buildSolution() {
    setStg(3, 'done'); setStg(4, 'act'); setPhase('Architecting Proposal…');
    showLdr('Designing Solution…');
    const p = `${ZK}\nDesign Zoho solution for ${cli.company} based on: ${JSON.stringify(reqs)}\nReturn JSON with primary_products, implementation_phases, team_structure, and monthly_cost.`;
    const res = await gem(p, 2000, 0.4);
    sol = safeJ(res);
    hideLdr();
    setStg(4, 'done');
    addAg("Your Zoho Transformation Roadmap is ready! Let's take a look.", { video: true });
    openModal('videoModal');
}

async function generateProposal() {
    showLdr('Generating Premium Proposal…');
    const fname = `Zoho_Proposal_${(cli.company || 'Client').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.html`;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const mustHavesHtml = (reqs.must_have || []).map(m => `
        <tr><td>${m}</td><td><span class="status-badge config">Defined</span></td><td><span class="persona-tag">Business User</span></td><td>Included in core Zoho implementation phase.</td></tr>`).join('');

    const solutionRows = sol ? Object.entries(sol).map(([k, v], i) => `
        <tr><td>0${i+1}</td><td><div class="team-role"><div class="role-dot"></div>${k.replace(/_/g,' ').toUpperCase()}</div></td><td>${typeof v==='object'?JSON.stringify(v):v}</td></tr>`).join('') : '<tr><td colspan="3">Solution details pending final architecture.</td></tr>';

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Zoho Strategy — ${cli.company}</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
<style>
:root{--ink:#0B1120;--blue:#1A4FD6;--blue2:#2B72F5;--bluelight:#EEF4FF;--bluemid:#C8DAFF;--text:#1A2540;--muted:#4F6282;--border:#D8E4F5;--fn:'DM Sans',sans-serif;--display:'Syne',sans-serif}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#F0F4FB;color:var(--text);font-family:var(--fn);line-height:1.7}
.page-wrap{max-width:960px;margin:0 auto;padding:32px 20px 80px}
.page{background:#fff;border-radius:20px;box-shadow:0 12px 48px rgba(26,79,214,0.14);overflow:hidden}
.cover{background:linear-gradient(145deg,#0B1120 0%,#0D2050 50%,#0D3AB5 100%);padding:72px 64px 64px;position:relative}
.cover::before{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,0.04) 1px,transparent 1px);background-size:28px 28px}
.cover-inner{position:relative;z-index:2}
.cover-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:30px;padding:6px 16px 6px 8px;margin-bottom:36px}
.cover-badge-dot{width:28px;height:28px;border-radius:50%;background:var(--blue2);display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:800;font-size:13px;color:#fff}
.cover-badge span{font-size:12px;font-weight:600;color:rgba(255,255,255,0.8)}
.cover-title{font-family:var(--display);font-size:42px;font-weight:800;color:#fff;letter-spacing:-1.5px;line-height:1.1;margin-bottom:8px}
.cover-title span{color:#5B9BFF}
.cover-subtitle{font-size:16px;color:rgba(255,255,255,0.55);margin-bottom:56px}
.cover-meta{display:flex;gap:40px;flex-wrap:wrap}
.cover-meta-item label{display:block;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:4px}
.cover-meta-item span{font-size:14px;font-weight:600;color:rgba(255,255,255,0.85)}
.doc-body{padding:56px 64px}
.section{margin-bottom:56px}
.sec-hd{display:flex;align-items:center;gap:14px;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid var(--border)}
.sec-ico{width:40px;height:40px;border-radius:12px;background:var(--bluelight);border:1px solid var(--bluemid);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.sec-title{font-family:var(--display);font-size:22px;font-weight:700;color:var(--ink)}
.proposal-box{background:linear-gradient(135deg,#0B1120 0%,#132040 100%);border-radius:16px;padding:28px 32px;margin-bottom:32px}
.proposal-box p{color:rgba(255,255,255,0.75);font-size:14.5px;line-height:1.75}
.scope-table,.team-table{width:100%;border-collapse:collapse;font-size:13.5px;margin-bottom:32px}
.scope-table thead tr,.team-table thead tr{background:var(--ink)}
.scope-table th,.team-table th{padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;font-family:var(--display)}
.scope-table td,.team-table td{padding:14px 16px;border-bottom:1px solid var(--border);vertical-align:top}
.status-badge{display:inline-block;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px}
.status-badge.config{background:rgba(26,79,214,0.1);color:var(--blue2)}
.persona-tag{font-size:11px;color:var(--muted);font-weight:500}
.team-role{display:flex;align-items:center}
.role-dot{width:8px;height:8px;border-radius:50%;background:var(--blue2);margin-right:8px}
.doc-footer{background:var(--ink);padding:24px 64px;display:flex;align-items:center;justify-content:space-between}
.footer-logo{width:30px;height:30px;background:var(--blue2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:800;font-size:14px;color:#fff}
</style></head><body>
<div class="page-wrap"><div class="page">
<div class="cover"><div class="cover-inner">
  <div class="cover-badge"><div class="cover-badge-dot">F</div><span>Fristine Infotech Pvt Ltd</span></div>
  <div class="cover-title">Zoho Transformation<br/><span>Strategy</span></div>
  <div class="cover-subtitle">Prepared for ${cli.company}</div>
  <div class="cover-meta">
    <div class="cover-meta-item"><label>Date</label><span>${dateStr}</span></div>
    <div class="cover-meta-item"><label>Prepared by</label><span>Fristine AI Agent</span></div>
  </div>
</div></div>
<div class="doc-body">
  <div class="section"><div class="sec-hd"><div class="sec-ico">🏢</div><div class="sec-title">Executive Summary</div></div>
    <div class="proposal-box"><p>${reqs.summary || 'Strategic solution drafted based on discovery.'}</p></div>
  </div>
  <div class="section"><div class="sec-hd"><div class="sec-ico">⚙️</div><div class="sec-title">Scope of Work</div></div>
    <table class="scope-table"><thead><tr><th>Requirement</th><th>Status</th><th>Persona</th><th>Remark</th></tr></thead><tbody>${mustHavesHtml}</tbody></table>
  </div>
  <div class="section"><div class="sec-hd"><div class="sec-ico">🚀</div><div class="sec-title">Proposed Architecture</div></div>
    <table class="team-table"><thead><tr><th>#</th><th>Component</th><th>Details</th></tr></thead><tbody>${solutionRows}</tbody></table>
  </div>
</div>
<div class="doc-footer">
  <div style="display:flex;align-items:center;gap:12px"><div class="footer-logo">F</div><div style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.7)">Fristine Infotech · Premium Zoho Partner</div></div>
  <div style="color:rgba(255,255,255,0.3);font-size:12px">Confidential · 2026</div>
</div>
</div></div></body></html>`;

    if (activeClientId) {
        // Save proposal HTML to Apps Script (Google Sheet) so agent can view it from any device
        try {
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'save_proposal', client_id: activeClientId, proposal_html: html, timestamp: new Date().toISOString() })
            });
        } catch(e) { console.warn('Proposal save to sheet failed:', e); }
        // Also cache locally as fallback
        localStorage.setItem(`proposal_${activeClientId}`, html);
        await logEvent(activeClientId, 'proposal_generated');
    }

    pendingBlob = new Blob([html], { type: 'text/html' });
    pendingName = fname;
    hideLdr();

    addAg(`Your proposal <strong>${fname}</strong> is ready.`);
    const driveUI = `<div class="reqcard"><div class="req-stitle">Save Your Proposal</div>
        <input type="text" id="gDriveToken" placeholder="Paste Google Drive Access Token (optional)" style="width:100%;background:var(--bg);border:1px solid var(--brd);padding:10px;color:#fff;border-radius:8px;margin:10px 0"/>
        <div class="m-btns"><button class="m-btn m-save" id="uploadBtn">Upload to Drive & Download</button><button class="m-btn m-cancel" id="skipBtn">Download Only</button></div></div>`;
    addAg(driveUI);
    document.getElementById('uploadBtn').onclick = handleUpload;
    document.getElementById('skipBtn').onclick = downloadOnly;
}

async function handleUpload() {
    const token = document.getElementById('gDriveToken').value.trim();
    if (!token) return alert('Please provide a Google Drive access token.');
    showLdr('Uploading to Drive…');
    try {
        const data = await uploadFileToDrive(token, pendingName, pendingBlob);
        addAg(`✅ Uploaded to Drive! <a href="${data.webViewLink}" target="_blank" style="color:var(--acclt)">View File</a>`);
        downloadOnly();
    } catch (e) {
        addAg(`❌ Upload failed. Downloading locally instead.`);
        downloadOnly();
    }
    hideLdr();
}

async function downloadOnly() {
    const url = URL.createObjectURL(pendingBlob);
    const a = document.createElement('a'); a.href = url; a.download = pendingName; a.click();
    if (activeClientId) await logEvent(activeClientId, 'proposal_submitted');
    addAg('✨ Discovery session complete. The proposal has been saved. Our team will contact you soon.');
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
    div.innerHTML = `<div class="av ag">F</div><div class="bbl ag">${msg}</div>`;
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
}

function addUs(msg) {
    const f = document.getElementById('feed');
    const div = document.createElement('div');
    div.className = 'mr u';
    div.innerHTML = `<div class="av us">U</div><div class="bbl us">${msg}</div>`;
    f.appendChild(div);
    f.scrollTop = f.scrollHeight;
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
init();
