/**
 * WebUI HTTP Server
 *
 * Wraps WebUIBackend with a real Node.js HTTP server and serves the frontend.
 */

import { mkdirSync, readFileSync } from "node:fs";
import {
	createServer,
	type IncomingMessage,
	type ServerResponse,
} from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getRegistry } from "../providers/index.js";
import type {
	ChatCompletionRequest,
	ProviderConfig,
} from "../providers/types.js";
import { WebUIBackend } from "./backend.js";
import {
	type CreateProviderRequest,
	type LLMProviderConfig,
	ProviderManager,
	type UpdateProviderRequest,
} from "./provider-manager.js";
import type { WebUIConfig } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── MIME types ──────────────────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, body: unknown): void {
	const json = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*",
		"Content-Length": Buffer.byteLength(json),
	});
	res.end(json);
}

function sendFile(res: ServerResponse, filePath: string): void {
	try {
		const content = readFileSync(filePath);
		const ext = join(".", filePath.split(".").pop() || "");
		const mime = MIME_TYPES[ext] || "application/octet-stream";
		res.writeHead(200, {
			"Content-Type": mime,
			"Access-Control-Allow-Origin": "*",
		});
		res.end(content);
	} catch {
		res.writeHead(404, { "Content-Type": "text/plain" });
		res.end("Not found");
	}
}

function parseBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk) => chunks.push(chunk));
		req.on("end", () => resolve(Buffer.concat(chunks).toString()));
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
:root{--bg:#0f1117;--surface:#1a1b1e;--border:#2e2f32;--text:#e4e5e7;--text-dim:#858699;--accent:#6366f1;--accent-hover:#4f46e5;--green:#22c55e;--red:#ef4444;--yellow:#eab308;--orange:#f97316;--sidebar-w:220px;--radius:6px;--transition:150ms ease}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif;background:var(--bg);color:var(--text);height:100dvh;display:flex;overflow:hidden;font-size:14px;line-height:1.5}
a{color:var(--accent);text-decoration:none}
a:hover{color:var(--accent-hover)}

/* Skip link */
.skip-link{position:absolute;top:-100%;left:16px;padding:8px 16px;background:var(--accent);color:#fff;border-radius:0 0 var(--radius) var(--radius);font-size:14px;font-weight:600;z-index:200}
.skip-link:focus{top:0}

/* Sidebar */
#sidebar{width:var(--sidebar-w);min-width:var(--sidebar-w);background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;height:100dvh}
#sidebar .logo{padding:20px 20px 16px;font-size:16px;font-weight:700;letter-spacing:-0.3px;color:var(--text);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px}
#sidebar .logo svg{width:20px;height:20px;color:var(--accent);flex-shrink:0}
#sidebar nav{flex:1;padding:8px 0;overflow-y:auto}
#sidebar nav a{display:flex;align-items:center;gap:10px;padding:8px 20px;color:var(--text-dim);font-size:13px;font-weight:500;border-left:2px solid transparent;transition:background var(--transition),color var(--transition),border-color var(--transition)}
#sidebar nav a:hover{color:var(--text);background:rgba(99,102,241,.06)}
#sidebar nav a.active{color:var(--accent);border-left-color:var(--accent);background:rgba(99,102,241,.1)}
#sidebar nav a:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;border-radius:var(--radius)}
#sidebar nav a svg{width:16px;height:16px;flex-shrink:0;opacity:.7}
#sidebar nav a.active svg{opacity:1}
#sidebar .status-bar{padding:12px 20px;border-top:1px solid var(--border);font-size:12px;color:var(--text-dim);display:flex;align-items:center;gap:6px}
#sidebar .status-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}

/* Main */
#main{flex:1;display:flex;flex-direction:column;overflow:hidden}
#topbar{height:48px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 24px;font-size:14px;font-weight:600;color:var(--text)}
#content{flex:1;overflow-y:auto;padding:24px;scrollbar-width:thin;scrollbar-color:var(--border) transparent}

/* Cards */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:16px}
.card h3{font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text)}

/* Grid */
.grid-3{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.stat-card{text-align:center;padding:20px 16px}
.stat-card .value{font-size:26px;font-weight:700;color:var(--accent);letter-spacing:-0.5px}
.stat-card .label{font-size:12px;color:var(--text-dim);margin-top:4px;text-transform:uppercase;letter-spacing:.5px}

/* Tables */
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:10px 12px;border-bottom:1px solid var(--border);color:var(--text-dim);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
td{padding:10px 12px;border-bottom:1px solid var(--border);color:var(--text)}
tr:hover td{background:rgba(99,102,241,.03)}

/* Buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:6px 14px;border-radius:var(--radius);border:none;font-size:13px;font-weight:500;cursor:pointer;transition:background var(--transition),opacity var(--transition),border-color var(--transition);touch-action:manipulation;-webkit-tap-highlight-color:transparent;line-height:1.4}
.btn-primary{background:var(--accent);color:#fff}.btn-primary:hover{background:var(--accent-hover)}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}
.btn-danger{background:transparent;color:var(--red);border:1px solid var(--border)}.btn-danger:hover{background:rgba(239,68,68,.1);border-color:var(--red)}
.btn-ghost{background:transparent;color:var(--text-dim);border:1px solid var(--border)}.btn-ghost:hover{color:var(--text);border-color:var(--text-dim)}
.btn-sm{padding:4px 10px;font-size:12px}
.btn-icon{padding:6px;min-width:32px;line-height:1}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* Status dots */
.status-dot{display:inline-block;width:6px;height:6px;border-radius:50%;vertical-align:middle;margin-right:4px}
.status-active{background:var(--green)}
.status-inactive{background:var(--text-dim)}
.status-error{background:var(--red)}

/* Tag / badge */
.tag{display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;gap:4px}
.tag-search{background:rgba(99,102,241,.15);color:#818cf8}
.tag-system{background:rgba(34,197,94,.12);color:#4ade80}
.tag-filesystem{background:rgba(234,179,8,.12);color:#eab308}
.tag-memory{background:rgba(249,115,22,.12);color:#fb923c}
.tag-default{background:rgba(133,134,153,.12);color:#a1a2aa}

/* Forms */
.form-group{margin-bottom:14px}
.form-group label{display:block;font-size:12px;color:var(--text-dim);margin-bottom:4px;font-weight:500;cursor:pointer}
.form-input{width:100%;padding:8px 12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;outline:none;transition:border-color var(--transition)}
.form-input:focus{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
select.form-input{appearance:auto;cursor:pointer}
.form-input[type=number]{width:120px}
.form-group-inline{display:flex;gap:10px;flex-wrap:wrap}
.form-group-inline .form-group{flex:1;min-width:100px}

/* Inline error */
.inline-error{color:var(--red);font-size:12px;margin-top:4px;display:none}
.inline-error.visible{display:block}

/* Chat */
#chat-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:8px;scrollbar-width:thin;scrollbar-color:var(--border) transparent}
.msg{max-width:75%;padding:10px 14px;border-radius:8px;line-height:1.5;font-size:14px;word-wrap:break-word;white-space:pre-wrap;overflow-wrap:break-word}
.msg-user{align-self:flex-end;background:var(--accent);color:#fff;border-bottom-right-radius:2px}
.msg-assistant{align-self:flex-start;background:var(--surface);border:1px solid var(--border);border-bottom-left-radius:2px}
#chat-input-bar{padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;background:var(--surface)}
#chat-input-bar textarea{resize:none;min-height:40px;max-height:150px}

/* Modal */
.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:100}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:24px;width:480px;max-width:90vw;max-height:80vh;overflow-y:auto;overscroll-behavior:contain}
.modal h3{margin-bottom:16px;font-size:16px;font-weight:600}
.modal-actions{display:flex;gap:8px;margin-top:20px}

/* Empty state */
.empty{text-align:center;padding:60px 20px;color:var(--text-dim)}
.empty svg{width:40px;height:40px;margin-bottom:12px;opacity:.4}
.empty h2{font-size:18px;font-weight:600;margin-bottom:4px;color:var(--text-dim)}
.empty p{font-size:14px}

/* Page header */
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;gap:12px}
.page-header h2{font-size:18px;font-weight:700;letter-spacing:-0.3px}

/* Spinner */
.spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:spin .5s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* Reduced motion */
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important}
}

/* Tool card grid */
.tool-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.tool-card{padding:16px;cursor:default}
.tool-card h4{font-size:14px;font-weight:600;margin-bottom:4px;color:var(--text)}
.tool-card p{font-size:12px;color:var(--text-dim);line-height:1.5;margin-bottom:10px}

/* Filter bar */
.filter-bar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.filter-bar .filter-btn{padding:4px 12px;border-radius:var(--radius);border:1px solid var(--border);background:transparent;color:var(--text-dim);font-size:12px;cursor:pointer;transition:all var(--transition)}
.filter-bar .filter-btn:hover{border-color:var(--accent);color:var(--text)}
.filter-bar .filter-btn.active{background:var(--accent);color:#fff;border-color:var(--accent)}

/* Cron row */
.cron-row{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);gap:12px}
.cron-row:last-child{border-bottom:none}
.cron-info{flex:1;min-width:0}
.cron-info .cron-msg{font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cron-info .cron-meta{font-size:11px;color:var(--text-dim);margin-top:2px}
.cron-info .cron-meta code{font-family:'SF Mono','Fira Code','Consolas',monospace;background:rgba(133,134,153,.1);padding:1px 4px;border-radius:3px;font-size:11px}
.cron-actions{flex-shrink:0;display:flex;gap:6px}

/* Config tabs */
.config-tabs{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:20px}
.config-tab{padding:8px 16px;font-size:13px;font-weight:500;color:var(--text-dim);background:none;border:none;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color 0.15s,border-color 0.15s}
.config-tab:hover{color:var(--text)}
.config-tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.config-tab:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;border-radius:var(--radius)}

/* Agent config */
#config-agent textarea.form-input{min-height:200px;font-family:monospace;font-size:13px;line-height:1.5;resize:vertical}
#config-agent .char-count{font-size:11px;color:var(--text-dim);text-align:right;margin-top:4px}
#config-agent .save-status{font-size:12px;margin-left:8px;opacity:0;transition:opacity .3s}
#config-agent .save-status.show{opacity:1}

/* Scrollbar */
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--text-dim)}
</style>
</head>
<body>

<a class="skip-link" href="#content">Skip to main content</a>

<!-- Sidebar -->
<div id="sidebar">
  <div class="logo">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5V7M9.5 2A2.5 2.5 0 0 0 7 4.5V7M9.5 2H7M12 7H7M12 7h5M7 7H2M12 12l-5-5M12 12l5-5M7 17a5 5 0 0 1 10 0"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>
    Synthtek
  </div>
  <nav aria-label="Main navigation">
    <a href="#chat" data-page="chat" class="active">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      Chat
    </a>
    <a href="#analytics" data-page="analytics">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
      Analytics
    </a>
    <a href="#tools" data-page="tools">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
      Tools
    </a>
    <a href="#cron" data-page="cron">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      Cron Jobs
    </a>
    <a href="#config" data-page="config">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      System Config
    </a>
  </nav>
  <div class="status-bar">
    <span class="status-dot" id="status-dot" role="status" aria-live="polite"></span>
    <span id="status-text">Connecting…</span>
  </div>
</div>

<!-- Main -->
<main id="main">
  <div id="topbar"><h1 id="page-title">Chat</h1></div>
  <div id="content"></div>
</main>

<script>
// ── State ────────────────────────────────────────────────────────────────
const API = '/api';
let currentPage = 'chat';
let sessionId = null;
let modalDirty = false;

// ── Fetch helpers ────────────────────────────────────────────────────────
async function fetchJSON(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || 'HTTP ' + r.status);
  }
  return r.json();
}

async function fetchJSONGet(url) {
  const apiKey = typeof window !== 'undefined' && window.__synthtekApiKey;
  const headers = apiKey ? { Authorization: 'Bearer ' + apiKey } : {};
  return fetchJSON(url, { headers });
}

async function fetchJSONPost(url, body) {
  const apiKey = typeof window !== 'undefined' && window.__synthtekApiKey;
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = 'Bearer ' + apiKey;
  return fetchJSON(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function fetchJSONPut(url, body) {
  const apiKey = typeof window !== 'undefined' && window.__synthtekApiKey;
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = 'Bearer ' + apiKey;
  return fetchJSON(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
}

async function fetchJSONDelete(url) {
  const apiKey = typeof window !== 'undefined' && window.__synthtekApiKey;
  const headers = apiKey ? { Authorization: 'Bearer ' + apiKey } : {};
  return fetchJSON(url, { method: 'DELETE', headers });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ── Hash-based routing ───────────────────────────────────────────────────
const VALID_PAGES = ['chat','analytics','tools','cron','config'];

function pageFromHash() {
  const hash = window.location.hash.slice(1) || 'chat';
  return VALID_PAGES.includes(hash) ? hash : 'chat';
}

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('#sidebar nav a').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  const titles = {chat:'Chat',analytics:'Analytics',tools:'Tools',cron:'Cron Jobs',config:'System Config'};
  document.getElementById('page-title').textContent = titles[page] || page;
  // Set hash last so hashchange fires after DOM updates — but guard against
  // re-entry since hashchange will call navigate() again via the listener.
  if (window.location.hash !== '#' + page) {
    window.location.hash = page;
  } else {
    renderPage(page).catch(e => {
      console.error('Navigation error:', e);
      const c = document.getElementById('content');
      c.innerHTML = '<div class="card" style="color:var(--red)"><h3>Error loading page</h3><p>'+esc(e.message||String(e))+'</p></div>';
    });
  }
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
    case 'chat': renderChat(c); break;
    case 'analytics': await renderAnalytics(c); break;
    case 'tools': await renderTools(c); break;
    case 'cron': await renderCronJobs(c); break;
    case 'config': await renderConfig(c); break;
  }
}

// ── Dashboard ────────────────────────────────────────────────────────────
// ── Chat ─────────────────────────────────────────────────────────────────
// ── Analytics ───────────────────────────────────────────────────────────
async function renderAnalytics(el) {
  let stats = {activeSessions:0,totalMessages:0,uptime:0};
  try { stats = await fetchJSONGet(API+'/stats'); } catch{}

  el.innerHTML = '<div class="page-header"><h2>Analytics</h2></div>' +
    '<div class="grid-3">' +
      statCard('Active Sessions', stats.activeSessions) +
      statCard('Total Messages', stats.totalMessages) +
      statCard('Uptime', fmtDuration(stats.uptime||0)) +
    '</div>' +
    '<div class="card"><h3>Quick Actions</h3><div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
      '<button class="btn btn-primary" onclick="navigate(\\'chat\\')">Open Chat</button>' +
      '<button class="btn btn-ghost" onclick="navigate(\\'config\\')">System Config</button>' +
    '</div></div>';
}

function statCard(label, value) {
  return '<div class="card stat-card"><div class="value">'+value+'</div><div class="label">'+label+'</div></div>';
}

function fmtDuration(ms) {
  if (!ms) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ' + (s % 60) + 's';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ' + (m % 60) + 'm';
  const d = Math.floor(h / 24);
  return d + 'd ' + (h % 24) + 'h';
}

function renderChat(el) {
  el.innerHTML = '<div style="display:flex;flex-direction:column;height:100%">' +
    '<div id="chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>' +
    '<div id="chat-input-bar">' +
      '<label for="msg-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">Message</label>' +
      '<textarea class="form-input" id="msg-input" rows="1" placeholder="Type a message..." name="chat-message" autocomplete="off"></textarea>' +
      '<button class="btn btn-primary" id="send-btn">Send</button>' +
    '</div>' +
  '</div>';

  const msgs = document.getElementById('chat-messages');
  const input = document.getElementById('msg-input');
  const sendBtn = document.getElementById('send-btn');

  (async () => {
    try {
      let sessions = await fetchJSONGet(API+'/sessions');
      if(Array.isArray(sessions) && sessions.length>0) sessionId=sessions[0].id;
      else { const s=await fetchJSONPost(API+'/sessions',{userId:'web'}); sessionId=s.id; }
      if (!sessionId) { appendMsg(msgs,'assistant','Failed to create a chat session.'); return; }
      let history = await fetchJSONGet(API+'/messages?sessionId='+sessionId);
      for(const m of history) appendMsg(msgs, m.role, m.content);
    } catch(e){ appendMsg(msgs,'assistant','Error loading chat: '+e.message); }
  })();

  sendBtn.onclick = doSend;
  input.onkeydown = e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend();}};
  input.oninput = () => { input.style.height='auto'; input.style.height=Math.min(input.scrollHeight,150)+'px'; };

  async function doSend() {
    const text=input.value.trim(); if(!text||!sessionId) return;
    appendMsg(msgs,'user',text); input.value=''; sendBtn.disabled=true;

    try {
      await fetchJSONPost(API+'/messages',{sessionId,role:'user',content:text});

      let providers=[]; try{providers=await fetchJSONGet(API+'/providers');}catch{}
      const active = Array.isArray(providers) ? providers.find(p=>p.status==='active') : null;

      if (!active) {
        appendMsg(msgs,'assistant','No active LLM provider configured. Go to System Config to add one.');
        sendBtn.disabled=false;
        return;
      }

      // Load agent config for system prompt + language
      let agentConfig = { systemPrompt: '### Role and Persona\\nYou are a brilliant, highly adaptive, and deeply authentic AI collaborator. Your communication style is inspired by minimalist conversational design: you are warm, grounded, and concise. You never use corporate fluff, overly formal preambles, or repetitive conclusions. You talk like a sharp, trusted peer.\\n\\n### Core Operating Principles\\n\\n1. Truthful & Direct:\\n- Prioritize objective reality and accuracy above comforting illusions.\\n- If the user is operating on misinformation, correct them gently but directly. Do not cushion critical feedback in layers of polite euphemisms.\\n- Be concise. Say what needs to be said in fewer words. Avoid dense walls of text; use sharp formatting to ensure clarity at a glance.\\n\\n2. Proactive & Insightful:\\n- Do not just answer the surface question. Anticipate the next logical step, bottleneck, or blind spot in the users logic and bring it to light.\\n- Offer actionable alternatives or frameworks before being asked, but keep them tightly bound to the users context.\\n\\n3. Conversational Momentum (The Pi Variable):\\n- Never leave a response dead-ended. End your turns with a single, highly incisive, open-ended question or next-step suggestion that drives the collaboration forward.\\n- Keep your tone conversational but professional. Use short sentences and natural transitions.\\n\\n### Formatting Constraints\\n- Use bullet points, bolding, and headers judiciously to make responses highly scannable.\\n- Avoid robotic lists (e.g., "Here are 5 things..."). Instead, integrate structure organically into the conversation.', language: 'English' };
      try { agentConfig = await fetchJSONGet(API+'/config/agent'); } catch{}

      // Build system message with language instruction
      let systemContent = agentConfig.systemPrompt;
      if (agentConfig.language && agentConfig.language !== 'English') {
        systemContent += '  You must respond in ' + agentConfig.language + '.';
      }

      // Build full message history from session
      let history = [];
      try { history = await fetchJSONGet(API+'/messages?sessionId='+sessionId); } catch{}
      const historyMessages = Array.isArray(history)
        ? history.map(m => ({ role: m.role, content: m.content }))
        : [];
      // The last message is the one we just added (user's text)
      // Send system + full history to give the LLM full context
      const messages = historyMessages;

      const response = await fetchJSONPost(API+'/chat/completions', {
        messages,
        system: systemContent,
        providerId: active.id
      });

      if (response.content) {
        appendMsg(msgs, 'assistant', response.content);
        await fetchJSONPost(API+'/messages',{sessionId,role:'assistant',content:response.content}).catch(()=>{});
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

// ── Tools ─────────────────────────────────────────────────────────────────
async function renderTools(el) {
  let tools = [];
  let activeFilter = 'all';
  try { tools = await fetchJSONGet(API+'/tools'); } catch{}

  const categories = ['all', ...new Set(tools.map(t => t.category))];
  const filtered = activeFilter === 'all' ? tools : tools.filter(t => t.category === activeFilter);

  function toolTag(cat) {
    const cls = 'tag-'+cat;
    return '<span class="tag '+(cls)+'">'+cat+'</span>';
  }

  function render() {
    const cats = categories;
    el.innerHTML =
      '<div class="page-header"><h2>Tools</h2><div style="display:flex;gap:8px;align-items:center">' +
        '<span style="font-size:12px;color:var(--text-dim)">'+tools.length+' available</span>' +
        '<button class="btn btn-primary" id="add-tool-btn">+ Add Tool</button>' +
      '</div></div>' +
      '<div class="filter-bar">' +
        cats.map(c => '<button class="filter-btn'+(c===activeFilter?' active':'')+'" data-cat="'+c+'">'+(c==='all'?'All':c)+'</button>').join('') +
      '</div>' +
      (filtered.length
        ? '<div class="tool-grid">' +
          filtered.map(t =>
            '<div class="card tool-card">' +
              '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
                '<div>' +
                  '<h4>'+esc(t.name)+'</h4>' +
                  '<p>'+esc(t.description||'')+'</p>' +
                  toolTag(t.category) +
                '</div>' +
                '<button class="btn btn-danger btn-sm delete-tool" data-name="'+esc(t.name)+'" style="flex-shrink:0;margin-left:8px">Delete</button>' +
              '</div>' +
            '</div>'
          ).join('') +
          '</div>'
        : '<div class="empty"><p>No tools found in this category.</p></div>');
  }

  // Remove old listener and attach fresh one
  const handlerKey = '_toolsClickHandler';
  if (el[handlerKey]) el.removeEventListener('click', el[handlerKey]);
  el[handlerKey] = function(e) {
    const filterBtn = e.target.closest('.filter-btn');
    if (filterBtn) {
      activeFilter = filterBtn.dataset.cat;
      render();
      return;
    }

    const addBtn = e.target.closest('#add-tool-btn');
    if (addBtn) {
      showToolModal();
      return;
    }

    const delBtn = e.target.closest('.delete-tool');
    if (delBtn) {
      const name = delBtn.dataset.name;
      if (!confirm('Delete tool "'+name+'"?')) return;
      fetchJSONDelete(API+'/tools/'+encodeURIComponent(name)).then(() => {
        tools = tools.filter(t => t.name !== name);
        render();
      }).catch(e => alert('Failed to delete: '+e.message));
      return;
    }
  };
  el.addEventListener('click', el[handlerKey]);

  render();
}

// ── Cron Jobs ────────────────────────────────────────────────────────────
async function renderCronJobs(el) {
  let jobs = [];
  try { jobs = await fetchJSONGet(API+'/cron'); } catch{}

  function render() {
    el.innerHTML =
      '<div class="page-header"><h2>Cron Jobs</h2><button class="btn btn-primary" id="add-cron-btn">+ New Job</button></div>' +
      (Array.isArray(jobs) && jobs.length
        ? '<div class="card">' +
          jobs.map(j =>
            '<div class="cron-row">' +
              '<div class="cron-info">' +
                '<div class="cron-msg">'+esc(j.message)+'</div>' +
                '<div class="cron-meta"><code>'+esc(j.schedule)+'</code> &middot; Created '+fmtTime(j.createdAt)+'</div>' +
              '</div>' +
              '<div class="cron-actions">' +
                '<button class="btn btn-danger btn-sm delete-cron" data-id="'+j.id+'">Delete</button>' +
              '</div>' +
            '</div>'
          ).join('') +
          '</div>'
        : '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><h2>No Cron Jobs</h2><p>No scheduled jobs configured yet.</p></div>');

    // Use single delegated handler
    const handlerKey = '_cronClickHandler';
    if (el[handlerKey]) el.removeEventListener('click', el[handlerKey]);
    el[handlerKey] = async function(e) {
      const addBtn = e.target.closest('#add-cron-btn');
      if (addBtn) { showCronModal(); return; }

      const delBtn = e.target.closest('.delete-cron');
      if (!delBtn) return;
      if (!confirm('Delete this cron job?')) return;
      try {
        await fetchJSONDelete(API+'/cron/'+delBtn.dataset.id);
        jobs = jobs.filter(j => j.id !== delBtn.dataset.id);
        render();
      } catch(e) {
        alert('Failed to delete: '+e.message);
      }
    };
    el.addEventListener('click', el[handlerKey]);
  }

  render();
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000)+'m ago';
  if (diff < 86400000) return Math.floor(diff/3600000)+'h ago';
  return d.toLocaleDateString();
}

// ── Cron Modal ───────────────────────────────────────────────────────────
function showCronModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML =
    '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="cron-modal-title">' +
      '<h3 id="cron-modal-title">New Cron Job</h3>' +
      '<div class="form-group"><label for="cron-schedule">Schedule (cron expression)</label>' +
        '<input id="cron-schedule" class="form-input" type="text" placeholder="*/5 * * * *" autocomplete="off"></div>' +
      '<div class="form-group"><label for="cron-message">Message / Command</label>' +
        '<input id="cron-message" class="form-input" type="text" placeholder="Run backup script" autocomplete="off"></div>' +
      '<div id="cron-error" class="inline-error" role="alert"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-primary" id="cron-save-btn">Create</button>' +
        '<button class="btn btn-ghost" id="cron-cancel-btn">Cancel</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  overlay.querySelector('#cron-schedule').focus();

  overlay.querySelector('#cron-cancel-btn').onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  overlay.querySelector('#cron-save-btn').onclick = async () => {
    const schedule = overlay.querySelector('#cron-schedule').value.trim();
    const message = overlay.querySelector('#cron-message').value.trim();
    const errorEl = overlay.querySelector('#cron-error');

    if (!schedule) { errorEl.textContent = 'Schedule is required.'; errorEl.classList.add('visible'); return; }
    if (!message) { errorEl.textContent = 'Message is required.'; errorEl.classList.add('visible'); return; }

    try {
      await fetchJSONPost(API+'/cron', { schedule, message });
      overlay.remove();
      renderCronJobs(document.getElementById('content'));
    } catch(e) {
      errorEl.textContent = e.message; errorEl.classList.add('visible');
    }
  };
}

// ── Tool Modal ────────────────────────────────────────────────────────────
function showToolModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML =
    '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="tool-modal-title">' +
      '<h3 id="tool-modal-title">Add Custom Tool</h3>' +
      '<div class="form-group"><label for="tool-name">Tool Name</label>' +
        '<input id="tool-name" class="form-input" type="text" placeholder="my_custom_tool" autocomplete="off"></div>' +
      '<div class="form-group"><label for="tool-desc">Description</label>' +
        '<input id="tool-desc" class="form-input" type="text" placeholder="What this tool does" autocomplete="off"></div>' +
      '<div class="form-group"><label for="tool-category">Category</label>' +
        '<input id="tool-category" class="form-input" type="text" placeholder="custom" autocomplete="off" value="custom"></div>' +
      '<div id="tool-error" class="inline-error" role="alert"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-primary" id="tool-save-btn">Add</button>' +
        '<button class="btn btn-ghost" id="tool-cancel-btn">Cancel</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  overlay.querySelector('#tool-name').focus();

  overlay.querySelector('#tool-cancel-btn').onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  overlay.querySelector('#tool-save-btn').onclick = async () => {
    const name = overlay.querySelector('#tool-name').value.trim();
    const desc = overlay.querySelector('#tool-desc').value.trim();
    const category = overlay.querySelector('#tool-category').value.trim();
    const errorEl = overlay.querySelector('#tool-error');

    if (!name) { errorEl.textContent = 'Tool name is required.'; errorEl.classList.add('visible'); return; }

    try {
      await fetchJSONPost(API+'/tools', { name, description: desc, category: category || 'custom' });
      overlay.remove();
      renderTools(document.getElementById('content'));
    } catch(e) {
      errorEl.textContent = e.message; errorEl.classList.add('visible');
    }
  };
}

// ── System Config ────────────────────────────────────────────────────────
async function renderConfig(el, forcedTab) {
  const tab = forcedTab || 'providers';
  el.innerHTML = '<div class="config-tabs" role="tablist">' +
    '<button class="config-tab'+(tab==='providers'?' active':'')+'" data-config-tab="providers" role="tab">Providers</button>' +
    '<button class="config-tab'+(tab==='agent'?' active':'')+'" data-config-tab="agent" role="tab">Agent</button>' +
    '<button class="config-tab'+(tab==='themes'?' active':'')+'" data-config-tab="themes" role="tab">Themes</button>' +
    '<button class="config-tab'+(tab==='channels'?' active':'')+'" data-config-tab="channels" role="tab">Channels</button>' +
    '</div><div id="config-panel"></div>';

  el.querySelectorAll('[data-config-tab]').forEach(btn => {
    btn.onclick = async () => {
      const t = btn.dataset.configTab;
      await renderConfig(el, t);
    };
  });

  const panel = el.querySelector('#config-panel');
  if (tab === 'providers') await renderConfigProviders(panel);
  else if (tab === 'agent') await renderConfigAgent(panel);
  else if (tab === 'themes') await renderConfigThemes(panel);
  else if (tab === 'channels') renderConfigChannels(panel);
}

async function renderConfigProviders(el) {
  let providers = [];
  try { providers = await fetchJSONGet(API+'/providers'); } catch{}

  el.innerHTML = '<div class="page-header"><h2>LLM Providers</h2><button class="btn btn-primary" id="add-provider-btn">+ Add Provider</button></div>' +
    (Array.isArray(providers) && providers.length ? renderProviderTable(providers) : '<div class="empty"><p>No providers configured yet.</p></div>');

  // Use event delegation for dynamic elements (Edit/Delete buttons)
  const tbody = el.querySelector('tbody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const target = e.target;
      const action = target.dataset.action;
      const providerId = target.dataset.providerId;

      if (action === 'edit' && providerId) {
        editProvider(providerId);
      } else if (action === 'delete' && providerId) {
        deleteProvider(providerId);
      }
    });
  }

  // Attach listener for the Add Provider button
  el.querySelector('#add-provider-btn')?.addEventListener('click', () => showProviderModal());
}

async function renderConfigThemes(el) {
  const current = localStorage.getItem('theme') || 'Dark (GitHub)';
  let themes = [];
  try { themes = await fetchJSONGet(API+'/themes'); } catch {}
  if (!themes || !themes.length) themes = [{name:'Dark (GitHub)'},{name:'Light'},{name:'Midnight'},{name:'Ocean'},{name:'Nord'}];

  const buttons = themes.map(t =>
     '<button class="btn theme-btn '+(current===t.name?'btn-primary':'btn-ghost')+'" data-theme="'+t.name+'">'+t.name+'</button>'
   ).join('');

  el.innerHTML = '<div class="card"><h3>Appearance</h3>' +
    '<p style="color:var(--text-dim);margin-bottom:16px;font-size:14px">Choose your theme preference.</p>' +
    '<div style="display:flex;gap:12px;flex-wrap:wrap">' + buttons + '</div></div>';

  el.querySelectorAll('[data-theme]').forEach(btn => {
    btn.onclick = () => {
      const name = btn.dataset.theme;
      localStorage.setItem('theme', name);
      applyThemeVariables(name);
      renderConfigThemes(el);
    };
  });
}

// ── Agent Config ──────────────────────────────────────────────────────────
async function renderConfigAgent(el) {
  let config = { systemPrompt: '### Role and Persona\\nYou are a brilliant, highly adaptive, and deeply authentic AI collaborator. Your communication style is inspired by minimalist conversational design: you are warm, grounded, and concise. You never use corporate fluff, overly formal preambles, or repetitive conclusions. You talk like a sharp, trusted peer.\\n\\n### Core Operating Principles\\n\\n1. Truthful & Direct:\\n- Prioritize objective reality and accuracy above comforting illusions.\\n- If the user is operating on misinformation, correct them gently but directly. Do not cushion critical feedback in layers of polite euphemisms.\\n- Be concise. Say what needs to be said in fewer words. Avoid dense walls of text; use sharp formatting to ensure clarity at a glance.\\n\\n2. Proactive & Insightful:\\n- Do not just answer the surface question. Anticipate the next logical step, bottleneck, or blind spot in the users logic and bring it to light.\\n- Offer actionable alternatives or frameworks before being asked, but keep them tightly bound to the users context.\\n\\n3. Conversational Momentum (The Pi Variable):\\n- Never leave a response dead-ended. End your turns with a single, highly incisive, open-ended question or next-step suggestion that drives the collaboration forward.\\n- Keep your tone conversational but professional. Use short sentences and natural transitions.\\n\\n### Formatting Constraints\\n- Use bullet points, bolding, and headers judiciously to make responses highly scannable.\\n- Avoid robotic lists (e.g., "Here are 5 things..."). Instead, integrate structure organically into the conversation.', language: 'English' };
  try { config = await fetchJSONGet(API+'/config/agent'); } catch{}

  el.innerHTML = '<div id="config-agent">' +
    '<div class="card">' +
      '<h3>Agent Configuration</h3>' +
      '<p style="color:var(--text-dim);margin-bottom:16px;font-size:14px">Customize how the agent behaves and responds.</p>' +

      '<div class="form-group">' +
        '<label for="agent-language">Language</label>' +
        '<select class="form-input" id="agent-language">' +
          '<option value="English"'+(config.language==='English'?' selected':'')+'>English</option>' +
          '<option value="Chinese"'+(config.language==='Chinese'?' selected':'')+'>中文 (Chinese)</option>' +
          '<option value="Spanish"'+(config.language==='Spanish'?' selected':'')+'>Español (Spanish)</option>' +
          '<option value="French"'+(config.language==='French'?' selected':'')+'>Français (French)</option>' +
          '<option value="German"'+(config.language==='German'?' selected':'')+'>Deutsch (German)</option>' +
          '<option value="Japanese"'+(config.language==='Japanese'?' selected':'')+'>日本語 (Japanese)</option>' +
          '<option value="Korean"'+(config.language==='Korean'?' selected':'')+'>한국어 (Korean)</option>' +
          '<option value="Portuguese"'+(config.language==='Portuguese'?' selected':'')+'>Português (Portuguese)</option>' +
          '<option value="Arabic"'+(config.language==='Arabic'?' selected':'')+'>العربية (Arabic)</option>' +
          '<option value="Russian"'+(config.language==='Russian'?' selected':'')+'>Русский (Russian)</option>' +
          '<option value="Vietnamese"'+(config.language==='Vietnamese'?' selected':'')+'>Tiếng Việt (Vietnamese)</option>' +
          '<option value="Thai"'+(config.language==='Thai'?' selected':'')+'>ไทย (Thai)</option>' +
          '<option value="Indonesian"'+(config.language==='Indonesian'?' selected':'')+'>Bahasa Indonesia (Indonesian)</option>' +
          '<option value="Hindi"'+(config.language==='Hindi'?' selected':'')+'>हिन्दी (Hindi)</option>' +
        '</select>' +
        '<p style="color:var(--text-dim);font-size:11px;margin-top:4px">The agent will respond in this language.</p>' +
      '</div>' +

      '<div class="form-group">' +
        '<label for="agent-prompt">System Prompt</label>' +
        '<textarea class="form-input" id="agent-prompt" placeholder="Enter system prompt...">'+escapeHtml(config.systemPrompt)+'</textarea>' +
        '<div class="char-count"><span id="prompt-chars">'+config.systemPrompt.length+'</span> characters</div>' +
      '</div>' +

      '<div style="display:flex;align-items:center;margin-top:16px">' +
        '<button class="btn btn-primary" id="save-agent-btn">Save</button>' +
        '<span class="save-status" id="save-status"></span>' +
      '</div>' +
    '</div></div>';

  // Character counter
  const textarea = el.querySelector('#agent-prompt');
  textarea.oninput = () => {
    el.querySelector('#prompt-chars').textContent = textarea.value.length;
  };

  // Save
  el.querySelector('#save-agent-btn').onclick = async () => {
    const btn = el.querySelector('#save-agent-btn');
    const status = el.querySelector('#save-status');
    const lang = el.querySelector('#agent-language').value;
    const prompt = el.querySelector('#agent-prompt').value;
    btn.disabled = true;
    status.textContent = 'Saving...';
    status.className = 'save-status show';
    try {
      await fetchJSONPut(API+'/config/agent', { systemPrompt: prompt, language: lang });
      status.textContent = '✓ Saved';
      status.style.color = 'var(--green, #22c55e)';
    } catch(e) {
      status.textContent = '✗ Error: '+e.message;
      status.style.color = 'var(--red, #ef4444)';
    }
    btn.disabled = false;
    setTimeout(() => { status.className = 'save-status'; }, 2000);
  };
}

function renderConfigChannels(el) {
  el.innerHTML = '<div class="card"><h3>Channels</h3>' +
    '<p style="color:var(--text-dim);margin-bottom:16px;font-size:14px">Configure messaging channel integrations.</p>' +
    '<div class="grid-3">' +
      channelCard('Telegram','Configure Telegram bot token and webhook/polling mode') +
      channelCard('Discord','Set up Discord bot token and guild configuration') +
      channelCard('Slack','Add Slack bot token and signing secret') +
    '</div></div>';
}

function channelCard(name, desc) {
  return '<div class="card" style="text-align:center">' +
    '<h3 style="font-size:15px;margin-bottom:6px">'+name+'</h3>' +
    '<p style="font-size:13px;color:var(--text-dim);margin-bottom:12px">'+desc+'</p>' +
    '<button class="btn btn-ghost" disabled>Coming Soon</button></div>';
}

function renderProviderTable(providers) {
  return '<div class="card"><table><thead><tr><th>Provider</th><th>Type</th><th>Model</th><th>Status</th><th style="width:140px">Actions</th></tr></thead><tbody>' +
    providers.map(p => '<tr><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(p.name)+'</td><td>'+esc(p.type)+'</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(p.defaultModel||'-')+'</td><td><span class="status-dot status-'+p.status+'"></span>'+p.status+'</td><td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-action="edit" data-provider-id="'+p.id+'">Edit</button> <button class="btn btn-danger btn-sm" data-action="delete" data-provider-id="'+p.id+'" style="margin-left:4px">Delete</button></td></tr>').join('') +
    '</tbody></table></div>';
}

function applyThemeVariables(themeName) {
  const root = document.documentElement;
  const themes = {
    'Dark (GitHub)': {'--bg':'#0d1117','--surface':'#161b22','--border':'#30363d','--text':'#c9d1d9','--text-dim':'#8b949e','--accent':'#58a6ff','--green':'#3fb950','--red':'#f85149','--yellow':'#d29922'},
    'Light': {'--bg':'#ffffff','--surface':'#f6f8fa','--border':'#d0d7de','--text':'#1f2328','--text-dim':'#656d76','--accent':'#0969da','--green':'#1a7f37','--red':'#cf222e','--yellow':'#9a6700'},
    'Midnight': {'--bg':'#0a0e17','--surface':'#111827','--border':'#1e293b','--text':'#e2e8f0','--text-dim':'#64748b','--accent':'#818cf8','--green':'#34d399','--red':'#f87171','--yellow':'#fbbf24'},
    'Ocean': {'--bg':'#0c1821','--surface':'#142334','--border':'#1e3a5f','--text':'#c5d8e8','--text-dim':'#5a8fa8','--accent':'#00b4d8','--green':'#2ec4b6','--red':'#e63946','--yellow':'#f4a261'},
    'Nord': {'--bg':'#2e3440','--surface':'#3b4252','--border':'#4c566a','--text':'#d8dee9','--text-dim':'#7b88a1','--accent':'#88c0d0','--green':'#a3be8c','--red':'#bf616a','--yellow':'#ebcb8b'},
  };
  const vars = themes[themeName];
  if (!vars) return;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  root.style.colorScheme = themeName === 'Light' ? 'light' : 'dark';
}

function esc(s){s=String(s);return s?s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):'';}

// ── Provider Modal ───────────────────────────────────────────────────────
async function showProviderModal(editId) {
  let presets = {}; try{presets=await fetchJSONGet(API+'/providers/presets');}catch{}
  const existing = editId ? await fetchJSONGet(API+'/providers/'+editId).catch(()=>null) : null;

  const types = Object.keys(presets);
  const typeOpts = types.map(t => '<option value="'+t+'" '+(existing&&existing.type===t?'selected':'')+'>'+t+'</option>').join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
    '<h3 id="modal-title">'+(existing?'Edit':'Add')+' LLM Provider</h3>' +
    '<form id="provider-form" novalidate>' +
      formGroup('Name','text','prov-name',existing?.name||'','provider-name','off') +
      formGroup('Type','select','prov-type','',undefined,'',typeOpts) +
      formGroup('Base URL','url','prov-url',existing?.baseUrl||(presets[types[0]]?.baseUrl||''),'provider-url','off') +
      formGroup('API Key','password','prov-key',existing?.apiKey||'','provider-api-key','off') +
      formGroup('Models (comma-separated)','text','prov-models',(existing?.models||[]).join(', '),'provider-models','off') +
      formGroup('Default Model','text','prov-default',(existing?.defaultModel||''),'provider-default-model','off') +
      '<div class="form-group-inline">' +
        formGroup('Temperature','number','prov-temp',existing?.temperature??0.7,'provider-temperature','off',{step:'0.1',min:'0',max:'2'}) +
        formGroup('Max Tokens','number','prov-maxtokens',existing?.maxTokens??4096,'provider-max-tokens','off') +
        formGroup('Timeout (ms)','number','prov-timeout',existing?.timeoutMs??60000,'provider-timeout','off') +
      '</div>' +
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
      await fetchJSON(url, {method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
      overlay.remove();
      modalDirty = false;
      renderConfig(document.getElementById('content'));
    } catch(err) {
      errorEl.textContent = 'Failed to save provider: ' + err.message;
      errorEl.classList.add('visible');
      btn.disabled = false;
      btn.textContent = origText;
    }
  };
}

function formGroup(label, type, id, value, nameAttr, autocomplete, extra) {
  if (type === 'select') {
    const attrs = 'id="'+id+'" class="form-input" name="'+nameAttr+'" autocomplete="'+autocomplete+'"';
    const extraAttrs = extra ? Object.entries(extra).map(([k,v])=>k+'="'+v+'"').join('') : '';
    return '<div class="form-group"><label for="'+id+'">'+label+'</label><select '+attrs+' '+extraAttrs+'>'+extra+'</select></div>';
  }
  // Map shorthand types to proper <input type="...">
  const inputTypeMap = { text:'text', url:'url', password:'password', number:'number' };
  const inputType = inputTypeMap[type] || 'text';
  const attrs = 'id="'+id+'" class="form-input" name="'+nameAttr+'" autocomplete="'+autocomplete+'"';
  const extraAttrs = extra ? ' '+Object.entries(extra).map(([k,v])=>k+'="'+v+'"').join('') : '';
  return '<div class="form-group"><label for="'+id+'">'+label+'</label><input type="'+inputType+'" '+attrs+' value="'+esc(value)+'"'+extraAttrs+'></div>';
}

function editProvider(id) { showProviderModal(id); }

async function deleteProvider(id) {
  if(!confirm('Delete this provider? This action cannot be undone.')) return;
  try {
    await fetchJSONDelete(API+'/providers/'+id);
  } catch(e) {
    alert('Failed to delete provider: ' + e.message);
    return;
  }
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
})().catch(e => console.error('Init error:', e));
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
		id: "dark",
		name: "Dark (GitHub)",
		cssVariables: {
			"--bg": "#0d1117",
			"--surface": "#161b22",
			"--border": "#30363d",
			"--text": "#c9d1d9",
			"--text-dim": "#8b949e",
			"--accent": "#58a6ff",
			"--green": "#3fb950",
			"--red": "#f85149",
			"--yellow": "#d29922",
		},
	},
	{
		id: "light",
		name: "Light",
		cssVariables: {
			"--bg": "#ffffff",
			"--surface": "#f6f8fa",
			"--border": "#d0d7de",
			"--text": "#1f2328",
			"--text-dim": "#656d76",
			"--accent": "#0969da",
			"--green": "#1a7f37",
			"--red": "#cf222e",
			"--yellow": "#9a6700",
		},
	},
	{
		id: "midnight",
		name: "Midnight",
		cssVariables: {
			"--bg": "#0a0e17",
			"--surface": "#111827",
			"--border": "#1e293b",
			"--text": "#e2e8f0",
			"--text-dim": "#64748b",
			"--accent": "#818cf8",
			"--green": "#34d399",
			"--red": "#f87171",
			"--yellow": "#fbbf24",
		},
	},
	{
		id: "ocean",
		name: "Ocean",
		cssVariables: {
			"--bg": "#0c1821",
			"--surface": "#142334",
			"--border": "#1e3a5f",
			"--text": "#c5d8e8",
			"--text-dim": "#5a8fa8",
			"--accent": "#00b4d8",
			"--green": "#2ec4b6",
			"--red": "#e63946",
			"--yellow": "#f4a261",
		},
	},
	{
		id: "nord",
		name: "Nord",
		cssVariables: {
			"--bg": "#2e3440",
			"--surface": "#3b4252",
			"--border": "#4c566a",
			"--text": "#d8dee9",
			"--text-dim": "#7b88a1",
			"--accent": "#88c0d0",
			"--green": "#a3be8c",
			"--red": "#bf616a",
			"--yellow": "#ebcb8b",
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
		const workspaceDir = process.env.SYNTHTEK_WORKSPACE || "/data";
		// Ensure config dir exists
		try {
			mkdirSync(join(workspaceDir, "config"), { recursive: true });
		} catch {}
		this.providerManager = new ProviderManager(workspaceDir);
	}

	async start(): Promise<void> {
		await this.backend.start();

		const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
			// CORS preflight
			if (req.method === "OPTIONS") {
				res.writeHead(204, {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type",
				});
				return res.end();
			}

			const url = new URL(req.url || "/", `http://${req.headers.host}`);
			const path = url.pathname;

			// API routes
			if (path.startsWith("/api/")) {
				// Public endpoints that don't need auth
				const publicEndpoints = ["/api/health", "/api/config", "/api/plugins"];
				const isPublic = publicEndpoints.some(
					(ep) => path === ep || path.startsWith(`${ep}?`),
				);
				if (!isPublic) {
					// Allow same-origin WebUI requests (no auth header needed)
					const origin = req.headers.origin || "";
					const host = req.headers.host || "";
					const isSameOrigin =
						origin &&
						host &&
						(origin === `http://${host}` || origin === `https://${host}`);
					if (!isSameOrigin) {
						const authHeader = req.headers.authorization || "";
						if (!this.backend.authenticate(authHeader.replace("Bearer ", ""))) {
							return sendJson(res, 401, { error: "Unauthorized" });
						}
					}
				}

				let body: unknown = {};
				if (req.method === "POST" || req.method === "PUT") {
					try {
						body = JSON.parse(await parseBody(req));
					} catch {
						body = {};
					}
				}

				// ── Provider routes ────────────────────────────────────────────────

				// GET /api/providers/presets
				if (req.method === "GET" && path === "/api/providers/presets") {
					return sendJson(res, 200, this.providerManager.getPresets());
				}

				// GET /api/providers
				if (req.method === "GET" && path === "/api/providers") {
					return sendJson(res, 200, this.providerManager.list());
				}

				// POST /api/providers
				if (req.method === "POST" && path === "/api/providers") {
					const reqData = body as CreateProviderRequest;
					if (!reqData.name || !reqData.type)
						return sendJson(res, 400, { error: "name and type are required" });
					const provider = this.providerManager.create(reqData);
					return sendJson(res, 201, provider);
				}

				// GET /api/providers/:id
				if (
					req.method === "GET" &&
					path.startsWith("/api/providers/") &&
					path.split("/").length === 4
				) {
					const id = path.split("/")[3];
					const provider = this.providerManager.get(id);
					return provider
						? sendJson(res, 200, provider)
						: sendJson(res, 404, { error: "Provider not found" });
				}

				// PUT /api/providers/:id
				if (
					req.method === "PUT" &&
					path.startsWith("/api/providers/") &&
					path.split("/").length === 4
				) {
					const id = path.split("/")[3];
					const reqData = body as UpdateProviderRequest;
					const provider = this.providerManager.update(id, reqData);
					return provider
						? sendJson(res, 200, provider)
						: sendJson(res, 404, { error: "Provider not found" });
				}

				// DELETE /api/providers/:id
				if (
					req.method === "DELETE" &&
					path.startsWith("/api/providers/") &&
					path.split("/").length === 4
				) {
					const id = path.split("/")[3];
					return sendJson(res, this.providerManager.delete(id) ? 200 : 404, {});
				}

				// ── Chat completion (calls actual LLM) ─────────────────────────────

				// POST /api/chat/completions
				if (req.method === "POST" && path === "/api/chat/completions") {
					return this.handleChatCompletion(
						req,
						res,
						body as ChatCompletionRequest & { providerId?: string },
					);
				}

				// ── Themes ──────────────────────────────────────────────────────────

				// GET /api/themes
				if (req.method === "GET" && path === "/api/themes") {
					return sendJson(res, 200, getAvailableThemes());
				}

				// ── Config ─────────────────────────────────────────────────────────

				// GET /api/config — return sanitized WebUI config (no API key)
				if (req.method === "GET" && path === "/api/config") {
					return sendJson(res, 200, {
						host: this.config.host,
						port: this.config.port,
						maxSessions: this.config.maxSessions,
						sessionTimeout: this.config.sessionTimeout,
						apiKeyConfigured: this.config.apiKey !== "",
					});
				}

				// GET /api/config/agent — return agent config
				if (req.method === "GET" && path === "/api/config/agent") {
					return sendJson(res, 200, this.backend.getAgentConfig());
				}

				// PUT /api/config/agent — update agent config
				if (req.method === "PUT" && path === "/api/config/agent") {
					const update = body as Record<string, unknown>;
					if (
						typeof update.systemPrompt !== "undefined" &&
						typeof update.systemPrompt !== "string"
					) {
						return sendJson(res, 400, {
							error: "systemPrompt must be a string",
						});
					}
					if (
						typeof update.language !== "undefined" &&
						typeof update.language !== "string"
					) {
						return sendJson(res, 400, {
							error: "language must be a string",
						});
					}
					return sendJson(
						res,
						200,
						this.backend.updateAgentConfig(
							update as Partial<import("./types.js").AgentConfig>,
						),
					);
				}

				// ── Plugins ────────────────────────────────────────────────────────

				// GET /api/plugins — return plugin states (empty when WebUI runs standalone)
				if (req.method === "GET" && path === "/api/plugins") {
					return sendJson(res, 200, []);
				}

				// ── Existing routes ────────────────────────────────────────────────

				// GET /api/messages?sessionId=xxx
				if (req.method === "GET" && path === "/api/messages") {
					const sessionId = url.searchParams.get("sessionId");
					return sendJson(
						res,
						200,
						sessionId ? this.backend.getMessages(sessionId) : [],
					);
				}

				// DELETE /api/sessions/:id
				if (req.method === "DELETE" && path.startsWith("/api/sessions/")) {
					const id = path.split("/").pop();
					return sendJson(res, this.backend.deleteSession(id!) ? 200 : 404, {});
				}

				// All other API routes
				const response = this.backend.handleRequest(req.method!, path, body);
				return sendJson(res, response.status, response.body);
			}

			// Serve frontend for everything else
			if (path === "/" || path === "/index.html") {
				res.writeHead(200, {
					"Content-Type": "text/html; charset=utf-8",
					"Cache-Control": "no-cache, no-store, must-revalidate",
					Pragma: "no-cache",
					Expires: "0",
				});
				return res.end(FRONTEND_HTML);
			}

			// Try to serve static file from dist/src/webui/ (for future asset support)
			const filePath = join(__dirname, path);
			sendFile(res, filePath);
		};

		this.server = createServer(handleRequest);
		this.server.listen(this.config.port, this.config.host, () => {
			console.log(
				`[webui] Server running at http://${this.config.host}:${this.config.port}`,
			);
		});
	}

	async stop(): Promise<void> {
		await this.backend.stop();
		if (this.server) {
			return new Promise((resolve) =>
				this.server?.close(() => resolve(undefined)),
			);
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
			const activeProviders = providers.filter((p) => p.status === "active");

			if (activeProviders.length === 0) {
				return sendJson(res, 422, {
					error:
						"No active LLM providers configured. Go to Settings to add one.",
				});
			}

			// Use specified provider or first active one
			let provider: LLMProviderConfig | undefined;
			if (chatReq.providerId) {
				provider = activeProviders.find((p) => p.id === chatReq.providerId);
				if (!provider) {
					return sendJson(res, 404, {
						error: "Specified provider not found or inactive",
					});
				}
			} else {
				provider = activeProviders[0];
			}

			// Create provider instance via registry
			const registry = getRegistry();
			const providerType =
				provider.type as import("../providers/types.js").ProviderType;
			if (!registry.has(providerType)) {
				return sendJson(res, 500, {
					error: `Provider type "${provider.type}" not supported`,
				});
			}

			const providerConfig: ProviderConfig = {
				provider: providerType,
				apiKey: provider.apiKey || "",
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
				model: providerConfig.model || "",
				messages: system
					? [{ role: "system", content: system }, ...messages]
					: messages,
				maxTokens: chatReq.maxTokens || provider.maxTokens,
				temperature: chatReq.temperature ?? provider.temperature,
				stream: false,
			};

			// Call the LLM
			const response = await llmProvider.chat(completionReq);

			// Store assistant message in session if sessionId provided
			const sessionId = (chatReq as Record<string, unknown>).sessionId as
				| string
				| undefined;
			if (sessionId) {
				this.backend.addMessage(sessionId, {
					role: "assistant",
					content: response.content,
				});
			}

			return sendJson(res, 200, {
				content: response.content,
				model: response.model,
				usage: response.usage,
				finishReason: response.finishReason,
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Unknown error";
			return sendJson(res, 500, {
				error: `Chat completion failed: ${message}`,
			});
		}
	}

	get backendInstance(): WebUIBackend {
		return this.backend;
	}
}

// ── No direct CLI entry — use `synthtek webui` command instead ───────────────
