// Exact simulation of WebUI frontend init flow
import http from "node:http";

const API = "http://127.0.0.1:8080";

function fetch(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { "Content-Type": "application/json" },
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Parse error: ${data.substring(0,200)}`)); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // 1. First, simulate TUI creating a conversation
  const { ConversationStore } = await import("/app/dist/src/messaging/conversation-store.js");
  const store = new ConversationStore("/data");
  
  // Check if there's already a WebUI session — if so, use it as the TUI
  const existing = store.list();
  let tuiConv;
  if (existing.some(c => c.messages.some(m => m.role === "user" && m.content.startsWith("TUI test message")))) {
    console.log("TUI conv already exists");
    tuiConv = existing.find(c => c.messages.some(m => m.content.startsWith("TUI test message")));
  } else {
    tuiConv = store.create("TUI test");
    store.addMessage(tuiConv.id, { role: "user", content: "TUI test message" });
    store.addMessage(tuiConv.id, { role: "assistant", content: "TUI response" });
  }
  console.log("TUI conv:", tuiConv.id, "msgs:", tuiConv.messages.length);

  // 2. Now simulate EXACTLY what the WebUI frontend does
  console.log("\n--- Simulating WebUI frontend init (page load) ---");
  
  const sessions = await fetch("GET", "/api/sessions");
  console.log("  GET /api/sessions →", sessions.length, "sessions");
  for (const s of sessions) {
    console.log(`    id=${s.id} msgs=${s.messages?.length || 0}`);
  }

  // Frontend: if sessions exist, pick first; else create new
  let sessionId;
  if (Array.isArray(sessions) && sessions.length > 0) {
    sessionId = sessions[0].id;
    console.log("  Picked existing session:", sessionId);
  } else {
    const s = await fetch("POST", "/api/sessions", { userId: "web" });
    sessionId = s.id;
    console.log("  Created new session:", sessionId);
  }

  // Frontend: load messages for that session
  const history = await fetch("GET", `/api/messages?sessionId=${sessionId}`);
  console.log("\n  GET /api/messages?sessionId=" + sessionId);
  console.log("  →", history.length, "messages");
  
  if (history.length === 0) {
    console.log("  ❌ NO MESSAGES LOADED — WebUI would show empty chat");
  } else {
    for (const m of history) {
      console.log(`    ${m.role}: ${m.content.substring(0, 60)}`);
    }
    console.log("  ✅ Messages loaded successfully — WebUI would display them");
  }

  // 3. Also verify the TUI message is somewhere in the sessions list
  const tuiSessions = sessions.filter(s => 
    s.messages?.some(m => m.content === "TUI test message")
  );
  if (tuiSessions.length > 0) {
    console.log("\n✅ TUI conversation found in session list (would be accessible via session selector)");
  } else {
    console.log("\n❌ TUI conversation NOT found in session list");
  }
}

main().catch(console.error);
