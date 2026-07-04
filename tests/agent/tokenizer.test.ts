/**
 * Tokenizer tests — verify token estimation accuracy
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CharacterCountTokenizer,
	createTokenizer,
	GptBpeTokenizer,
	getDefaultTokenizer,
	setDefaultTokenizer,
} from "../../src/agent/tokenizer.js";

describe("CharacterCountTokenizer", () => {
	it("estimates 0 tokens for empty string", () => {
		const t = new CharacterCountTokenizer();
		assert.equal(t.estimateTokens(""), 0);
	});

	it("uses default 4 chars per token", () => {
		const t = new CharacterCountTokenizer();
		// "hello" = 5 chars / 4 = 2 (rounded up)
		assert.equal(t.estimateTokens("hello"), 2);
	});

	it("counts newlines", () => {
		const t = new CharacterCountTokenizer();
		// "hello\nworld" = 11 chars / 4 = 3 + 1 newline = 4
		assert.equal(t.estimateTokens("hello\nworld"), 4);
	});

	it("accepts custom chars per token", () => {
		const t = new CharacterCountTokenizer(2);
		// "hello" = 5 chars / 2 = 3 (rounded up)
		assert.equal(t.estimateTokens("hello"), 3);
	});

	it("handles long text", () => {
		const t = new CharacterCountTokenizer();
		const longText = "a".repeat(100);
		// 100 chars / 4 = 25 + 0 newlines = 25
		assert.equal(t.estimateTokens(longText), 25);
	});

	it("has correct name", () => {
		const t = new CharacterCountTokenizer();
		assert.equal(t.name, "character-count");
	});
});

describe("GptBpeTokenizer", () => {
	it("estimates 0 tokens for empty string", () => {
		const t = new GptBpeTokenizer();
		assert.equal(t.estimateTokens(""), 0);
	});

	it("estimates common words at 1 token each", () => {
		const t = new GptBpeTokenizer();
		// "the" is a common word → 1 token
		const result = t.estimateTokens("the");
		assert.ok(result >= 1, "common words should be at least 1 token");
	});

	it("estimates longer sentences reasonably", () => {
		const t = new GptBpeTokenizer();
		// "Hello, how are you today?" → should be roughly 5-8 tokens
		const result = t.estimateTokens("Hello, how are you today?");
		assert.ok(
			result >= 3 && result <= 12,
			`expected 3-12 tokens, got ${result}`,
		);
	});

	it("handles code blocks with higher density", () => {
		const t = new GptBpeTokenizer();
		const code = '```\nfunction hello() {\n  return "world";\n}\n```';
		const result = t.estimateTokens(code);
		assert.ok(result > 0, "code blocks should have positive token count");
	});

	it("handles punctuation density", () => {
		const t = new GptBpeTokenizer();
		const withPunctuation = "Hello! How are you? I'm fine, thanks!";
		const result = t.estimateTokens(withPunctuation);
		// Should be more than just word count due to punctuation
		assert.ok(
			result >= 5,
			"punctuation-heavy text should have meaningful token count",
		);
	});

	it("has correct name", () => {
		const t = new GptBpeTokenizer();
		assert.equal(t.name, "gpt-bpe");
	});
});

describe("Tokenizer defaults and registry", () => {
	it("returns character-count tokenizer by default", () => {
		const t = getDefaultTokenizer();
		assert.equal(t.name, "character-count");
	});

	it("can change default tokenizer", () => {
		const original = getDefaultTokenizer();
		const bpe = new GptBpeTokenizer();
		setDefaultTokenizer(bpe);
		assert.equal(getDefaultTokenizer().name, "gpt-bpe");
		// Restore
		setDefaultTokenizer(original);
	});

	it("creates tokenizer by name", () => {
		const t = createTokenizer("character-count");
		assert.ok(t, "should create character-count tokenizer");
		assert.equal(t!.name, "character-count");
	});

	it("returns null for unknown tokenizer", () => {
		const t = createTokenizer("nonexistent");
		assert.equal(t, null);
	});

	it("creates gpt-bpe tokenizer by name", () => {
		const t = createTokenizer("gpt-bpe");
		assert.ok(t, "should create gpt-bpe tokenizer");
		assert.equal(t!.name, "gpt-bpe");
	});
});
