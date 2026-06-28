import http from "node:http";

const API = "http://127.0.0.1:8080";

function fetch(method, path) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, API);
    const r = http.request(
      { method, hostname: u.hostname, port: u.port, path: u.pathname + u.search },
      (resp) => {
        let d = "";
        resp.on("data", (c) => (d += c));
        resp.on("end", () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
      }
    );
    r.on("error", reject);
    r.end();
  });
}

async function main() {
  const { ConversationStore } = await import("/app/dist/src/messaging/conversation-store.js");
  const store = new ConversationStore("/data");
  const conv = store.create("E2E final check");
  store.addMessage(conv.id, { role: "user", content: "test from tui" });
  store.addMessage(conv.id, { role: "assistant", content: "ok" });

  const sessions = await fetch("GET", "/api/sessions");
  const found = sessions.some((s) => s.id === conv.id);
  console.log("TUI conv in WebUI API:", found ? "✅ YES" : "❌ NO");
  if (!found) process.exit(1);

  // Check messages can be loaded
  const msgs = await fetch("GET", `/api/messages?sessionId=${conv.id}`);
  console.log("Messages for TUI conv:", msgs.length);
  msgs.forEach((m) => console.log(`  ${m.role}: ${m.content}`));
}

main().catch(console.error);
