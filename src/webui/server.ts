/**
 * WebUI HTTP Server
 *
 * Wraps WebUIBackend with a real Node.js HTTP server and serves the frontend.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebUIBackend } from './backend.js';
import { ProviderManager, type CreateProviderRequest, type UpdateProviderRequest, type LLMProviderConfig } from './provider-manager.js';
import type { WebUIConfig } from './types.js';
import { getRegistry } from '../providers/registry.js';
import type { ProviderConfig, ChatCompletionRequest } from '../providers/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── MIME types ──────────────────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function sendFile(res: ServerResponse, filePath: string): void {
  try {
    const content = readFileSync(filePath);
    const ext = join('.', filePath.split('.').pop() || '');
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

// ── Frontend HTML ───────────────────────────────────────────────────────────

const FRONTEND_HTML: string = buildFrontend();

function buildFrontend(): string {
  return `<!DOCTYPE html>
<html lang="en" style="color-scheme: dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#0d1117">
<title>Synthtek</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0d1117;--surface:#161b22;--border:#30363d;--text:#c9d1d9;--text-dim:#8b949e;--accent:#58a6ff;--green:#3fb950;--red:#f85149;--yellow:#d29922;--sidebar-w:240px}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);height:100dvh;display:flex;overflow:hidden}

/* Skip link */
.skip-link{position:absolute;top:-100%;left:16px;padding:8px 16px;background:var(--accent);color:#fff;border-radius:0 0 6px 6px;font-size:14px;font-weight:600;z-index:200;text-decoration:none}
.skip-link:focus{top:0}

/* Sidebar */
#sidebar{width:var(--sidebar-w);min-width:var(--sidebar-w);background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;height:100dvh;overflow-y:auto}
#sidebar .logo{padding:20px;border-bottom:1px solid var(--border);font-size:18px;font-weight:700;color:var(--accent)}
#sidebar nav{flex:1;padding:12px 0}
#sidebar nav a{display:flex;align-items:center;gap:12px;padding:10px 20px;color:var(--text-dim);text-decoration:none;font-size:14px;border-left:3px solid transparent;transition:background 0.15s,color 0.15s,border-color 0.15s}
#sidebar nav a:hover{color:var(--text);background:rgba(88,166,255,.06)}
#sidebar nav a.active{color:var(--accent);border-left-color:var(--accent);background:rgba(88,166,255,.1)}
#sidebar nav a:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;border-radius:4px}
#sidebar nav a .icon{width:20px;text-align:center;font-size:16px}
#sidebar .status-bar{padding:16px 20px;border-top:1px solid var(--border);font-size:12px;color:var(--text-dim)}
#sidebar .status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}

/* Main */
#main{flex:1;display:flex;flex-direction:column;overflow:hidden}
#topbar{height:48px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 24px;font-size:15px;font-weight:600;color:var(--text)}
#content{flex:1;overflow-y:auto;padding:24px}

/* Cards */
.card{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:20px;margin-bottom:16px}
.card h3{font-size:15px;font-weight:600;margin-bottom:12px;color:var(--text)}

/* Grid */
.grid-3{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.stat-card{text-align:center;padding:24px 16px}
.stat-card .value{font-size:28px;font-weight:700;color:var(--accent)}
.stat-card .label{font-size:13px;color:var(--text-dim);margin-top:4px}

/* Tables */
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;padding:10px 12px;border-bottom:2px solid var(--border);color:var(--text-dim);font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.5px}
td{padding:10px 12px;border-bottom:1px solid var(--border)}
tr:hover td{background:rgba(88,166,255,.04)}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.15s,opacity 0.15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.btn-primary{background:var(--accent);color:#fff}.btn-primary:hover{opacity:.9}
.btn-primary:disabled{opacity:.5;cursor:not-allowed}
.btn-danger{background:var(--red);color:#fff}.btn-danger:hover{opacity:.85}
.btn-ghost{background:transparent;color:var(--text-dim);border:1px solid var(--border)}.btn-ghost:hover{color:var(--text);border-color:var(--text-dim)}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* Badges */
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600}
.badge-active{background:rgba(63,185,80,.15);color:var(--green)}
.badge-inactive{background:rgba(139,148,158,.15);color:var(--text-dim)}
.badge-error{background:rgba(248,81,73,.15);color:var(--red)}

/* Forms */
.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:13px;color:var(--text-dim);margin-bottom:6px;font-weight:600;cursor:pointer}
.form-input{width:100%;padding:8px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:14px;outline:none;transition:border-color 0.15s}
.form-input:focus{border-color:var(--accent)}
select.form-input{appearance:auto}

/* Inline error */
.inline-error{color:var(--red);font-size:13px;margin-top:6px;display:none}
.inline-error.visible{display:block}

/* Chat */
#chat-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px}
.msg{max-width:75%;padding:10px 14px;border-radius:12px;line-height:1.5;font-size:14px;word-wrap:break-word;white-space:pre-wrap;overflow-wrap:break-word}
.msg-user{align-self:flex-end;background:#1f6feb;color:#fff;border-bottom-right-radius:4px}
.msg-assistant{align-self:flex-start;background:#21262d;border:1px solid var(--border);border-bottom-left-radius:4px}
#chat-input-bar{padding:16px 20px;border-top:1px solid var(--border);display:flex;gap:10px;background:var(--surface)}

/* Modal */
.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;width:500px;max-width:90vw;max-height:80vh;overflow-y:auto;overscroll-behavior:contain}
.modal h3{margin-bottom:16px;font-size:16px}

/* Empty state */
.empty{text-align:center;padding:60px 20px;color:var(--text-dim)}
.empty .icon{font-size:40px;margin-bottom:12px}

/* Page header */
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.page-header h2{font-size:20px;font-weight:700}

/* Spinner */
.spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .5s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* Reduced motion */
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important}
}
</style>
</head>
<body>

<a class="skip-link" href="#content">Skip to main content</a>

<!-- Sidebar -->
<div id="sidebar">
  <div class="logo">&#x1F680; Synthtek</div>
  <nav aria-label="Main navigation">
    <a href="#dashboard" data-page="dashboard" class="active"><span class="icon" aria-hidden="true">&#x1F4CA;</span> Dashboard</a>
    <a href="#chat" data-page="chat"><span class="icon" aria-hidden="true">&#x1F5E8;</span> Chat</a>
    <a href="#themes" data-page="themes"><span class="icon" aria-hidden="true">&#x1F300;</span> Themes</a>
    <a href="#agents" data-page="agents"><span class="icon" aria-hidden="true">&#x2699;&#xFE0F;</span> Agents</a>
    <a href="#channels" data-page="channels"><span class="icon" aria-hidden="true">&#x1F3F0;</span> Channels</a>
    <a href="#tools" data-page="tools"><span class="icon" aria-hidden="true">&#x1F527;</span> Tools</a>
    <a href="#users" data-page="users"><span class="icon" aria-hidden="true">&#x1F465;&#x200D;&#x1F4BB;</span> Users</a>
    <a href="#cron" data-page="cron"><span class="icon" aria-hidden="true">&#x23F0;</span> Cron Jobs</a>
    <a href="#config" data-page="config"><span class="icon" aria-hidden="true">&#x2699;&#xFE0F;</span> System Config</a>
  </nav>
  <div class="status-bar">
    <span class="status-dot" id="status-dot" role="status" aria-live="polite"></span><span id="status-text">Connecting…</span>
  </div>
</div>

<!-- Main -->
<main id="main">
  <div id="topbar"><h1 id="page-title">Dashboard</h1></div>
  <div id="content"></div>
</main>

<script>
// ── State ────────────────────────────────────────────────────────────────
const API = '/api';
let currentPage = 'dashboard';
let sessionId = null;
let modalDirty = false;

// ── Hash-based routing ───────────────────────────────────────────────────
const VALID_PAGES = ['dashboard','chat','themes','agents','channels','tools','users','cron','config'];

function pageFromHash() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  return VALID_PAGES.includes(hash) ? hash : 'dashboard';
}

function navigate(page) {
  currentPage = page;
  window.location.hash = page;
  document.querySelectorAll('#sidebar nav a').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  const titles = {dashboard:'Dashboard',chat:'Chat',agents:'Agents',channels:'Channels',tools:'Tools',users:'Users',cron:'Cron Jobs',config:'System Config'};
  document.getElementById('page-title').textContent = titles[page] || page;
  renderPage(page);
}

window.addEventListener('hashchange', () => navigate(pageFromHash()));

// Sidebar links use href="#page" — call navigate() directly
// so we control the transition and avoid a brief flash from hashchange.
document.querySelectorAll('#sidebar nav a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    navigate(a.dataset.page);
  });
});

// ── Pages ────────────────────────────────────────────────────────────────
async function renderPage(page) {
  const c = document.getElementById('content');
  switch(page) {
    case 'dashboard': await renderDashboard(c); break;
    case 'chat': renderChat(c); break;
    case 'agents': renderComingSoon(c, 'Agents', 'Manage and configure AI agents'); break;
    case 'channels': renderComingSoon(c, 'Channels', 'Configure Telegram, Discord, Slack integrations'); break;
    case 'tools': renderComingSoon(c, 'Tools', 'Browse and manage available tools'); break;
    case 'users': renderComingSoon(c, 'Users', 'Manage user accounts and permissions'); break;
    case 'cron': renderCronJobs(c); break;
    case 'config': await renderConfig(c); break;
    case 'themes': renderThemes(c); break;
  }
}

// ── Dashboard ────────────────────────────────────────────────────────────
async function renderDashboard(el) {
  let stats = {activeSessions:0,totalMessages:0,uptime:0};
  try { const r=await fetch(API+'/stats'); if(r.ok) stats=await r.json(); } catch{}

  el.innerHTML = '<div class="grid-3">' +
    statCard('Active Sessions', stats.activeSessions) +
    statCard('Total Messages', stats.totalMessages) +
    statCard('Uptime (min)', Math.round((stats.uptime||0)/60000)) +
  '</div>' +
  '<div class="card"><h3>Quick Actions</h3><div style="display:flex;gap:8px;margin-top:12px">' +
    '<button class="btn btn-primary" onclick="navigate(\'chat\')">Open Chat</button>' +
    '<button class="btn btn-ghost" onclick="navigate(\'config\')">System Config</button>' +
  '</div></div>';
}

function statCard(label, value) {
  return '<div class="card stat-card"><div class="value">'+value+'</div><div class="label">'+label+'</div></div>';
}

// ── Chat ─────────────────────────────────────────────────────────────────
function renderChat(el) {
  el.innerHTML = '<div style="display:flex;flex-direction:column;height:100%">' +
    '<div id="chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>' +
    '<div id="chat-input-bar">' +
      '<label for="msg-input" class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">Message</label>' +
      '<textarea class="form-input" id="msg-input" rows="1" placeholder="Type a message…" name="chat-message" autocomplete="off"></textarea>' +
      '<button class="btn btn-primary" id="send-btn">Send</button>' +
    '</div>' +
  '</div>';

  const msgs = document.getElementById('chat-messages');
  const input = document.getElementById('msg-input');
  const sendBtn = document.getElementById('send-btn');

  (async () => {
    try {
      let sessions = await fetch(API+'/sessions').then(r=>r.json());
      if(sessions.length>0) sessionId=sessions[0].id;
      else { const s=await fetch(API+'/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:'web'})}).then(r=>r.json()); sessionId=s.id; }
      let history = await fetch(API+'/messages?sessionId='+sessionId).then(r=>r.json());
      for(const m of history) appendMsg(msgs, m.role, m.content);
    } catch(e){ console.error(e); }
  })();

  sendBtn.onclick = doSend;
  input.onkeydown = e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend();}};
  input.oninput = () => { input.style.height='auto'; input.style.height=Math.min(input.scrollHeight,150)+'px'; };

  async function doSend() {
    const text=input.value.trim(); if(!text||!sessionId) return;
    appendMsg(msgs,'user',text); input.value=''; sendBtn.disabled=true;
    
    try { 
      // 1. Save user message to session
      await fetch(API+'/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,role:'user',content:text})}); 

      // 2. Get active providers
      let providers=[]; try{providers=await fetch(API+'/providers').then(r=>r.json());}catch{}
      const active = providers.find(p=>p.status==='active');
      
      if (!active) {
        appendMsg(msgs,'assistant','No active LLM provider configured. Go to System Config to add one.');
        sendBtn.disabled=false;
        return;
      }

      // 3. Call Chat Completion
      const response = await fetch(API+'/chat/completions', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          messages: [{role: 'user', content: text}],
          providerId: active.id
        })
      }).then(r => r.json());

      if (response.content) {
        appendMsg(msgs, 'assistant', response.content);
        // Also save assistant message to session
        await fetch(API+'/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,role:'assistant',content:response.content})});
      } else {
        throw new Error(response.error || 'Unknown error');
      }

    } catch (err) {
      appendMsg(msgs, 'assistant', 'Error: ' + err.message);
    } finally {
      sendBtn.disabled=false; 
      input.focus();
    }
  }

  function appendMsg(container, role, content) {
    const d=document.createElement('div'); d.className='msg msg-'+role; d.textContent=content; container.appendChild(d); container.scrollTop=container.scrollHeight;
  }
}

// ── Themes ────────────────────────────────────────────────────────────────
function renderThemes(el) {
  const current = localStorage.getItem('theme') || 'dark';
  el.innerHTML = '<div class="card"><h3>Appearance</h3>' +
    '<p style="color:var(--text-dim);margin-bottom:16px;font-size:14px">Choose your theme preference.</p>' +
    '<div style="display:flex;gap:12px">' +
    '<button class="btn '+(current==='dark'?'btn-primary':'btn-ghost')+'" id="theme-dark">Dark</button>' +
    '<button class="btn '+(current==='light'?'btn-primary':'btn-ghost')+'" id="theme-light">Light</button>' +
    '</div></div>';
  document.getElementById('theme-dark').onclick = () => {
    localStorage.setItem('theme','dark');
    document.documentElement.style.colorScheme='dark';
    renderThemes(el);
  };
  document.getElementById('theme-light').onclick = () => {
    localStorage.setItem('theme','light');
    document.documentElement.style.colorScheme='light';
    renderThemes(el);
  };
}

// ── Coming Soon ──────────────────────────────────────────────────────────
function renderComingSoon(el, title, desc) {
  el.innerHTML = '<div class="empty"><div class="icon" aria-hidden="true">&#x1F3A8;</div><h2>'+title+'</h2><p style="margin-top:8px">'+desc+'</p></div>';
}

// ── Cron Jobs ────────────────────────────────────────────────────────────
function renderCronJobs(el) {
  el.innerHTML = '<div class="empty"><div class="icon" aria-hidden="true">&#x23F0;</div><h2>Cron Jobs</h2><p style="margin-top:8px">No scheduled jobs configured yet.</p></div>';
}

// ── System Config ────────────────────────────────────────────────────────
async function renderConfig(el) {
  let providers = [];
  try { providers = await fetch(API+'/providers').then(r=>r.json()); } catch{}

  el.innerHTML = '<div class="page-header"><h2>LLM Providers</h2><button class="btn btn-primary" id="add-provider-btn">+ Add Provider</button></div>' +
    (providers.length ? renderProviderTable(providers) : '<div class="empty"><p>No providers configured yet.</p></div>');

  document.getElementById('add-provider-btn').onclick = () => showProviderModal();
}

function renderProviderTable(providers) {
  const typeIcons = {openai:'&#x1F929;',anthropic:'&#x1F436;',openrouter:'&#x1F30F;',ollama:'&#x1F40B;','lm-studio':'&#x1F578;',llamacpp:'&#x1F9E0;',custom:'&#x2699;&#xFE0F;'};
  return '<div class="card"><table><thead><tr><th>Provider</th><th>Type</th><th>Model</th><th>Status</th><th style="width:140px">Actions</th></tr></thead><tbody>' +
    providers.map(p => '<tr><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(p.name)+'</td><td>'+(typeIcons[p.type]||'')+ ' '+esc(p.type)+'</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(p.defaultModel||'-')+'</td><td><span class="badge badge-'+p.status+'">'+p.status+'</span></td><td style="white-space:nowrap"><button class="btn btn-ghost" onclick="editProvider(\''+p.id+'\')">Edit</button> <button class="btn btn-danger" onclick="deleteProvider(\''+p.id+'\')" style="margin-left:4px">Delete</button></td></tr>').join('') +
    '</tbody></table></div>';
}

function esc(s){return s?s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):'';}

// ── Provider Modal ───────────────────────────────────────────────────────
async function showProviderModal(editId) {
  let presets = {}; try{presets=await fetch(API+'/providers/presets').then(r=>r.json());}catch{}
  const existing = editId ? await (fetch(API+'/providers/'+editId).then(r=>r.json())) : null;

  const types = Object.keys(presets);
  const typeOpts = types.map(t => '<option value="'+t+'" '+(existing&&existing.type===t?'selected':'')+'>'+t+'</option>').join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
    '<h3 id="modal-title">'+(existing?'Edit':'Add')+' LLM Provider</h3>' +
    '<form id="provider-form" novalidate>' +
      formGroup('Name','text','prov-name',existing?.name||'','provider-name','off') +
      formGroup('Type','select','prov-type','',undefined,typeOpts) +
      formGroup('Base URL','url','prov-url',existing?.baseUrl||(presets[types[0]]?.baseUrl||''),'provider-url','off') +
      formGroup('API Key','password','prov-key',existing?.apiKey||'','provider-api-key','off') +
      formGroup('Models (comma-separated)','text','prov-models',(existing?.models||[]).join(', '),'provider-models','off') +
      formGroup('Default Model','text','prov-default',(existing?.defaultModel||''),'provider-default-model','off') +
      formGroup('Temperature','number','prov-temp',existing?.temperature??0.7,'provider-temperature','off',{step:'0.1',min:'0',max:'2'}) +
      formGroup('Max Tokens','number','prov-maxtokens',existing?.maxTokens??4096,'provider-max-tokens','off') +
      formGroup('Timeout (ms)','number','prov-timeout',existing?.timeoutMs??60000,'provider-timeout','off') +
    '</form>' +
    '<div id="modal-error" class="inline-error" role="alert"></div>' +
    '<div style="display:flex;gap:8px;margin-top:20px">' +
      '<button class="btn btn-primary" id="save-provider">Save</button>' +
      '<button class="btn btn-ghost" id="cancel-provider">Cancel</button>' +
    '</div></div>';

  document.body.appendChild(overlay);
  modalDirty = false;

  // Track dirty state
  overlay.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('input', () => { modalDirty = true; });
  });

  // Update URL when type changes
  const typeSel = overlay.querySelector('#prov-type');
  typeSel.onchange = () => {
    const preset = presets[typeSel.value];
    if(preset) {
      overlay.querySelector('#prov-url').value = preset.baseUrl || '';
      if(!existing) {
        overlay.querySelector('#prov-models').value = (preset.models||[]).join(', ');
        overlay.querySelector('#prov-default').value = preset.defaultModel || '';
      }
    }
  };

  // Warn before closing with unsaved changes
  overlay.querySelector('#cancel-provider').onclick = () => {
    if(modalDirty && !confirm('You have unsaved changes. Discard them?')) return;
    overlay.remove();
    modalDirty = false;
  };

  overlay.onclick = e => {
    if(e.target===overlay) {
      if(modalDirty && !confirm('You have unsaved changes. Discard them?')) return;
      overlay.remove();
      modalDirty = false;
    }
  };

  // Focus first input for accessibility
  overlay.querySelector('#prov-name').focus();

  overlay.querySelector('#save-provider').onclick = async (e) => {
    const btn = e.target;
    const errorEl = overlay.querySelector('#modal-error');

    // Validate
    const name = overlay.querySelector('#prov-name').value.trim();
    if(!name) {
      errorEl.textContent = 'Provider name is required.';
      errorEl.classList.add('visible');
      overlay.querySelector('#prov-name').focus();
      return;
    }

    // Show loading state
    const origText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving…';

    const data = {
      name: name,
      type: overlay.querySelector('#prov-type').value,
      baseUrl: overlay.querySelector('#prov-url').value.trim(),
      apiKey: overlay.querySelector('#prov-key').value,
      models: overlay.querySelector('#prov-models').value.split(',').map(s=>s.trim()).filter(Boolean),
      defaultModel: overlay.querySelector('#prov-default').value.trim(),
      temperature: parseFloat(overlay.querySelector('#prov-temp').value) || 0.7,
      maxTokens: parseInt(overlay.querySelector('#prov-maxtokens').value) || 4096,
      timeoutMs: parseInt(overlay.querySelector('#prov-timeout').value) || 60000,
    };

    const method = editId ? 'PUT' : 'POST';
    const url = editId ? API+'/providers/'+editId : API+'/providers';
    try {
      const res = await fetch(url, {method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
      if(!res.ok) throw new Error('Request failed');
      overlay.remove();
      modalDirty = false;
      renderConfig(document.getElementById('content'));
    } catch(err) {
      errorEl.textContent = 'Failed to save provider. Please try again.';
      errorEl.classList.add('visible');
      btn.disabled = false;
      btn.textContent = origText;
    }
  };
}

function formGroup(label, type, id, value, nameAttr, autocomplete, extra) {
  const isSelect = type === 'select';
  const attrs = 'id="'+id+'" class="form-input" name="'+nameAttr+'" autocomplete="'+autocomplete+'"';
  const extraAttrs = extra ? Object.entries(extra).map(([k,v])=>k+'="'+v+'"').join('') : '';

  if(isSelect) {
    return '<div class="form-group"><label for="'+id+'">'+label+'</label><select '+attrs+' '+extraAttrs+'>'+extra+'</select></div>';
  }
  return '<div class="form-group"><label for="'+id+'">'+label+'</label><'+type+' '+attrs+' value="'+esc(value)+'" '+extraAttrs+'></'+type+'></div>';
}

function editProvider(id) { showProviderModal(id); }

async function deleteProvider(id) {
  if(!confirm('Delete this provider? This action cannot be undone.')) return;
  await fetch(API+'/providers/'+id, {method:'DELETE'});
  renderConfig(document.getElementById('content'));
}

// ── Init ─────────────────────────────────────────────────────────────────
(async () => {
  try {
    const r = await fetch(API+'/health');
    if(r.ok) { document.getElementById('status-dot').style.background='var(--green)'; document.getElementById('status-text').textContent='Connected'; }
    else throw new Error();
  } catch { document.getElementById('status-dot').style.background='var(--red)'; document.getElementById('status-text').textContent='Disconnected'; }
  navigate(pageFromHash());
})();
</script>
</body>
</html>`;
}

// ── Server ──────────────────────────────────────────────────────────────────

// Available themes for the WebUI
interface Theme {
  id: string;
  name: string;
  cssVariables: Record<string, string>;
}

const AVAILABLE_THEMES: Theme[] = [
  {
    id: 'dark',
    name: 'Dark (GitHub)',
    cssVariables: {
      '--bg': '#0d1117', '--surface': '#161b22', '--border': '#30363d',
      '--text': '#c9d1d9', '--text-dim': '#8b949e', '--accent': '#58a6ff',
      '--green': '#3fb950', '--red': '#f85149', '--yellow': '#d29922',
    },
  },
  {
    id: 'light',
    name: 'Light',
    cssVariables: {
      '--bg': '#ffffff', '--surface': '#f6f8fa', '--border': '#d0d7de',
      '--text': '#1f2328', '--text-dim': '#656d76', '--accent': '#0969da',
      '--green': '#1a7f37', '--red': '#cf222e', '--yellow': '#9a6700',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    cssVariables: {
      '--bg': '#0a0e17', '--surface': '#111827', '--border': '#1e293b',
      '--text': '#e2e8f0', '--text-dim': '#64748b', '--accent': '#818cf8',
      '--green': '#34d399', '--red': '#f87171', '--yellow': '#fbbf24',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    cssVariables: {
      '--bg': '#0c1821', '--surface': '#142334', '--border': '#1e3a5f',
      '--text': '#c5d8e8', '--text-dim': '#5a8fa8', '--accent': '#00b4d8',
      '--green': '#2ec4b6', '--red': '#e63946', '--yellow': '#f4a261',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    cssVariables: {
      '--bg': '#2e3440', '--surface': '#3b4252', '--border': '#4c566a',
      '--text': '#d8dee9', '--text-dim': '#7b88a1', '--accent': '#88c0d0',
      '--green': '#a3be8c', '--red': '#bf616a', '--yellow': '#ebcb8b',
    },
  },
];

function getAvailableThemes(): Theme[] {
  return AVAILABLE_THEMES;
}

export class WebUIServer {
  private backend: WebUIBackend;
  private providerManager: ProviderManager;
  private server: ReturnType<typeof createServer> | null = null;

  constructor(private config: WebUIConfig) {
    this.backend = new WebUIBackend(config);
    const workspaceDir = process.env.SYNTHTEK_WORKSPACE || '/data';
    // Ensure config dir exists
    try { mkdirSync(join(workspaceDir, 'config'), { recursive: true }); } catch {}
    this.providerManager = new ProviderManager(workspaceDir);
  }

  async start(): Promise<void> {
    await this.backend.start();

    const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
      // CORS preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
        return res.end();
      }

      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const path = url.pathname;

      // API routes
      if (path.startsWith('/api/')) {
        let body: unknown = {};
        if (req.method === 'POST' || req.method === 'PUT') {
          try { body = JSON.parse(await parseBody(req)); } catch { body = {}; }
        }

        // Auth check for write operations
        if ((req.method === 'POST' || req.method === 'DELETE' || req.method === 'PUT') && this.config.apiKey) {
          const authHeader = req.headers['authorization'];
          if (authHeader !== `Bearer ${this.config.apiKey}`) {
            return sendJson(res, 401, { error: 'Unauthorized' });
          }
        }

        // ── Provider routes ────────────────────────────────────────────────

        // GET /api/providers/presets
        if (req.method === 'GET' && path === '/api/providers/presets') {
          return sendJson(res, 200, this.providerManager.getPresets());
        }

        // GET /api/providers
        if (req.method === 'GET' && path === '/api/providers') {
          return sendJson(res, 200, this.providerManager.list());
        }

        // POST /api/providers
        if (req.method === 'POST' && path === '/api/providers') {
          const reqData = body as CreateProviderRequest;
          if (!reqData.name || !reqData.type) return sendJson(res, 400, { error: 'name and type are required' });
          const provider = this.providerManager.create(reqData);
          return sendJson(res, 201, provider);
        }

        // GET /api/providers/:id
        if (req.method === 'GET' && path.startsWith('/api/providers/') && path.split('/').length === 4) {
          const id = path.split('/')[3];
          const provider = this.providerManager.get(id);
          return provider ? sendJson(res, 200, provider) : sendJson(res, 404, { error: 'Provider not found' });
        }

        // PUT /api/providers/:id
        if (req.method === 'PUT' && path.startsWith('/api/providers/') && path.split('/').length === 4) {
          const id = path.split('/')[3];
          const reqData = body as UpdateProviderRequest;
          const provider = this.providerManager.update(id, reqData);
          return provider ? sendJson(res, 200, provider) : sendJson(res, 404, { error: 'Provider not found' });
        }

        // DELETE /api/providers/:id
        if (req.method === 'DELETE' && path.startsWith('/api/providers/') && path.split('/').length === 4) {
          const id = path.split('/')[3];
          return sendJson(res, this.providerManager.delete(id) ? 200 : 404, {});
        }

        // ── Chat completion (calls actual LLM) ─────────────────────────────

        // POST /api/chat/completions
        if (req.method === 'POST' && path === '/api/chat/completions') {
          return this.handleChatCompletion(req, res, body as ChatCompletionRequest & { providerId?: string });
        }

        // ── Themes ──────────────────────────────────────────────────────────

        // GET /api/themes
        if (req.method === 'GET' && path === '/api/themes') {
          return sendJson(res, 200, getAvailableThemes());
        }

        // ── Existing routes ────────────────────────────────────────────────

        // GET /api/messages?sessionId=xxx
        if (req.method === 'GET' && path === '/api/messages') {
          const sessionId = url.searchParams.get('sessionId');
          return sendJson(res, 200, sessionId ? this.backend.getMessages(sessionId) : []);
        }

        // DELETE /api/sessions/:id
        if (req.method === 'DELETE' && path.startsWith('/api/sessions/')) {
          const id = path.split('/').pop();
          return sendJson(res, this.backend.deleteSession(id!) ? 200 : 404, {});
        }

        // All other API routes
        const response = this.backend.handleRequest(req.method!, path, body);
        return sendJson(res, response.status, response.body);
      }

      // Serve frontend for everything else
      if (path === '/' || path === '/index.html') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        });
        return res.end(FRONTEND_HTML);
      }

      // Try to serve static file from dist/src/webui/ (for future asset support)
      const filePath = join(__dirname, path);
      sendFile(res, filePath);
    };

    this.server = createServer(handleRequest);
    this.server.listen(this.config.port, this.config.host, () => {
      console.log(`[webui] Server running at http://${this.config.host}:${this.config.port}`);
    });
  }

  async stop(): Promise<void> {
    await this.backend.stop();
    if (this.server) {
      return new Promise((resolve) => this.server!.close(() => resolve(undefined)));
    }
  }

  // ── Chat Completion Handler ──────────────────────────────────────────────

  private async handleChatCompletion(
    _req: IncomingMessage,
    res: ServerResponse,
    chatReq: ChatCompletionRequest & { providerId?: string },
  ): Promise<void> {
    try {
      // Find the provider to use
      const providers = this.providerManager.list();
      const activeProviders = providers.filter(p => p.status === 'active');

      if (activeProviders.length === 0) {
        return sendJson(res, 422, { error: 'No active LLM providers configured. Go to Settings to add one.' });
      }

      // Use specified provider or first active one
      let provider: LLMProviderConfig | undefined;
      if (chatReq.providerId) {
        provider = activeProviders.find(p => p.id === chatReq.providerId);
        if (!provider) {
          return sendJson(res, 404, { error: 'Specified provider not found or inactive' });
        }
      } else {
        provider = activeProviders[0];
      }

      // Create provider instance via registry
      const registry = getRegistry();
      const providerType = provider.type as import('../providers/types.js').ProviderType;
      if (!registry.has(providerType)) {
        return sendJson(res, 500, { error: `Provider type "${provider.type}" not supported` });
      }

      const providerConfig: ProviderConfig = {
        provider: providerType,
        apiKey: provider.apiKey || '',
        baseUrl: provider.baseUrl,
        model: chatReq.model || provider.defaultModel,
        timeout: provider.timeoutMs,
        headers: provider.headers,
      };

      const llmProvider = registry.create(providerType, providerConfig);

      // Build messages from request
      const messages = chatReq.messages || [];
      const system = chatReq.system;

      const completionReq: ChatCompletionRequest = {
        model: providerConfig.model || '',
        messages: system
          ? [{ role: 'system', content: system }, ...messages]
          : messages,
        maxTokens: chatReq.maxTokens || provider.maxTokens,
        temperature: chatReq.temperature ?? provider.temperature,
        stream: false,
      };

      // Call the LLM
      const response = await llmProvider.chat(completionReq);

      // Store assistant message in session if sessionId provided
      const sessionId = (chatReq as Record<string, unknown>).sessionId as string | undefined;
      if (sessionId) {
        this.backend.addMessage(sessionId, { role: 'assistant', content: response.content });
      }

      return sendJson(res, 200, {
        content: response.content,
        model: response.model,
        usage: response.usage,
        finishReason: response.finishReason,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return sendJson(res, 500, { error: `Chat completion failed: ${message}` });
    }
  }

  get backendInstance(): WebUIBackend {
    return this.backend;
  }
}

// ── No direct CLI entry — use `synthtek webui` command instead ───────────────
