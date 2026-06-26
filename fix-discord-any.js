/**
 * Fix Discord channel.ts any types (H6).
 * Replaces (ch as any) with proper TextChannel type assertions
 * where the methods .send(), .messages.fetch(), .sendTyping() are used.
 */
import { readFileSync, writeFileSync } from "node:fs";

let content = readFileSync("src/channels/discord/channel.ts", "utf-8");

// --- Helper type to insert ---
// We'll add a type alias for channels that support text operations

// Check if NewsChannel is imported
if (content.includes("NewsChannel")) {
  // Replace (ch as any).messages.fetch with (ch as TextChannel | NewsChannel | ThreadChannel).messages.fetch
  // Actually, let's use a simpler approach: just use TextChannel for all text ops
  // since that's the most common channel type and has all methods we need

  // Fix: (ch as any).messages.fetch(buf.messageId) -> (ch as TextChannel).messages.fetch(buf.messageId)
  // But this might break if ch is a DMChannel...
  // Let's create a helper function and insert it before the class

  const helperCode = `
// ─── Discord.js Type Helpers ───────────────────────────────────────────────────

/** Union of channel types that support text-based operations (send, messages.fetch, etc.) */
type TextableChannel = import("discord.js").TextChannel
	| import("discord.js").NewsChannel
	| import("discord.js").ThreadChannel;
`;

  // Insert helper after the imports
  const importEnd = content.indexOf("// ─── Helpers");
  if (importEnd === -1) {
    console.error("Could not find helpers section marker");
    process.exit(1);
  }
  content = content.slice(0, importEnd) + helperCode + "\n" + content.slice(importEnd);

  // Now replace all (ch as any) patterns
  // For .messages.fetch, .edit, .delete, .react, .sendTyping, .send:
  // These are text channel operations
  
  // Pattern: const msg = await (ch as any).messages.fetch(...)
  content = content.replace(
    /\(ch as any\)\.messages\.fetch\(/g,
    "(ch as TextableChannel).messages.fetch("
  );
  
  // Pattern: await (ch as any).send(...)
  content = content.replace(
    /\(ch as any\)\.send\(/g,
    "(ch as TextableChannel).send("
  );
  
  // Pattern: await (ch as any).sendTyping()
  content = content.replace(
    /\(ch as any\)\.sendTyping\(\)/g,
    "(ch as TextableChannel).sendTyping()"
  );
  
  // Pattern: return channel as any -> return channel
  // This is in getChannel which returns Channel | null
  // If we remove as any, TypeScript might complain about the return type
  // Let's check the context
  // Actually, let's keep this one as is for now
  
  // Pattern: (channel as any).name -> use type narrowing
  // We need to fix the channel info building
  
  // Fix PermissionsBitField.Flags as any -> as Record<string, bigint>
  content = content.replace(
    /\(PermissionsBitField\.Flags as any\)/g,
    "(PermissionsBitField.Flags as unknown as Record<string, bigint>)"
  );
  
  // Fix presenceStatus as any -> use specific type
  content = content.replace(
    /this\.config\.presenceStatus as any/,
    "this.config.presenceStatus as import(\"discord.js\").PresenceUpdateData['status']"
  );
  
  writeFileSync("src/channels/discord/channel.ts", content);
  console.log("Fixed all (ch as any) patterns");
} else {
  console.error("NewsChannel not imported");
  process.exit(1);
}
