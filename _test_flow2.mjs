// Simulate TUI then WebUI frontend flow
import http from "node:http";

const API = "http://127.0.0.1:8080";

function fetch(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API);
    const opts = {
      method, hostname: url.hostname, port: url.port,
      path: url.pathname + url.search,
      headers: { "Content-Type": "application/json" },
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Step 1: Fresh start
  console.log("=== Step 1: TUI creates a conversation ===");
  const { ConversationStore } = await import("/app/dist/src/messaging/conversation-store.js");
  const store = new ConversationStore("/data");
  const conv = store.create("My TUI Chat");
  store.addMessage(conv.id, { role: "user", content: "hello from tui" });
  store.addMessage(conv.id, { role: "assistant", content: "hi back" });
  console.log(`Created ${conv.id} with ${store.get(conv.id)?.messages.length} messages`);

  // Step 2: Simulate WebUI page load
  console.log("\n=== Step 2: WebUI page loads ===");
  const sessions = await fetch("GET", "/api/sessions");
  console.log(`API returns ${sessions.length} sessions`);
  sessions.forEach(s => console.log(`  id=${s.id} msgs=${s.messages?.length || 0}`));

  let sid;
  if (Array.isArray(sessions) && sessions.length > 0) {
    sid = sessions[0].id;
    console.log(`\nFrontend picks: ${sid}`);
  } else {
    const s = await fetch("POST", "/api/sessions", { userId: "web" });
    sid = s.id;
    console.log(`\nFrontend creates new: ${sid}`);
  }

  const history = await fetch("GET", `/api/messages?sessionId=${sid}`);
  console.log(`Loads ${history.length} messages:`);
  history.forEach(m => console.log(`  ${m.role}: ${m.content.substring(0,50)}`));

  const found = history.some(m => m.content === "hello from tui");
  console.log(`\nTUI message visible: ${found ? "✅ YES" : "❌ NO"}`);
  if (!found) process.exit(1);
}

main().catch(console.error);
