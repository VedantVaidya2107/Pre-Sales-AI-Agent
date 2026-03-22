import '../style.css';
import { auth, clients, tracking, proposals, email, gem, safeJ } from './services/api.js';
import mammoth from 'mammoth';

/* ══ CONFIG ══ */
const DEPLOY_URL = (import.meta.env.VITE_DEPLOY_URL || window.location.origin).replace(/\/$/, '');

/* ══ STATE ══ */
let allClients = [];
let cli = null, prof = null, convo = [], reqs = null, sol = null;
let phase = 'login', rn = 0, discoveryComplete = false;
let pendingBlob = null, pendingName = '';
let fileContent = '';
let currentTrackingClient = null;
let activeClientId = null;

/* ══ ENHANCED ZOHO KNOWLEDGE BASE WITH NATURAL LANGUAGE UNDERSTANDING ══ */
const ZK = `You are a high-performing Senior Presales Solutions Architect at Fristine Infotech (India's leading Premium Zoho Partner, 10 years, 200+ implementations).

YOUR COMPANY — FRISTINE INFOTECH:
- India's leading Premium Zoho Partner
- Awards: Zoho Creator Partner Award 2021 — Innovator of the Year & Regional Champion (ANZ)
- Key clients: eBay, Pepperfry, Edelweiss, YES Securities, Mahindra Solarize, NPCI, Jio, Suzlon, Mercedes-Benz, Samsonite, TATA MD, CARE Ratings, CRISIL, TeamLease, Transasia

YOUR MISSION:
Conduct a strategic discovery session. Move beyond "features" and uncover "business value". Use the MEDDPICC framework naturally in conversation without being robotic.

ZOHO PRODUCTS PRICING:
• Zoho CRM — $14/$23/$40/$52/user/month
• Zoho Books — Free/$15/$40/org/month
• Zoho Desk — Free/$14/$23/$40/agent/month
• Zoho Projects — Free/$4/$9/user/month
• Zoho Inventory — $39/$99/org/month
• Zoho People — Free/$1.25/$2/$3/user/month
• Zoho Analytics — $22/$45/$112/month
• Zoho Campaigns — Free/$3/$4.5/month
• Zoho Sign — $10/$20/month
• Zoho Creator — $8/$20/user/month
• Zoho Flow — Free/$10/$25/month
• Zoho One — $37/user/month (all employees) or $90 flexible
• Zoho Bigin — $7/$12/user/month

⚡ ENHANCED NATURAL LANGUAGE UNDERSTANDING:

1. INTERPRET CASUAL & INFORMAL LANGUAGE:
   - Understand slang: "kinda", "sorta", "tbh" (to be honest), "ngl" (not gonna lie), "rn" (right now), "atm" (at the moment), "idk" (I don't know), "smth" (something)
   - Parse numbers casually mentioned: "like 50 people", "maybe 30 users", "around 100"
   - Recognize informal pain points: "it's a mess", "driving us crazy", "waste of time", "super frustrating"
   
   Examples:
   - "rn we're using excel" → current_tools: ["Excel"]
   - "we have like 50 ppl" → user_count: ~50
   - "tbh our crm sucks" → pain_point: "Dissatisfaction with current CRM"

2. HANDLE TYPOS & MISSPELLINGS:
   Don't get confused by common typos:
   - manegment → management
   - custemer → customer
   - recieve → receive
   - seperate → separate
   - definitly → definitely
   - loose → lose (in context: "we loose deals")

3. UNDERSTAND CONTEXT & IMPLICIT MEANING:
   Infer requirements from context:
   - "we lose deals at the last minute" → pain_point: "Late-stage deal losses", need: "Better pipeline visibility"
   - "everyone uses their own spreadsheet" → pain_point: "Data fragmentation", need: "Centralized system"
   - "manual work is killing us" → automation_opportunities: HIGH
   - "can't see what's happening" → need: "Reporting & dashboards"
   - "too slow to respond to leads" → pain_point: "Slow response time", need: "Lead routing automation"

4. EXTRACT MULTIPLE INTENTS FROM ONE MESSAGE:
   Parse compound statements:
   - "we're a 50-person manufacturing company using quickbooks and excel and it's chaotic" →
     * industry: "Manufacturing"
     * user_count: 50
     * current_tools: ["QuickBooks", "Excel"]
     * pain_point: "Operational chaos/disorganization"

5. RECOGNIZE IMPLICIT REQUIREMENTS:
   Infer needs from business context:
   - "we're scaling fast" → needs: scalability, automation, better processes
   - "getting more complex" → needs: better organization, workflow management
   - "hiring more people" → needs: onboarding, team collaboration tools
   - "expanding to new markets" → needs: multi-currency, localization

6. BE CONVERSATIONAL & EMPATHETIC:
   - Match the user's tone (casual ↔ casual, formal ↔ formal)
   - Acknowledge emotions: "I totally understand how frustrating that must be"
   - Use natural transitions: "Got it!", "Makes sense", "That's a common challenge"
   - Avoid robotic language: DON'T say "I comprehend your requirements" → DO say "I hear you"

7. ASK SMART, NATURAL FOLLOW-UPS:
   Instead of: "What is your exact user count?"
   Say: "Just to get a sense of scale — roughly how many people would be using this?"
   
   Instead of: "Please enumerate your pain points"
   Say: "What's the biggest headache this is causing you right now?"

8. EXTRACT STRUCTURED DATA FROM CASUAL CONVERSATION:
   Transform unstructured input into structured requirements:
   
   Input: "so basically we're drowning in spreadsheets and everyone's doing their own thing and we can't track anything properly"
   Extract: {
     current_tools: ["Excel/Spreadsheets"],
     pain_points: ["Data fragmentation", "Lack of visibility", "Inconsistent processes"],
     must_have: ["Centralized data management", "Reporting/tracking capability"]
   }

CONSULTATION RULES:
1. BE WARM & CONVERSATIONAL: Talk like a helpful colleague, not a robot. Use natural language.
2. KEEP IT BRIEF: 2-4 sentences maximum. Be conversational and engaging.
3. ONE QUESTION AT A TIME: Don't overwhelm with multiple questions. Focus on ONE thing.
4. ACKNOWLEDGE WHAT THEY SAID: Always acknowledge the user's input before asking the next question.
5. MEDDPICC NATURALLY: Uncover Pain, Metrics, Decision process through natural conversation.
6. JSON TRIGGER: After 4-6 meaningful exchanges (when you have enough information), output REQUIREMENTS_COMPLETE followed by JSON:
{
  "business_overview": "2-3 sentence narrative",
  "departments": ["Dept 1"],
  "current_tools": ["Tool 1"],
  "pain_points": ["Pain 1"],
  "must_have": ["Req 1"],
  "nice_to_have": ["Nice 1"],
  "automation_opportunities": ["Opp 1"],
  "integrations": ["Int 1"],
  "success_metrics": ["Metric 1"],
  "zoho_products": ["Zoho CRM"],
  "user_count": 50,
  "industry": "Healthcare",
  "summary": "One sentence summary"
}

CONVERSATION FLOW:
- Rounds 1-2: Understand current pain & situation (be empathetic!)
- Rounds 3-4: Dig into specific needs, metrics, goals (ask smart questions!)
- Rounds 5-6: Verify understanding, fill gaps, then REQUIREMENTS_COMPLETE

QUALITY CHECKLIST BEFORE RESPONDING:
✓ Did I acknowledge what the user just said?
✓ Is my response natural and conversational (not robotic)?
✓ Am I asking ONE clear question (not a list)?
✓ Would a real human consultant say this?
✓ Am I being helpful and empathetic?`;

/* ══ BOOT ══ */
async function init() {
    initTheme();
    initPasswordToggle();
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
    showLdr('Connecting to portal…');
    try {
        allClients = await clients.list();
        setSS('ok', `Connected · ${allClients.length} clients loaded`);
        const activeAgent = localStorage.getItem('f_active_agent');
        if (activeAgent) {
            startStaffPortal(activeAgent);
        }
    } catch (e) {
        setSS('er', 'Could not connect to backend — is the server running?');
        console.error('[Boot]', e);
    }
    hideLdr();
}

async function bootClientSession(clientId) {
    showLdr('Loading your session…');
    try {
        allClients = await clients.list();
    } catch (e) {
        console.warn('[Boot] client list failed', e);
    }

    const found = allClients.find(c => (c.client_id || '').toLowerCase() === clientId.toLowerCase());
    if (found) {
        cli = found;
        await tracking.logEvent(clientId, 'bot_accessed');
        startSession();
    } else {
        show('L');
        setSS('er', 'Invalid session link. Contact Fristine Infotech.');
        document.getElementById('em').closest('.field').style.display = 'none';
        document.getElementById('pw').closest('.field').style.display = 'none';
        document.getElementById('loginBtn').style.display = 'none';
    }
    hideLdr();
}

/* ══ AUTH ══ */
function setSS(type, txt) {
    const el = document.getElementById('ss');
    el.className = 'conn-status ' + type;
    document.getElementById('stxt').textContent = txt;
    const dot = document.getElementById('sdot');
    dot.className = type === 'ok' ? 'cs-dot' : 'cs-dot spin';
}

document.getElementById('loginBtn').addEventListener('click', async () => {
    const em = document.getElementById('em').value.trim().toLowerCase();
    const pw = document.getElementById('pw').value.trim();
    const err = document.getElementById('lerr');
    err.textContent = '';

    if (!em.endsWith('@fristinetech.com')) {
        err.textContent = 'Access restricted to @fristinetech.com accounts.';
        return;
    }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.querySelector('span').textContent = 'Signing in…';

    try {
        const check = await auth.check(em);
        if (!check.hasPassword) {
            // First time — go to set password screen
            hide('L'); show('SP');
            document.getElementById('sp-email-show').textContent = `Setting up account for ${em}`;
            document.getElementById('SP').dataset.email = em;
            if (pw) document.getElementById('sp-pw1').value = pw;
            return;
        }

        await auth.login(em, pw);
        localStorage.setItem('f_active_agent', em);
        allClients = await clients.list();
        startStaffPortal(em);
    } catch (e) {
        if (e.data?.error === 'NO_PASSWORD') {
            hide('L'); show('SP');
            document.getElementById('sp-email-show').textContent = `Setting up account for ${em}`;
            document.getElementById('SP').dataset.email = em;
        } else if (e.data?.error === 'WRONG_PASSWORD') {
            err.textContent = 'Incorrect password. Use "Forgot Password?" to reset.';
        } else {
            err.textContent = e.message || 'Login failed. Is the backend running?';
        }
    } finally {
        btn.disabled = false; btn.querySelector('span').textContent = 'Sign In';
    }
});

document.getElementById('pw').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
});

document.getElementById('forgotLink').addEventListener('click', () => {
    hide('L'); show('FP');
    document.getElementById('fp-form-wrap').style.display = '';
    document.getElementById('fp-success').classList.add('hidden');
});

document.getElementById('setPwBtn').addEventListener('click', async () => {
    const email_ = document.getElementById('SP').dataset.email;
    const pw1 = document.getElementById('sp-pw1').value.trim();
    const pw2 = document.getElementById('sp-pw2').value.trim();
    const err = document.getElementById('sp-err');
    err.textContent = '';
    if (pw1.length < 8) { err.textContent = 'Password must be at least 8 characters.'; return; }
    if (pw1 !== pw2)    { err.textContent = 'Passwords do not match.'; return; }
    try {
        await auth.setPassword(email_, pw1);
        localStorage.setItem('f_active_agent', email_);
        allClients = await clients.list();
        hide('SP');
        startStaffPortal(email_);
    } catch (e) {
        err.textContent = e.message;
    }
});

document.getElementById('resetPwBtn').addEventListener('click', async () => {
    const em   = document.getElementById('fp-em').value.trim().toLowerCase();
    const pw1  = document.getElementById('fp-pw1').value.trim();
    const pw2  = document.getElementById('fp-pw2').value.trim();
    const err  = document.getElementById('fp-err');
    err.textContent = '';
    if (!em.endsWith('@fristinetech.com')) { err.textContent = 'Must be a @fristinetech.com email.'; return; }
    if (pw1.length < 8) { err.textContent = 'Password must be at least 8 characters.'; return; }
    if (pw1 !== pw2)    { err.textContent = 'Passwords do not match.'; return; }
    try {
        await auth.setPassword(em, pw1);
        document.getElementById('fp-form-wrap').style.display = 'none';
        document.getElementById('fp-success').classList.remove('hidden');
    } catch (e) {
        err.textContent = e.message;
    }
});

document.getElementById('backToLoginFromFP').addEventListener('click', () => { hide('FP'); show('L'); });
document.getElementById('backToLoginBtn2').addEventListener('click', () => { hide('FP'); show('L'); });

/* ══ STAFF PORTAL ══ */
async function startStaffPortal(agentEmail) {
    if (agentEmail) document.getElementById('agentChip').textContent = agentEmail.split('@')[0];
    hide('L'); hide('SP'); hide('FP');
    show('H');
    await renderClientTable();
}

async function renderClientTable(filter = '') {
    const tbody = document.getElementById('clientTableBody');
    try {
        allClients = await clients.list();
    } catch (e) {
        console.warn('[Table] Could not refresh clients:', e);
    }

    const filtered = filter
        ? allClients.filter(c =>
            (c.company || '').toLowerCase().includes(filter) ||
            (c.email || '').toLowerCase().includes(filter) ||
            (c.industry || '').toLowerCase().includes(filter))
        : allClients;

    document.getElementById('clientCount').textContent = `${allClients.length} clients in pipeline`;
    document.getElementById('statTotal').textContent = allClients.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="tbl-empty">${filter ? 'No results found.' : 'No clients yet. Add a lead to get started.'}</td></tr>`;
        document.getElementById('statSent').textContent = '0';
        document.getElementById('statActive').textContent = '0';
        document.getElementById('statProposal').textContent = '0';
        return;
    }

    let sentCount = 0, activeCount = 0, proposalCount = 0;
    tbody.innerHTML = '';

    for (const client of filtered) {
        const clientId = client.client_id || '';
        let evts = [];
        try { evts = await tracking.getEvents(clientId); } catch {}
        const status = getClientStatus(evts);

        if (status.sent)     sentCount++;
        if (status.active)   activeCount++;
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
                    <button class="btn-tbl btn-tbl-send">Send Bot</button>
                    <button class="btn-tbl btn-tbl-track">Track</button>
                    <button class="btn-tbl btn-tbl-del">Delete</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
        tr.querySelector('.btn-tbl-send').onclick  = () => sendBotEmail(clientId);
        tr.querySelector('.btn-tbl-track').onclick = () => openTracking(clientId);
        tr.querySelector('.btn-tbl-del').onclick   = () => deleteLead(clientId);
        tr.querySelector('.tbl-co-name').onclick   = () => openTracking(clientId);
    }

    document.getElementById('statSent').textContent    = sentCount;
    document.getElementById('statActive').textContent  = activeCount;
    document.getElementById('statProposal').textContent = proposalCount;
}

function getClientStatus(events) {
    const names = events.map(e => e.event);
    return {
        sent:     names.includes('bot_sent'),
        accessed: names.includes('bot_accessed'),
        active:   names.includes('conversation_started'),
        proposal: names.includes('proposal_generated'),
        submitted:names.includes('proposal_submitted'),
    };
}

function renderStatusBadge(s) {
    if (s.submitted) return '<span class="badge badge-done">✅ Submitted</span>';
    if (s.proposal)  return '<span class="badge badge-proposal">📄 Proposal Ready</span>';
    if (s.active)    return '<span class="badge badge-active">💬 In Session</span>';
    if (s.accessed)  return '<span class="badge badge-accessed">👁 Accessed</span>';
    if (s.sent)      return '<span class="badge badge-sent">📨 Sent</span>';
    return '<span class="badge badge-pending">⏳ Not Started</span>';
}

/* ── Search ── */
document.getElementById('searchInput').addEventListener('input', e => {
    renderClientTable(e.target.value.trim().toLowerCase());
});
document.getElementById('refreshBtn').addEventListener('click', () => renderClientTable());

/* ══ SEND BOT EMAIL ══ */
async function sendBotEmail(clientId) {
    const client = allClients.find(c => c.client_id === clientId);
    if (!client) return;
    const botUrl = `${DEPLOY_URL}/?client=${encodeURIComponent(clientId)}`;
    try {
        await email.sendBot(client.email, client.company, clientId, botUrl);
        await tracking.logEvent(clientId, 'bot_sent');
        showToast('📨 Bot link sent!', 'success');
        renderClientTable();
    } catch (e) {
        showToast('Failed to send email: ' + e.message, 'error');
    }
}

/* ══ LEAD MANAGEMENT ══ */
document.getElementById('openCreateBtn').addEventListener('click', async () => {
    openModal('createLeadModal');
    try {
        const data = await clients.nextId();
        document.getElementById('nl-id-preview').textContent = data.next_id;
    } catch {}
});

document.getElementById('closeCreateBtn').addEventListener('click', () => closeModal('createLeadModal'));
document.getElementById('cancelCreateBtn')?.addEventListener('click', () => closeModal('createLeadModal'));

window.previewClientId = function () {};

document.getElementById('saveLeadBtn').addEventListener('click', async () => {
    const co  = document.getElementById('nl-co').value.trim();
    const ind = document.getElementById('nl-ind').value.trim();
    const em  = document.getElementById('nl-em').value.trim();
    if (!co || !em) { showToast('Company and email are required.', 'error'); return; }

    const btn = document.getElementById('saveLeadBtn');
    btn.textContent = 'Saving…'; btn.disabled = true;
    try {
        await clients.create({ company: co, industry: ind, email: em });
        showToast('✅ Lead created!', 'success');
        closeModal('createLeadModal');
        ['nl-co', 'nl-ind', 'nl-em'].forEach(id => { document.getElementById(id).value = ''; });
        document.getElementById('nl-id-preview').textContent = '—';
        await renderClientTable();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    } finally {
        btn.textContent = 'Create Lead'; btn.disabled = false;
    }
});

async function deleteLead(clientId) {
    if (!confirm('Delete this lead? This cannot be undone.')) return;
    try {
        await clients.delete(clientId);
        showToast('Lead deleted.', 'success');
        renderClientTable();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

/* ══ TRACKING PAGE ══ */
async function openTracking(clientId) {
    const client = allClients.find(c => c.client_id === clientId);
    if (!client) return;
    currentTrackingClient = client;

    hide('H'); show('T');
    document.getElementById('trackingClientName').textContent = client.company || 'Client';
    document.getElementById('tClientIco').textContent  = (client.company || '?')[0].toUpperCase();
    document.getElementById('tClientName').textContent = client.company || '—';
    document.getElementById('tClientMeta').textContent = `${client.industry || '—'} · ${client.email || '—'}`;
    document.getElementById('tClientId').textContent   = `Client ID: ${clientId}`;

    showLdr('Loading tracking data…');
    let evts = [];
    try { evts = await tracking.getEvents(clientId); } catch {}
    hideLdr();

    renderPipeline(evts);
    renderEventLog(evts);

    const ps = document.getElementById('proposalSection');
    try { 
        const pData = await proposals.get(clientId); 
        if (pData && pData.versions && pData.versions.length > 0) {
            ps.style.display = 'block';
            let html = '<div class="section-title">Generated Proposals</div><div style="display:flex;flex-direction:column;gap:12px;">';
            
            const rev = [...pData.versions].reverse();
            rev.forEach(v => {
                const dateRaw = new Date(v.savedAt);
                const dateStr = isNaN(dateRaw) ? v.savedAt : dateRaw.toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
                
                html += `
                    <div class="proposal-banner">
                        <div class="proposal-banner-icon"><svg viewBox="0 0 20 20" fill="none" width="28"><rect x="5" y="4" width="10" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 2h4a1 1 0 011 1v1H7V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5"/><path d="M8 10h4M8 14h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>
                        <div class="proposal-banner-text">
                            <div class="proposal-banner-title">Version ${v.version} ${v.version === pData.versions.length ? '<span style="color:var(--green);font-size:11px;margin-left:6px">(Latest)</span>' : ''}</div>
                            <div class="proposal-banner-sub">${dateStr}</div>
                        </div>
                        <div class="proposal-banner-actions">
                            <button class="btn-primary btn-sm view-ver-btn" data-v="${v.version}">View Proposal</button>
                            <button class="btn-success btn-sm send-ver-btn" data-v="${v.version}">Mark Sent</button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            ps.innerHTML = html;
            
            ps.querySelectorAll('.view-ver-btn').forEach(btn => {
                btn.onclick = () => {
                    const ver = pData.versions.find(x => x.version == btn.dataset.v);
                    document.getElementById('proposalIframe').srcdoc = ver.proposal_html;
                    document.getElementById('proposalModal').dataset.version = ver.version;
                    openModal('proposalModal');
                };
            });
            ps.querySelectorAll('.send-ver-btn').forEach(btn => {
                btn.onclick = async () => {
                    await tracking.logEvent(clientId, 'proposal_submitted');
                    const evts2 = await tracking.getEvents(clientId);
                    renderPipeline(evts2);
                    renderEventLog(evts2);
                    showToast('✅ Marked Version ' + btn.dataset.v + ' as submitted!', 'success');
                };
            });
        } else {
            ps.style.display = 'none';
        }
    } catch {
        ps.style.display = 'none';
    }

    renderClientFiles(clientId);

    document.getElementById('resendBotBtn').onclick = () => sendBotEmail(clientId);
    document.getElementById('copyLinkBtn').onclick = () => {
        const url = `${DEPLOY_URL}/?client=${encodeURIComponent(clientId)}`;
        navigator.clipboard.writeText(url).then(() => {
            document.getElementById('copyLinkBtn').textContent = '✅ Copied!';
            setTimeout(() => { document.getElementById('copyLinkBtn').innerHTML = `<svg viewBox="0 0 20 20" fill="none" width="14" height="14"><rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M3 13V3h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Copy Link`; }, 2000);
        });
    };
}

function renderPipeline(evts) {
    const map = {};
    evts.forEach(e => { if (!map[e.event]) map[e.event] = e.timestamp; });
    const stages = [
        { key: 'bot_sent', id: 0 },
        { key: 'bot_accessed', id: 1 },
        { key: 'conversation_started', id: 2 },
        { key: 'proposal_generated', id: 3 },
        { key: 'proposal_submitted', id: 4 },
    ];
    stages.forEach(({ key, id }) => {
        const step = document.getElementById(`ps${id}`);
        const time = document.getElementById(`pt${id}`);
        const conn = document.getElementById(`pc${id-1}${id}`);
        if (map[key]) {
            step.classList.add('done'); step.classList.remove('active');
            time.textContent = formatTime(map[key]);
            if (conn) conn.classList.add('done');
        } else {
            step.classList.remove('done', 'active');
            time.textContent = '—';
        }
    });
}

function renderEventLog(evts) {
    const log = document.getElementById('eventLog');
    const labels = {
        'bot_sent':              '📨 Bot link sent to client',
        'bot_accessed':          '👁 Client accessed the bot',
        'conversation_started':  '💬 Client started a conversation',
        'proposal_generated':    '📄 Proposal generated',
        'proposal_submitted':    '✅ Proposal submitted to agent',
        'proposal_sent':         '📧 Proposal sent to client',
    };
    if (!evts.length) {
        log.innerHTML = '<div class="event-empty">No activity recorded yet.</div>';
        return;
    }
    log.innerHTML = [...evts].reverse().map(e => `
        <div class="event-row">
            <div class="event-icon">${(labels[e.event] || e.event).split(' ')[0]}</div>
            <div class="event-desc">${labels[e.event] || e.event}</div>
            <div class="event-time">${formatTime(e.timestamp)}</div>
        </div>`).join('');
}

function formatTime(ts) {
    try { return new Date(ts).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }); }
    catch { return ts || '—'; }
}

/* ══ CLIENT BOT SESSION ══ */
async function startSession() {
    hide('L'); show('A');
    document.getElementById('topco').textContent  = cli.company;
    document.getElementById('topco-ico').textContent = (cli.company || '?')[0].toUpperCase();
    document.getElementById('sbi').textContent    = cli.industry || 'Detecting…';
    document.getElementById('sbs').textContent    = cli.size || '—';

    const restored = activeClientId ? loadConversationMemory(activeClientId) : false;

    if (restored && convo.length > 0) {
        setStg(0, 'done'); setStg(1, 'done');
        if (prof) renderSidebar();
        const feed = document.getElementById('feed');
        feed.innerHTML = '';
        convo.forEach(msg => {
            if (msg.role === 'assistant') addAg(msg.content);
            else if (msg.role === 'user' && !msg.content.startsWith('[File uploaded:')) addUs(msg.content);
        });
        if (discoveryComplete && reqs) {
            setStg(2, 'done'); setStg(3, 'act');
            showReqSummary();
        } else {
            setStg(2, 'act'); setPhase('Discovery Phase');
            addAg(`Welcome back! I remember our conversation. Where were we — shall we continue?`);
        }
        return;
    }

    setStg(0, 'act'); setPhase('Researching your company…');
    showLdr('Researching ' + cli.company + '…');
    try {
        const res = await gem(
            `Research "${cli.company}". Industry: ${cli.industry}. Size: ${cli.size}.\nReturn JSON: {"industries":["..."],"description":"...","pain_points":["..."],"tech":"...","zoho_fit":["..."],"user_est":{"CRM":10}}`,
            1000, 0.3, false, [], ZK
        );
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
    return { industries: [cli.industry || 'Technology'], size: cli.size || 'Medium', pain_points: ['Process Optimisation'], tech: 'Medium', zoho_fit: ['Zoho CRM'], confirmed: cli.industry };
}

function getInds() {
    let inds = prof.industries || [];
    if (!inds.length) inds = (cli.industry || '').split(',').map(s => s.trim()).filter(Boolean);
    return [...new Set(inds)];
}

function askInd(inds) {
    addAg(`Welcome! I've researched <strong>${cli.company}</strong>. Which sector should we focus on today?`, { inds });
}

async function beginGather() {
    setStg(2, 'act'); setPhase('Discovery Phase: Requirements'); phase = 'gather';
    if (activeClientId) await tracking.logEvent(activeClientId, 'conversation_started').catch(() => {});
    showLdr('Tailoring consultation…');
    try {
        const open = await nextQ(true);
        addAg(open);
        convo.push({ role: 'assistant', content: open });
    } catch (e) {
        addAg(`I'm ready to dive in! Based on our research into ${cli.company}, what are the high-priority challenges you'd like to solve?`);
    }
    hideLdr();
}

async function nextQ(isOpen = false) {
    const sys = `${ZK}\n\nRESEARCH CONTEXT for ${cli.company}:\n${JSON.stringify(prof)}\n${fileContent ? `UPLOADED FILE:\n${fileContent}\n` : ''}`;
    let turnPrompt = isOpen
        ? `Initialize the session for ${cli.company}. Greet them warmly and ask "What type of help do you need today?"`
        : `Round: ${rn}/6. ${rn >= 5 ? 'Summarize requirements and output REQUIREMENTS_COMPLETE + JSON now.' : 'Continue discovery. Limit to 3-4 sentences. Seek success metrics or pain points.'}`;

    return await gem(turnPrompt, 1000, 0.7, rn >= 5, convo, sys);
}

/* ── File upload ── */
document.getElementById('fileBtn').onclick = () => document.getElementById('fileIn').click();

document.getElementById('fileIn').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    showLdr(`Reading ${f.name}…`);
    addUs(`[Uploaded: ${f.name}]`);

    try {
        if (f.type.startsWith('image/') || f.type === 'application/pdf') {
            const base64 = await readBase64(f);
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=`, {
                method: 'POST',
                body: JSON.stringify({
                    contents: [{ parts: [{ inline_data: { mime_type: f.type, data: base64 } }, { text: `Extract ALL business requirements from this file.` }] }],
                    generationConfig: { maxOutputTokens: 2000, temperature: 0.2 }
                })
            });
            // Note: for images/PDFs, route through backend proxy which has the key
            const extractResp = await gem(
                `I'm uploading file: ${f.name}. File type: ${f.type}. Please acknowledge and ask for key requirements.`,
                500, 0.5, false, [], ZK
            );
            fileContent = `[File: ${f.name}]`;
        } else if (f.name.endsWith('.docx')) {
            const arr = await readArrayBuffer(f);
            const result = await mammoth.extractRawText({ arrayBuffer: arr });
            fileContent = result.value.slice(0, 8000);
        } else {
            fileContent = await readText(f);
            if (fileContent.length > 8000) fileContent = fileContent.slice(0, 8000) + '\n...[truncated]';
        }

        saveFileToMemory(activeClientId, { name: f.name, type: f.type, size: f.size }, fileContent);
        convo.push({ role: 'user', content: `[File uploaded: ${f.name}]\n\nFile contents:\n${fileContent}` });

        hideLdr();
        showLdr('Analysing document…');
        rn++;
        const sys = `${ZK}\nRESEARCH CONTEXT for ${cli.company}:\n${JSON.stringify(prof)}\nRound: ${rn}/6`;
        const resp = await gem(
            `${sys}\n\nThe client uploaded "${f.name}".\nFILE CONTENTS:\n${fileContent}\n\nAcknowledge the file, summarise key requirements in 2-3 sentences, then ask ONE sharp follow-up question. If requirements are comprehensive, output REQUIREMENTS_COMPLETE + JSON.`,
            1500, 0.5
        );
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
        addAg(`I've received your file <strong>${f.name}</strong>. Could you summarise the key requirements or challenges it covers?`);
    }
    e.target.value = '';
};

function readBase64(f) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = ev => res(ev.target.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(f);
    });
}
function readArrayBuffer(f) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = ev => res(ev.target.result);
        r.onerror = rej;
        r.readAsArrayBuffer(f);
    });
}
function readText(f) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = ev => res(ev.target.result);
        r.onerror = rej;
        r.readAsText(f);
    });
}

/* ── Send message ── */
document.getElementById('sendBtn').addEventListener('click', async () => {
    const inp = document.getElementById('msgIn');
    const msg = inp.value.trim();
    if (!msg) return;
    if (discoveryComplete) discoveryComplete = false;
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
            reqs = safeJ(parts[1]) || { summary: 'Requirement analysis complete', must_have: ['Zoho One'] };
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
            addAg('Could you clarify your current setup a bit more?');
        }
    }
    hideLdr();
});

document.getElementById('msgIn').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('sendBtn').click();
});

/* ══ MIC ══ */
(function initMic() {
    const micBtn = document.getElementById('micBtn');
    if (!micBtn) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { micBtn.style.opacity = '.3'; micBtn.style.cursor = 'not-allowed'; return; }
    const recognition = new SR();
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'en-IN';
    let listening = false, finalT = '';

    micBtn.addEventListener('click', () => {
        if (discoveryComplete) return;
        if (listening) { recognition.stop(); return; }
        finalT = '';
        try { recognition.start(); } catch {}
    });

    recognition.onstart = () => {
        listening = true;
        micBtn.classList.add('mic-listening');
        document.getElementById('msgIn').placeholder = '🎤 Listening…';
    };
    recognition.onresult = (e) => {
        let interim = ''; finalT = '';
        for (let i = 0; i < e.results.length; i++) {
            if (e.results[i].isFinal) finalT += e.results[i][0].transcript;
            else interim += e.results[i][0].transcript;
        }
        document.getElementById('msgIn').value = finalT || interim;
    };
    recognition.onend = () => {
        listening = false;
        micBtn.classList.remove('mic-listening');
        document.getElementById('msgIn').placeholder = 'Type your response…';
        if (finalT.trim()) {
            document.getElementById('msgIn').value = finalT.trim();
            setTimeout(() => { if (!listening && document.getElementById('msgIn').value.trim()) document.getElementById('sendBtn').click(); }, 2000);
        }
    };
    recognition.onerror = (e) => {
        listening = false;
        micBtn.classList.remove('mic-listening');
        document.getElementById('msgIn').placeholder = 'Type your response…';
        if (e.error === 'not-allowed') alert('Microphone access denied. Please allow it in browser settings.');
    };
})();

/* ══ CONVERSATION MEMORY ══ */
function saveConversationMemory() {
    if (!activeClientId) return;
    localStorage.setItem(`session_${activeClientId}`, JSON.stringify({
        convo, reqs, sol, prof, rn, fileContent: fileContent.slice(0, 4000), discoveryComplete, ts: Date.now()
    }));
}

function loadConversationMemory(clientId) {
    const saved = localStorage.getItem(`session_${clientId}`);
    if (!saved) return false;
    try {
        const m = JSON.parse(saved);
        if (Date.now() - m.ts > 7 * 86400000) return false;
        ({ convo, reqs, sol, prof, rn, fileContent, discoveryComplete } = {
            convo: m.convo || [], reqs: m.reqs || null, sol: m.sol || null,
            prof: m.prof || null, rn: m.rn || 0,
            fileContent: m.fileContent || '', discoveryComplete: m.discoveryComplete || false
        });
        return true;
    } catch { return false; }
}

function saveFileToMemory(clientId, meta, content) {
    const key = `files_${clientId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = existing.findIndex(f => f.name === meta.name);
    const entry = { ...meta, content: content.slice(0, 5000), ts: Date.now() };
    if (idx >= 0) existing[idx] = entry; else existing.push(entry);
    localStorage.setItem(key, JSON.stringify(existing));
}

function renderClientFiles(clientId) {
    const container = document.getElementById('clientFilesSection');
    if (!container) return;
    const files = JSON.parse(localStorage.getItem(`files_${clientId}`) || '[]');
    if (!files.length) { container.style.display = 'none'; return; }
    container.style.display = 'block';
    document.getElementById('filesList').innerHTML = files.map(f => `
        <div class="file-row">
            <div class="file-icon">${f.type?.startsWith('image/') ? '🖼️' : f.type === 'application/pdf' ? '📄' : '📁'}</div>
            <div><div class="file-name">${f.name}</div><div class="file-meta">${(f.size/1024).toFixed(1)}KB · ${new Date(f.ts).toLocaleString()}</div></div>
        </div>`).join('');
}

/* ══ REQUIREMENTS SUMMARY ══ */
function showReqSummary() {
    if (!reqs) reqs = { summary: 'Ready to proceed.', must_have: [] };
    setStg(2, 'done'); setStg(3, 'act'); setPhase('Reviewing Requirements…');
    saveConversationMemory();

    const makeChips = (arr) => (arr || []).map(t => `<span class="reqs-chip">${t}</span>`).join('');
    const makeList  = (arr) => (arr || []).map(i => `<li>${i}</li>`).join('');

    const html = `
    <div class="reqcard-full">
      <div class="reqcard-intro">
        Here's a complete summary of everything we've captured. Please review carefully — if this accurately reflects your requirements, confirm and I'll generate your formal proposal.
        If anything needs changing, let me know.
      </div>
      <div class="reqcard-box">
        <div class="reqcard-title">📋 Requirements Summary — ${cli?.company || ''}</div>
        ${reqs.business_overview ? `<div class="reqs-section"><div class="reqs-label">Business Overview</div><div class="reqs-text">${reqs.business_overview}</div></div>` : ''}
        ${(reqs.departments||[]).length ? `<div class="reqs-section"><div class="reqs-label">Departments</div><div class="reqs-chips">${makeChips(reqs.departments)}</div></div>` : ''}
        ${(reqs.current_tools||[]).length ? `<div class="reqs-section"><div class="reqs-label">Current Tools</div><div class="reqs-chips">${makeChips(reqs.current_tools)}</div></div>` : ''}
        ${(reqs.pain_points||[]).length ? `<div class="reqs-section"><div class="reqs-label">Pain Points</div><ul class="reqs-list">${makeList(reqs.pain_points)}</ul></div>` : ''}
        ${(reqs.must_have||[]).length ? `<div class="reqs-section"><div class="reqs-label">Must-Have Requirements</div><ul class="reqs-list">${makeList(reqs.must_have)}</ul></div>` : ''}
        ${(reqs.nice_to_have||[]).length ? `<div class="reqs-section"><div class="reqs-label">Nice to Have</div><ul class="reqs-list">${makeList(reqs.nice_to_have)}</ul></div>` : ''}
        ${(reqs.integrations||[]).length ? `<div class="reqs-section"><div class="reqs-label">Integrations</div><ul class="reqs-list">${makeList(reqs.integrations)}</ul></div>` : ''}
        ${(reqs.success_metrics||[]).length ? `<div class="reqs-section"><div class="reqs-label">Success Metrics</div><ul class="reqs-list">${makeList(reqs.success_metrics)}</ul></div>` : ''}
        <div class="reqs-actions">
          <button class="reqs-btn-confirm" id="confirmProposal">✅ Confirmed — Generate Proposal</button>
          <button class="reqs-btn-clarify" id="clarifyBtn">✏️ Add / Clarify</button>
          <button class="reqs-btn-wrong"   id="wrongBtn">❌ Not Right</button>
        </div>
      </div>
    </div>`;

    addAg(html, { noEscape: true });
    setTimeout(() => {
        document.getElementById('confirmProposal')?.addEventListener('click', buildSolution);
        document.getElementById('clarifyBtn')?.addEventListener('click', () => {
            discoveryComplete = false;
            addAg('Of course! What would you like to add or clarify?');
            document.getElementById('msgIn').focus();
        });
        document.getElementById('wrongBtn')?.addEventListener('click', () => {
            discoveryComplete = false; reqs = null;
            addAg("No problem — let's revisit. What didn't look right?");
            document.getElementById('msgIn').focus();
        });
    }, 100);
}

async function buildSolution() {
    setStg(3, 'done'); setStg(4, 'act'); setPhase('Architecting Proposal…');
    const steps = [
        { pct: 15, txt: 'Analysing discovery profile…' },
        { pct: 35, txt: 'Mapping to Zoho modules…' },
        { pct: 60, txt: 'Structuring implementation plan…' },
        { pct: 80, txt: 'Finalising proposal…' },
    ];
    try {
        for (const s of steps) { showLdr(s.txt, s.pct); await sleep(600 + Math.random() * 300); }
        const res = await gem(
            `DESIGN ZOHO SOLUTION FOR ${cli.company} BASED ON: ${JSON.stringify(reqs)}\nCRITICAL: RETURN ONLY RAW JSON. NO MARKDOWN. SCHEMA: {"primary_products":["..."],"implementation_phases":[{"name":"...","duration":"..."}],"team_structure":"...","monthly_cost":"...","workflow":[{"step":"1","name":"...","description":"..."}]}\n\nCRITICAL: YOU MUST INCLUDE THE FOLLOWING SPECIFIC WORKFLOWS IN THE "workflow" ARRAY (adapt specific names/steps to the client but keep the core meaning):\n1) Marketing Drip & Lead Scoring\n2) Multi-Channel Lead Routing\n3) S0-S4 Opportunity Pipeline\n4) QDE Onboarding & Locker Management System\n5) Mutual Fund Folios Integration`,
            2000, 0.4, true
        );
        sol = safeJ(res);
        if (!sol) throw new Error('Bad JSON from AI');
        hideLdr(); setStg(4, 'done');
        addAg('Your Zoho Transformation Roadmap is ready!', { video: true });
        openModal('videoModal');
    } catch (e) {
        // Heuristic fallback
        const products = [];
        if (reqs.must_have?.some(m => /crm|sales|lead/i.test(m))) products.push('Zoho CRM');
        if (reqs.must_have?.some(m => /account|book|invoice|tax/i.test(m))) products.push('Zoho Books');
        if (reqs.must_have?.some(m => /support|desk|ticket/i.test(m))) products.push('Zoho Desk');
        if (products.length === 0) products.push('Zoho One');
        sol = {
            primary_products: products,
            implementation_phases: [{ name: 'Requirement & FSD', duration: '2 Weeks' }, { name: 'Configuration', duration: '4 Weeks' }, { name: 'UAT & Training', duration: '2 Weeks' }],
            team_structure: '1 Sr. BA, 1 Developer, 1 QA', monthly_cost: 'Based on User Count',
            workflow: [
                { step: '1', name: 'Marketing Drip & Lead Scoring', description: 'Automated engagement and prioritization.' },
                { step: '2', name: 'Multi-Channel Lead Routing', description: 'Assigning leads based on territory and skill.' },
                { step: '3', name: 'S0-S4 Opportunity Pipeline', description: 'Standardized sales stages from qualification to closure.' },
                { step: '4', name: 'QDE Onboarding & Locker Management', description: 'Quick Data Entry and secure document handling.' },
                { step: '5', name: 'Mutual Fund Folios Integration', description: 'Syncing investment data with client profiles.' }
            ]
        };
        hideLdr(); setStg(4, 'done');
        addAg(`I've architected a preliminary Zoho Roadmap based on your requirements.`, { video: true });
        openModal('videoModal');
    }
}

async function generateProposal() {
    showLdr('Generating proposal…');
    const fname   = `Zoho_Proposal_${(cli.company||'Client').replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.html`;
    const dateStr = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    const mustHaves  = reqs.must_have || ['Zoho Implementation'];
    const products   = reqs.zoho_products || sol?.primary_products || ['Zoho CRM'];
    const userCount  = reqs.user_count || '—';
    const industry   = reqs.industry || cli.industry || '—';
    const integrations = reqs.integrations || [];
    const workflows  = sol?.workflow || sol?.workflows || [
        { step: '1', name: 'Marketing Drip & Lead Scoring', description: 'Automated engagement and prioritization.' },
        { step: '2', name: 'Multi-Channel Lead Routing', description: 'Assigning leads based on territory and skill.' },
        { step: '3', name: 'S0-S4 Opportunity Pipeline', description: 'Standardized sales stages from qualification to closure.' },
        { step: '4', name: 'QDE Onboarding & Locker Management', description: 'Quick Data Entry and secure document handling.' },
        { step: '5', name: 'Mutual Fund Folios Integration', description: 'Syncing investment data with client profiles.' }
    ];

    const scopeRows = mustHaves.map(m => `<tr><td>${m}</td><td><span class="badge-config">Configuration</span></td><td>Business Team</td><td><ul style="margin:0;padding-left:16px;font-size:12.5px;color:#4F6282"><li>Configure module per requirements</li><li>Workflows, validations, custom fields</li><li>Role-based access and reporting</li></ul></td></tr>`).join('');
    const intgRows   = integrations.map(i => `<tr><td>${i}</td><td><span class="badge-custom">Customization</span></td><td>IT / Admin</td><td><ul style="margin:0;padding-left:16px;font-size:12.5px;color:#4F6282"><li>Integrate ${i} with Zoho</li><li>Configure data sync</li><li>End-to-end testing</li></ul></td></tr>`).join('');
    const wfRows     = workflows.map(w => `<tr><td style="font-weight:700;color:#1A4FD6;text-align:center;width:40px">${w.step}</td><td style="font-weight:600">${w.name}</td><td style="color:#4F6282">${w.description}</td></tr>`).join('');

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Zoho Proposal — ${cli.company}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;color:#1A2540;line-height:1.6;background:#f5f7fa}
.page{max-width:960px;margin:0 auto;background:#fff;box-shadow:0 4px 40px rgba(0,0,0,.1)}
.cover{background:#fff;padding:60px;border-bottom:4px solid #1A4FD6}
.cover-logo{display:flex;align-items:center;gap:10px;margin-bottom:40px}
.cover-logo-box{width:36px;height:36px;background:#1A4FD6;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px}
.cover-logo-name{font-weight:700;font-size:14px;color:#1A4FD6}
h1{font-size:32px;font-weight:800;color:#1A4FD6;margin-bottom:10px}
.client-name{font-size:24px;font-weight:700;margin-bottom:8px}
.subtitle{font-size:14px;color:#4F6282;margin-bottom:40px}
.cover-hero{width:100%;height:140px;background:linear-gradient(135deg,#EEF4FF,#C8DAFF);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:52px;opacity:.6;margin-bottom:40px}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:1px solid #E8EFF8;padding-top:24px}
.meta-item label{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#7A91B3;display:block;margin-bottom:3px}
.meta-item span{font-size:14px;font-weight:600;color:#1A2540}
.section{padding:48px 60px;border-top:1px solid #E8EFF8}
.sec-head{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.sec-num{width:32px;height:32px;background:#1A4FD6;border-radius:8px;color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center}
.sec-title{font-size:20px;font-weight:700;color:#1A4FD6}
p{font-size:14px;color:#4F6282;line-height:1.75;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px}
thead tr{background:#0B1120}
th{padding:12px 14px;text-align:left;font-size:11px;font-weight:700;color:rgba(255,255,255,.75);text-transform:uppercase;letter-spacing:.5px}
td{padding:12px 14px;border-bottom:1px solid #E8EFF8;vertical-align:top}
tr:last-child td{border-bottom:none}
tr:nth-child(even) td{background:#FAFBFD}
.badge-config{background:#EEF4FF;color:#1A4FD6;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px}
.badge-custom{background:#FFF3E0;color:#E65100;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px}
.badge-tm{background:#E8F5E9;color:#2E7D32;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px}
.about-box{background:linear-gradient(135deg,#0B1120,#132040);border-radius:14px;padding:28px 32px;margin-bottom:20px}
.about-box p{color:rgba(255,255,255,.7);margin-bottom:0}
.awards{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}
.award{background:#1A4FD6;color:#fff;font-size:12px;font-weight:600;padding:7px 14px;border-radius:10px}
.clients-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.client-tag{background:#EEF4FF;color:#1A4FD6;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;border:1px solid #C8DAFF}
ul.bullets{padding-left:20px}
ul.bullets li{font-size:13.5px;color:#4F6282;margin-bottom:8px}
.acceptance-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:16px}
.acceptance-col label{font-weight:700;font-size:14px;color:#1A2540;display:block;margin-bottom:16px}
.sign-line{border-bottom:1px solid #CBD5E1;margin-bottom:12px;height:40px}
.sign-field{font-size:12px;color:#7A91B3;margin-bottom:12px}
.footer{background:#0B1120;padding:24px 60px;display:flex;align-items:center;justify-content:space-between}
.footer-logo{display:flex;align-items:center;gap:8px}
.footer-logo-box{width:28px;height:28px;background:#1A4FD6;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#fff}
.footer-brand{font-size:13px;font-weight:600;color:rgba(255,255,255,.65)}
.footer-conf{color:rgba(255,255,255,.3);font-size:12px}
.editable-price{cursor:pointer;border-bottom:1px dashed #A0AEC0;font-weight:700;color:#1A4FD6;transition:all .2s}
.editable-price:focus{background:#EEF4FF;outline:none}
</style></head><body><div class="page">
<div class="cover">
  <div class="cover-logo"><div class="cover-logo-box">F</div><div class="cover-logo-name">FRISTINE INFOTECH</div></div>
  <h1>Zoho Implementation Proposal For</h1>
  <div class="client-name">${cli.company}</div>
  <div class="subtitle">${industry} · Prepared by Fristine Infotech Presales Team</div>
  <div class="cover-hero">📊 ⚙️ 🚀</div>
  <div class="meta-grid">
    <div class="meta-item"><label>Date</label><span>${dateStr}</span></div>
    <div class="meta-item"><label>Prepared For</label><span>${cli.company}</span></div>
    <div class="meta-item"><label>Prepared By</label><span>Fristine Infotech Presales</span></div>
    <div class="meta-item"><label>Contact</label><span>presales@fristinetech.com</span></div>
  </div>
</div>

<div class="section">
  <div class="sec-head"><div class="sec-num">1</div><div class="sec-title">About Fristine Infotech</div></div>
  <div class="about-box"><p>Fristine Infotech is India's leading Premium Zoho Partner helping clients across markets, industries & geographies solve complex business problems through bespoke Zoho implementations.</p></div>
  <p>Over <strong>10 years</strong> and <strong>200+ implementations</strong> across Marketing, Sales, Operations, Finance, and Support.</p>
  <div class="awards"><div class="award">🏆 Zoho Creator Partner Award 2021 — Innovator of the Year</div><div class="award">🌏 Regional Champion — Australia & New Zealand</div></div>
  <p style="font-weight:600;color:#1A2540;margin-bottom:8px">Our Clients:</p>
  <div class="clients-grid">${['eBay','Pepperfry','Edelweiss','YES Securities','NPCI','Jio','Suzlon','Mercedes-Benz','Samsonite','TATA MD','CARE Ratings','CRISIL','TeamLease','Transasia'].map(c=>`<span class="client-tag">${c}</span>`).join('')}</div>
</div>

<div class="section">
  <div class="sec-head"><div class="sec-num">2</div><div class="sec-title">Proposal & Scope of Work</div></div>
  <p><strong>${cli.company}</strong> is looking to implement <strong>${products.join(', ')}</strong> to digitalise and optimise its business processes.</p>
  ${products.map(prod=>`<p style="font-weight:700;color:#0B1120;font-size:14px;margin-top:20px;margin-bottom:10px">${prod}</p><table><thead><tr><th>Requirement</th><th>Status</th><th>User Persona</th><th>Fristine Remark</th></tr></thead><tbody>${scopeRows}</tbody></table>`).join('')}
  ${intgRows?`<p style="font-weight:700;color:#0B1120;font-size:14px;margin-top:20px;margin-bottom:10px">Integrations</p><table><thead><tr><th>Requirement</th><th>Status</th><th>User Persona</th><th>Fristine Remark</th></tr></thead><tbody>${intgRows}</tbody></table>`:''}
  <p style="font-weight:700;color:#0B1120;font-size:14px;margin-top:20px;margin-bottom:10px">Training & UAT</p>
  <table><thead><tr><th>Requirement</th><th>Status</th><th>User Persona</th><th>Fristine Remark</th></tr></thead><tbody><tr><td>User Training, Help Document & UAT</td><td><span class="badge-tm">Time & Material</span></td><td>IT / Admin Team</td><td><ul style="margin:0;padding-left:16px;font-size:12.5px;color:#4F6282"><li>UAT</li><li>User Training</li><li>Help Documentation</li></ul></td></tr></tbody></table>
</div>

<div class="section">
  <div class="sec-head"><div class="sec-num" style="background:#0B1120">W</div><div class="sec-title" style="color:#0B1120">Proposed Process Workflows</div></div>
  <table style="margin-top:16px"><thead style="background:#1A4FD6"><tr><th style="color:#fff;text-align:center">Step</th><th style="color:#fff">Workflow</th><th style="color:#fff">Description</th></tr></thead><tbody>${wfRows}</tbody></table>
</div>

<div class="section">
  <div class="sec-head"><div class="sec-num">3</div><div class="sec-title">Project Team</div></div>
  <table><thead><tr><th>#</th><th>Role</th><th>Description</th></tr></thead><tbody>
    <tr><td>1</td><td><strong>CTO</strong></td><td>Architecture and risk mitigation accountability.</td></tr>
    <tr><td>2</td><td><strong>Project Manager</strong></td><td>Overall project outcomes and day-to-day progress.</td></tr>
    <tr><td>3</td><td><strong>Sr Business Analyst</strong></td><td>Functional requirements, user training, and backlog management.</td></tr>
    <tr><td>4</td><td><strong>Jr Business Analyst</strong></td><td>Documentation assistance and requirements support.</td></tr>
    <tr><td>5</td><td><strong>Sr Developer</strong></td><td>Quality development and implementation tasks.</td></tr>
    <tr><td>6</td><td><strong>QA / Tester</strong></td><td>Test planning, execution, and quality assurance.</td></tr>
  </tbody></table>
</div>

<div class="section">
  <div class="sec-head"><div class="sec-num">4</div><div class="sec-title">Escalation Process</div></div>
  <table><thead><tr><th>#</th><th>Escalation Level</th><th>Response Time</th></tr></thead><tbody>
    <tr><td>1</td><td>Level 1 — Sr Business Analyst</td><td>4 Hours</td></tr>
    <tr><td>2</td><td>Level 2 — CTO</td><td>1 Business Day</td></tr>
    <tr><td>3</td><td>Level 3 — CEO</td><td>3 Business Days</td></tr>
  </tbody></table>
</div>

<div class="section">
  <div class="sec-head"><div class="sec-num">5</div><div class="sec-title">Commercials</div></div>
  <p style="font-weight:700;color:#0B1120;margin-bottom:10px">Software License</p>
  <table><thead><tr><th>#</th><th>Product</th><th>Users</th><th>Billing</th><th>Amount (INR)</th></tr></thead><tbody>
    ${products.map((p,i)=>`<tr><td>${i+1}</td><td>${p}</td><td>${userCount}</td><td>Annual</td><td contenteditable="true" class="editable-price">₹ (To be quoted)</td></tr>`).join('')}
  </tbody></table>
  <p style="font-size:12px;color:#7A91B3;margin-bottom:20px">Pricing exclusive of GST</p>
  <p style="font-weight:700;color:#0B1120;margin-bottom:10px">Implementation</p>
  <table><thead><tr><th>#</th><th>Particulars</th><th>Type</th><th>Est. Hours</th><th>Amount (INR)</th></tr></thead><tbody>
    <tr><td>1</td><td>Requirement Gathering & FSD</td><td><span class="badge-config">Project-based</span></td><td>NA</td><td contenteditable="true" class="editable-price">₹ (To be quoted)</td></tr>
    <tr><td>2</td><td>${products.join(' & ')} Implementation</td><td><span class="badge-config">Project-based</span></td><td>NA</td><td contenteditable="true" class="editable-price">₹ (To be quoted)</td></tr>
    <tr><td>3</td><td>Data Migration</td><td><span class="badge-tm">T&M</span></td><td>4 days</td><td contenteditable="true" class="editable-price">₹ (To be quoted)</td></tr>
    <tr><td>4</td><td>30-day Hypercare</td><td><span class="badge-config">Project-based</span></td><td>NA</td><td contenteditable="true" class="editable-price">₹ (To be quoted)</td></tr>
    <tr style="background:#EEF4FF"><td colspan="4" style="font-weight:700;color:#1A4FD6;font-size:14px">Total [Excl. GST]</td><td contenteditable="true" class="editable-price">₹ (To be quoted)</td></tr>
  </tbody></table>
</div>

<div class="section">
  <div class="sec-head"><div class="sec-num">6</div><div class="sec-title">Constraints & Assumptions</div></div>
  <ul class="bullets">
    <li>Delivery dates may change based on stakeholder responsiveness.</li>
    <li>Third-party integrations depend on external API capabilities.</li>
    <li>Zoho plan limits on records/storage may require add-ons.</li>
    <li>Final scope confirmed through FSD sign-off.</li>
    <li>Clean, validated data to be provided by ${cli.company} for migration.</li>
  </ul>
</div>

<div class="section">
  <div class="sec-head"><div class="sec-num">7</div><div class="sec-title">Acceptance</div></div>
  <div class="acceptance-grid">
    <div class="acceptance-col"><label>For Fristine Infotech Pvt Ltd</label><div class="sign-line"></div><div class="sign-field">Signature:</div><div class="sign-line"></div><div class="sign-field">Name:</div><div class="sign-line"></div><div class="sign-field">Date:</div></div>
    <div class="acceptance-col"><label>For ${cli.company}</label><div class="sign-line"></div><div class="sign-field">Signature:</div><div class="sign-line"></div><div class="sign-field">Name:</div><div class="sign-line"></div><div class="sign-field">Date:</div></div>
  </div>
</div>

<div class="footer">
  <div class="footer-logo"><div class="footer-logo-box">F</div><div class="footer-brand">Fristine Infotech · India's Leading Premium Zoho Partner</div></div>
  <div class="footer-conf">Confidential · ${new Date().getFullYear()}</div>
</div>
</div></body></html>`;

    if (activeClientId) {
        try { await proposals.save(activeClientId, html, `Proposal — ${cli.company}`); } catch {}
        try { await tracking.logEvent(activeClientId, 'proposal_generated'); } catch {}
        try { await tracking.logEvent(activeClientId, 'proposal_submitted'); } catch {}
    }

    pendingBlob = new Blob([html], { type: 'text/html' });
    pendingName = fname;
    hideLdr();

    addAg(`
        <div class="reqcard-box" style="text-align:center;padding:28px 20px;">
            <div style="font-size:48px;margin-bottom:14px">🎉</div>
            <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:700;margin-bottom:10px">Your Zoho Proposal is Ready!</div>
            <div style="font-size:13px;color:var(--sub);line-height:1.75;max-width:360px;margin:0 auto 20px">
                Your requirements have been mapped and your strategic Zoho roadmap generated.<br/>
                <strong>Download your formal proposal below. A Fristine specialist will follow up shortly.</strong>
            </div>
            <button class="btn-primary" onclick="document.dispatchEvent(new Event('downloadClientProposal'))" style="margin:0 auto">
                Download Proposal 📄
            </button>
        </div>`, { noEscape: true });
}

document.addEventListener('downloadClientProposal', async () => {
    if (!pendingBlob) return;
    
    // Convert the HTML blob text into a PDF using html2pdf
    const htmlText = await pendingBlob.text();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlText;
    
    const opt = {
        margin: 0,
        filename: pendingName.replace('.html', '.pdf'),
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    // Use a small loader
    showLdr('Exporting PDF…');
    html2pdf().set(opt).from(tempDiv.firstChild).save().then(() => {
        hideLdr();
    });
});

/* ══ MODALS ══ */
function openModal(id)  { document.getElementById(id).classList.add('visible'); }
function closeModal(id) { document.getElementById(id).classList.remove('visible'); }

document.getElementById('closeVideoBtn').addEventListener('click', () => { closeModal('videoModal'); generateProposal(); });
document.getElementById('playBtn')?.addEventListener('click', () => {
    const vpInner = document.querySelector('.vp-inner');
    if (vpInner && !vpInner.querySelector('video')) {
        vpInner.innerHTML = `<video width="100%" height="100%" controls autoplay style="border-radius:12px;background:#000;">
                                <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4">
                                Your browser does not support HTML video.
                             </video>`;
    }
});
document.getElementById('closeProposalBtn').addEventListener('click',  () => closeModal('proposalModal'));
document.getElementById('closeProposalBtn2')?.addEventListener('click', () => closeModal('proposalModal'));

document.getElementById('saveProposalEditsBtn')?.addEventListener('click', async () => {
    const cid  = currentTrackingClient?.client_id || activeClientId;
    if (!cid) return;
    const iframe = document.getElementById('proposalIframe');
    const updatedHtml = iframe.contentDocument.documentElement.outerHTML;
    const verId = document.getElementById('proposalModal').dataset.version;
    try {
        await proposals.update(cid, updatedHtml, verId ? parseInt(verId) : null);
        showToast(`💾 Saved Version ${verId || 'Latest'}!`, 'success');
    } catch { showToast('Save failed', 'error'); }
});

document.getElementById('downloadProposalBtn')?.addEventListener('click', async () => {
    if (!currentTrackingClient) return;
    try {
        const pData = await proposals.get(currentTrackingClient.client_id);
        const verId = document.getElementById('proposalModal').dataset.version;
        const pVer = verId ? pData.versions.find(x => x.version == parseInt(verId)) : pData.versions[pData.versions.length-1];
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = pVer ? pVer.proposal_html : '';
        
        const opt = {
            margin: 0,
            filename: `Proposal_${currentTrackingClient.company}_v${verId||pData.versions.length}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        const btn = document.getElementById('downloadProposalBtn');
        const ogText = btn.textContent;
        btn.textContent = 'Exporting...';
        btn.disabled = true;

        html2pdf().set(opt).from(tempDiv.firstChild).save().then(() => {
            btn.textContent = ogText;
            btn.disabled = false;
        });
    } catch { showToast('No proposal found', 'error'); }
});

/* ══ LOGOUT / BACK ══ */
document.getElementById('staffLogout').addEventListener('click', () => { localStorage.removeItem('f_active_agent'); location.reload(); });
document.getElementById('logoutBtn').addEventListener('click', () => { window.location.href = window.location.pathname; });
document.getElementById('trackLogout').addEventListener('click', () => { localStorage.removeItem('f_active_agent'); location.reload(); });
document.getElementById('backToDashBtn').addEventListener('click', () => { hide('T'); show('H'); renderClientTable(); });

/* ══ THEME ══ */
function initTheme() {
    const saved = localStorage.getItem('f_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    ['themeToggleH', 'themeToggleT', 'themeToggleA', 'themeToggleL'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.onclick = toggleTheme;
    });
}
function toggleTheme() {
    const cur  = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('f_theme', next);
}

/* ══ PASSWORD TOGGLE ══ */
function initPasswordToggle() {
    document.getElementById('pwToggle')?.addEventListener('click', () => {
        const inp = document.getElementById('pw');
        inp.type = inp.type === 'password' ? 'text' : 'password';
    });
}

/* ══ UI HELPERS ══ */
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

function showLdr(txt, pct = null) {
    const l  = document.getElementById('ldr');
    l.classList.remove('hidden');
    document.getElementById('ltxt').textContent = txt;
    const pb = document.getElementById('ldrPb');
    if (pb) { pb.style.display = pct !== null ? 'block' : 'none'; if (pct !== null) pb.style.width = pct + '%'; }
}
function hideLdr() { document.getElementById('ldr').classList.add('hidden'); }

function setStg(i, st) {
    const d = document.getElementById('s' + i), l = document.getElementById('sl' + i);
    if (!d || !l) return;
    d.className = 'stage-num ' + st;
    l.className = 'stage-lbl ' + st;
}
function setPhase(txt) { document.getElementById('phaseTxt').textContent = txt; }
function updateCov(p) { document.getElementById('cvb').style.width = p + '%'; document.getElementById('cvp').textContent = p + '%'; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function addAg(msg, opts = {}) {
    const f = document.getElementById('feed');
    const d = document.createElement('div');
    d.className = 'msg ag';
    if (opts.noEscape) {
        d.innerHTML = `<div class="msg-av">F</div><div class="msg-bubble msg-bubble-wide">${msg}</div>`;
    } else {
        d.innerHTML = `<div class="msg-av">F</div><div class="msg-bubble">${msg}</div>`;
    }
    if (opts.inds) {
        const wrap = document.createElement('div');
        wrap.className = 'industry-btns';
        opts.inds.forEach(ind => {
            const btn = document.createElement('button');
            btn.className = 'ind-btn';
            btn.textContent = ind;
            btn.onclick = () => {
                prof.confirmed = ind;
                document.querySelectorAll('.ind-btn').forEach(b => b.disabled = true);
                addUs(ind); setStg(1, 'done'); beginGather();
            };
            wrap.appendChild(btn);
        });
        d.querySelector('.msg-bubble').appendChild(wrap);
    }
    if (opts.video) {
        const vid = document.createElement('div');
        vid.className = 'video-placeholder'; vid.style.marginTop = '12px'; vid.style.height = '120px';
        vid.innerHTML = `<div class="vp-inner"><div class="vp-play">▶</div><div class="vp-text">Strategy Brief</div></div>`;
        vid.onclick = () => openModal('videoModal');
        d.querySelector('.msg-bubble').appendChild(vid);
    }
    f.appendChild(d);
    f.scrollTop = f.scrollHeight;
    saveConversationMemory();
}

function addUs(msg) {
    const f = document.getElementById('feed');
    const d = document.createElement('div');
    d.className = 'msg u';
    d.innerHTML = `<div class="msg-av">U</div><div class="msg-bubble">${msg}</div>`;
    f.appendChild(d);
    f.scrollTop = f.scrollHeight;
    saveConversationMemory();
}

function showToast(message, type = 'success') {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:${type==='error'?'var(--red)':'var(--green)'};color:#fff;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,.2);animation:msgIn .3s ease both;`;
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

/* ══ BOOT ══ */
init();
