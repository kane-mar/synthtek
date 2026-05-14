/**
 * Chat Component Tests – Markdown Rendering
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ChatComponent } from '../../src/webui/frontend/chat.js';

describe('ChatComponent Markdown Rendering', () => {
  let chat: ChatComponent;

  beforeEach(() => {
    chat = new ChatComponent('session_1');
  });

  describe('renderMarkdown', () => {
    it('should render code blocks with language', () => {
      const html = chat.renderMarkdown('```python\nprint("hello")\n```');
      assert.ok(html.includes('<pre'), 'Should contain pre element');
      assert.ok(html.includes('language-python'), 'Should have language class');
      assert.ok(html.includes('print('), 'Should contain code content');
    });

    it('should render inline code', () => {
      const html = chat.renderMarkdown('Use `console.log()` for debugging');
      assert.ok(html.includes('<code>console.log()</code>'), 'Should render inline code');
    });

    it('should render bold text', () => {
      const html = chat.renderMarkdown('This is **bold** text');
      assert.ok(html.includes('<strong>bold</strong>'), 'Should render bold');
    });

    it('should render italic text', () => {
      const html = chat.renderMarkdown('This is *italic* text');
      assert.ok(html.includes('<em>italic</em>'), 'Should render italic');
    });

    it('should render links', () => {
      const html = chat.renderMarkdown('Check [GitHub](https://github.com) for more');
      assert.ok(html.includes('<a href="https://github.com">GitHub</a>'), 'Should render link');
    });

    it('should render unordered lists', () => {
      const html = chat.renderMarkdown('- Item 1\n- Item 2\n- Item 3');
      assert.ok(html.includes('<ul>'), 'Should contain ul element');
      assert.ok(html.includes('<li>Item 1</li>'), 'Should contain list items');
    });

    it('should render ordered lists', () => {
      const html = chat.renderMarkdown('1. First\n2. Second\n3. Third');
      assert.ok(html.includes('<ol>'), 'Should contain ol element');
      assert.ok(html.includes('<li>First</li>'), 'Should contain list items');
    });

    it('should render headings', () => {
      const html = chat.renderMarkdown('## Heading 2');
      assert.ok(html.includes('<h2>Heading 2</h2>'), 'Should render h2');
    });

    it('should render blockquotes', () => {
      const html = chat.renderMarkdown('> This is a quote');
      assert.ok(html.includes('<blockquote>'), 'Should contain blockquote');
      assert.ok(html.includes('This is a quote'), 'Should contain quote content');
    });

    it('should render horizontal rules', () => {
      const html = chat.renderMarkdown('---');
      assert.ok(html.includes('<hr'), 'Should contain hr element');
    });

    it('should handle plain text without markdown', () => {
      const html = chat.renderMarkdown('Just plain text');
      assert.equal(html, 'Just plain text');
    });

    it('should handle empty string', () => {
      const html = chat.renderMarkdown('');
      assert.equal(html, '');
    });
  });

  describe('render with markdown', () => {
    it('should render assistant messages with markdown', () => {
      chat.addMessage('assistant', 'Here is **bold** and `code`');
      const html = chat.render();
      assert.ok(html.includes('<strong>bold</strong>'), 'Should render markdown in assistant messages');
      assert.ok(html.includes('<code>code</code>'), 'Should render inline code in assistant messages');
    });

    it('should not render markdown for user messages', () => {
      chat.addMessage('user', 'Here is **bold** and `code`');
      const html = chat.render();
      // User messages should have HTML-escaped content (no <strong> or <code> tags)
      assert.ok(!html.includes('<strong>'), 'Should not render bold for user messages');
      assert.ok(!html.includes('<code>'), 'Should not render code for user messages');
    });
  });
});
