/**
 * Agent Response Formatter — Formats LLM responses according to configured format
 * Extracted from AgentLoop for single-responsibility.
 */

import type { AgentLoopConfig } from './types.js';

export type ResponseFormat = 'markdown' | 'json' | 'plain' | 'structured';

/**
 * Strips common markdown syntax from text.
 */
function stripMarkdown(text: string): string {
  return text
    // Code blocks (remove entirely, including language tag and content)
    .replace(/```[\s\S]*?```/g, '')
    // Headers
    .replace(/^#{1,6}\s+.+/gm, (m) => m.replace(/#/g, '').trim())
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Italic
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '$1')
    // Inline code (remove backticks, keep content)
    .replace(/`(.+?)`/g, '$1')
    // Links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Blockquotes
    .replace(/^>\s+.+/gm, (m) => m.replace(/^>\s+/, ''))
    // Unordered lists (remove markers entirely)
    .replace(/^\s*[-*+]\s+/gm, '')
    // Ordered lists
    .replace(/^\s*\d+\.\s+/gm, '')
    // Horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Trim excess whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export class ResponseFormatter {
  private readonly defaultFormat: ResponseFormat;

  constructor(config?: Partial<AgentLoopConfig>) {
    this.defaultFormat = config?.responseFormat ?? 'markdown';
  }

  /**
   * Format a response string according to the specified format.
   */
  format(content: string, format: ResponseFormat = this.defaultFormat): string {
    switch (format) {
      case 'markdown':
        return this.formatMarkdown(content);
      case 'json':
        return this.formatJson(content);
      case 'plain':
        return this.formatPlain(content);
      case 'structured':
        return this.formatStructured(content);
    }
  }

  /** Detect the format from config or default to markdown */
  detectFormat(): ResponseFormat {
    return this.defaultFormat;
  }

  private formatMarkdown(content: string): string {
    return content;
  }

  private formatJson(content: string): string {
    // If content is valid JSON, pretty-print it directly
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Not valid JSON — wrap in envelope
      return JSON.stringify({
        content,
        format: 'json',
        isRawText: true,
        timestamp: new Date().toISOString(),
      }, null, 2);
    }
  }

  private formatPlain(content: string): string {
    return stripMarkdown(content);
  }

  private formatStructured(content: string): string {
    let type: string = 'text';
    let isStructured = false;
    let isMarkdown = false;
    let data: unknown = content;
    let wordCount = 0;
    const charCount = content.length;

    // Check if content is valid JSON
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        type = 'array';
        isStructured = true;
        data = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        type = 'object';
        isStructured = true;
        data = parsed;
      }
    } catch {
      // Not JSON — check for markdown
      isMarkdown = /[#*`>\-]/.test(content);
      wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;
    }

    const structured = {
      format: 'structured',
      data,
      metadata: {
        isStructured,
        type,
        wordCount,
        charCount,
        isMarkdown,
      },
    };
    return JSON.stringify(structured, null, 2);
  }
}
