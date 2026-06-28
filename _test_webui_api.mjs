// Simulate exactly what the WebUI frontend does
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
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Parse error: ${data.substring(0, 100)}`));
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Step 1: Load sessions (exactly like WebUI frontend)
  const sessions = await fetch("GET", "/api/sessions");
  console.log("Sessions count:", sessions.length);
  for (const s of sessions) {
    console.log(`  id=${s.id} msgs=${s.messages?.length || 0} last=${new Date(s.lastActivity).toISOString()}`);
  }

  if (sessions.length === 0) {
    // Create a new one like frontend does
    const s = await fetch("POST", "/api/sessions", { userId: "web" });
    console.log("Created session:", s.id);
    sessions.push(s);
  }

  const firstSession = sessions[0];
  console.log("\nPicked session:", firstSession.id);

  // Step 2: Load messages (exactly like WebUI frontend)
  const msgs = await fetch("GET", `/api/messages?sessionId=${firstSession.id}`);
  console.log("Messages:", msgs.length);
  for (const m of msgs) {
    console.log(`  ${m.role}: ${m.content.substring(0, 60)}`);
  }

  // Check if there are any conv_-prefixed conversations in the list
  const tuiConvs = sessions.filter((s) => s.id.startsWith("conv_"));
  console.log("\nTUI conversations in session list:", tuiConvs.length);
}

main().catch(console.error);
