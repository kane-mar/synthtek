import { ConversationStore } from "./dist/src/messaging/conversation-store.js";

const store = new ConversationStore("/data");
store.reload();
console.log("Existing:", store.list().length);

// Create a conversation as the TUI would
const conv = store.create("TUI test");
store.addMessage(conv.id, { role: "user", content: "hello from tui" });
store.addMessage(conv.id, { role: "assistant", content: "hi back" });
console.log("Created:", conv.id, "messages:", conv.messages.length);
console.log("Store has:", store.list().length, "convs");

// Print all
for (const c of store.list()) {
  console.log("  ->", c.id, c.title, c.messages.length, "msgs");
}
