/**
 * Chat Component Tests – Message Input
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ChatComponent } from '../../src/webui/frontend/chat.js';

describe('ChatComponent Message Input', () => {
  let chat: ChatComponent;

  beforeEach(() => {
    chat = new ChatComponent('session_1');
  });

  describe('sendMessage', () => {
    it('should add a user message and clear input', () => {
      chat.sendMessage('Hello world');
      assert.equal(chat.getMessageCount(), 1);
      assert.equal(chat.state.messages[0].role, 'user');
      assert.equal(chat.state.messages[0].content, 'Hello world');
    });

    it('should not send empty messages', () => {
      chat.sendMessage('');
      assert.equal(chat.getMessageCount(), 0);
    });

    it('should not send whitespace-only messages', () => {
      chat.sendMessage('   ');
      assert.equal(chat.getMessageCount(), 0);
    });

    it('should trim message content', () => {
      chat.sendMessage('  hello  ');
      assert.equal(chat.state.messages[0].content, 'hello');
    });
  });

  describe('renderInput', () => {
    it('should render an input field and send button', () => {
      const html = chat.renderInput();
      assert.ok(html.includes('<input'), 'Should contain input element');
      assert.ok(html.includes('<button'), 'Should contain button element');
      assert.ok(html.includes('chat-input'), 'Should have chat-input class');
    });

    it('should disable input while streaming', () => {
      chat.startStreaming();
      const html = chat.renderInput();
      assert.ok(html.includes('disabled'), 'Should have disabled attribute');
      chat.finalizeStreaming();
    });

    it('should not disable input when not streaming', () => {
      const html = chat.renderInput();
      assert.ok(!html.includes('disabled'), 'Should not have disabled attribute');
    });
  });

  describe('render with input', () => {
    it('should include input in full render', () => {
      const html = chat.render();
      assert.ok(html.includes('chat-input'), 'Should include input area');
    });
  });
});
