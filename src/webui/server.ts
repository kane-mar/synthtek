/**
 * WebUI HTTP Server
 *
 * Wraps WebUIBackend with a real Node.js HTTP server and serves the frontend.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebUIBackend } from './backend.js';
import type { WebUIConfig } from './types.js';

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

// ── Frontend HTML (embedded to avoid external assets) ───────────────────────

const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Synthtek WebUI</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --bg: #0d1117; --surface: #161b22; --border: #30363d; --text: #c9d1d9; --accent: #58a6ff; --user-bg: #1f6feb; --ai-bg: #21262d; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); height: 100vh; display: flex; flex-direction: column; }
  header { padding: 12px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: var(--surface); }
  header h1 { font-size: 16px; color: var(--accent); }
  #status { font-size: 12px; color: #8b949e; }
  #chat { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
  .message { max-width: 75%; padding: 10px 14px; border-radius: 12px; line-height: 1.5; font-size: 14px; word-wrap: break-word; white-space: pre-wrap; }
  .user { align-self: flex-end; background: var(--user-bg); color: #fff; border-bottom-right-radius: 4px; }
  .assistant { align-self: flex-start; background: var(--ai-bg); border: 1px solid var(--border); border-bottom-left-radius: 4px; }
  .system { align-self: center; font-size: 12px; color: #8b949e; font-style: italic; }
  #input-area { padding: 16px 20px; border-top: 1px solid var(--border); display: flex; gap: 10px; background: var(--surface); }
  #message-input { flex: 1; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 14px; outline: none; resize: none; }
  #message-input:focus { border-color: var(--accent); }
  #send-btn { padding: 10px 20px; border-radius: 8px; border: none; background: var(--accent); color: #fff; font-weight: 600; cursor: pointer; white-space: nowrap; }
  #send-btn:hover { opacity: 0.9; }
  #send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
</head>
<body>
<header><h1>Synthtek WebUI</h1><span id="status">Connecting...</span></header>
<div id="chat"></div>
<div id="input-area">
  <textarea id="message-input" rows="1" placeholder="Type a message..."></textarea>
  <button id="send-btn">Send</button>
</div>
<script>
const chat = document.getElementById('chat');
const input = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const statusEl = document.getElementById('status');
let sessionId = null;

async function init() {
  try {
    const res = await fetch('/api/health');
    if (res.ok) { statusEl.textContent = 'Connected'; }
    else { statusEl.textContent = 'Server error'; return; }
  } catch(e) { statusEl.textContent = 'Disconnected'; return; }

  // Create or reuse session
  const sessRes = await fetch('/api/sessions', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({userId:'web'}) });
  if (sessRes.ok) { sessionId = (await sessRes.json()).id; }

  // Load history
  if (sessionId) {
    const msgRes = await fetch('/api/messages?sessionId=' + sessionId);
    if (msgRes.ok) {
      for (const m of await msgRes.json()) appendMessage(m.role, m.content);
    }
  }
}

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = 'message ' + role;
  div.textContent = content;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text || !sessionId) return;
  appendMessage('user', text);
  input.value = ''; sendBtn.disabled = true;

  try {
    await fetch('/api/messages', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ sessionId, role:'user', content:text }) });
    // For now, echo back — real agent integration would stream response
    appendMessage('assistant', '(Agent response pending — connect an LLM provider for replies)');
  } catch(e) { appendMessage('system', 'Error sending message'); }
  sendBtn.disabled = false; input.focus();
}

sendBtn.addEventListener('click', sendMessage);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 150) + 'px'; });

init();
</script>
</body>
</html>`;

// ── Server ──────────────────────────────────────────────────────────────────

export class WebUIServer {
  private backend: WebUIBackend;
  private server: ReturnType<typeof createServer> | null = null;

  constructor(private config: WebUIConfig) {
    this.backend = new WebUIBackend(config);
  }

  async start(): Promise<void> {
    await this.backend.start();

    const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
      // CORS preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
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
        if ((req.method === 'POST' || req.method === 'DELETE') && this.config.apiKey) {
          const authHeader = req.headers['authorization'];
          if (authHeader !== `Bearer ${this.config.apiKey}`) {
            return sendJson(res, 401, { error: 'Unauthorized' });
          }
        }

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
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
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

  get backendInstance(): WebUIBackend {
    return this.backend;
  }
}

// ── No direct CLI entry — use `synthtek webui` command instead ───────────────
