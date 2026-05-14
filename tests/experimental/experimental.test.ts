/**
 * Tests for Experimental Features
 */

import { describe, it, beforeEach } from 'node:test';
import { ok, strictEqual } from 'node:assert';
import { ExperimentalEngine } from '../../src/experimental/engine.js';
import type { ExperimentalConfig } from '../../src/experimental/types.js';

const defaultConfig: ExperimentalConfig = {
  enableCoT: true,
  enableSelfImprovement: true,
  enableCalendar: true,
  enableVoice: true,
  enableMultiModal: true,
  maxCoTDepth: 5,
  learningRate: 0.01,
};

describe('ExperimentalEngine', () => {
  let engine: ExperimentalEngine;

  beforeEach(() => {
    engine = new ExperimentalEngine(defaultConfig);
  });

  describe('constructor', () => {
    it('creates engine with config', () => {
      ok(engine, 'engine created');
    });
  });

  describe('chain-of-thought reasoning', () => {
    it('generates CoT trace', () => {
      const result = engine.generateCoT('What is 2 + 2?');
      ok(result, 'CoT result returned');
      ok(result.steps.length > 0, 'has reasoning steps');
    });

    it('respects max depth', () => {
      const result = engine.generateCoT('Complex problem');
      ok(result, 'CoT result returned');
      ok(result.steps.length <= defaultConfig.maxCoTDepth, 'within max depth');
    });

    it('shows reasoning visibility', () => {
      const result = engine.generateCoT('Why is the sky blue?');
      ok(result, 'CoT result returned');
      ok(result.explanation, 'has explanation');
    });

    it('disables CoT when configured', () => {
      const disabledEngine = new ExperimentalEngine({ ...defaultConfig, enableCoT: false });
      const result = disabledEngine.generateCoT('test');
      ok(!result, 'CoT disabled');
    });
  });

  describe('self-improvement', () => {
    it('records feedback', () => {
      const entry = engine.recordFeedback('good response', 'positive');
      ok(entry, 'feedback recorded');
      strictEqual(entry.type, 'positive');
    });

    it('records negative feedback', () => {
      const entry = engine.recordFeedback('bad response', 'negative');
      ok(entry, 'feedback recorded');
      strictEqual(entry.type, 'negative');
    });

    it('learns from feedback', () => {
      engine.recordFeedback('good', 'positive');
      engine.recordFeedback('bad', 'negative');
      const learned = engine.getLearnings();
      ok(Array.isArray(learned), 'returns array');
      ok(learned.length > 0, 'has learnings');
    });

    it('adjusts based on learning rate', () => {
      const highRateEngine = new ExperimentalEngine({ ...defaultConfig, learningRate: 0.1 });
      ok(highRateEngine, 'engine with high learning rate created');
    });

    it('disables self-improvement when configured', () => {
      const disabledEngine = new ExperimentalEngine({ ...defaultConfig, enableSelfImprovement: false });
      const entry = disabledEngine.recordFeedback('test', 'positive');
      ok(!entry, 'self-improvement disabled');
    });
  });

  describe('calendar integration', () => {
    it('creates calendar event', () => {
      const event = engine.createCalendarEvent({
        title: 'Meeting',
        start: new Date(Date.now() + 3600000).toISOString(),
        end: new Date(Date.now() + 7200000).toISOString(),
      });
      ok(event, 'event created');
      strictEqual(event.title, 'Meeting');
    });

    it('lists upcoming events', () => {
      engine.createCalendarEvent({
        title: 'Event 1',
        start: new Date(Date.now() + 3600000).toISOString(),
        end: new Date(Date.now() + 7200000).toISOString(),
      });
      const events = engine.getUpcomingEvents();
      ok(Array.isArray(events), 'returns array');
      ok(events.length > 0, 'has events');
    });

    it('deletes calendar event', () => {
      const created = engine.createCalendarEvent({
        title: 'To Delete',
        start: new Date(Date.now() + 3600000).toISOString(),
        end: new Date(Date.now() + 7200000).toISOString(),
      });
      const deleted = engine.deleteCalendarEvent(created!.id);
      ok(deleted, 'event deleted');
    });

    it('disables calendar when configured', () => {
      const disabledEngine = new ExperimentalEngine({ ...defaultConfig, enableCalendar: false });
      const event = disabledEngine.createCalendarEvent({
        title: 'Test',
        start: new Date().toISOString(),
        end: new Date().toISOString(),
      });
      ok(!event, 'calendar disabled');
    });
  });

  describe('voice input/output', () => {
    it('synthesizes speech', () => {
      const result = engine.synthesizeSpeech('Hello world');
      ok(result, 'speech result returned');
      ok(result.audioUrl, 'has audio URL');
    });

    it('recognizes speech', () => {
      const result = engine.recognizeSpeech('audio.mp3');
      ok(result, 'recognition result returned');
      ok(typeof result.text === 'string', 'has text');
    });

    it('disables voice when configured', () => {
      const disabledEngine = new ExperimentalEngine({ ...defaultConfig, enableVoice: false });
      const result = disabledEngine.synthesizeSpeech('test');
      ok(!result, 'voice disabled');
    });
  });

  describe('multi-modal reasoning', () => {
    it('processes multi-modal input', () => {
      const result = engine.processMultiModal({
        text: 'What is in this image?',
        image: 'data:image/png;base64,abc123',
      });
      ok(result, 'multi-modal result returned');
      ok(typeof result.response === 'string', 'has response');
    });

    it('handles text-only input', () => {
      const result = engine.processMultiModal({
        text: 'Hello',
      });
      ok(result, 'result returned');
    });

    it('disables multi-modal when configured', () => {
      const disabledEngine = new ExperimentalEngine({ ...defaultConfig, enableMultiModal: false });
      const result = disabledEngine.processMultiModal({ text: 'test' });
      ok(!result, 'multi-modal disabled');
    });
  });

  describe('feature flags', () => {
    it('checks if feature is enabled', () => {
      ok(engine.isFeatureEnabled('cot'), 'CoT enabled');
      ok(engine.isFeatureEnabled('self-improvement'), 'self-improvement enabled');
      ok(engine.isFeatureEnabled('calendar'), 'calendar enabled');
      ok(engine.isFeatureEnabled('voice'), 'voice enabled');
      ok(engine.isFeatureEnabled('multi-modal'), 'multi-modal enabled');
    });

    it('toggles feature', () => {
      engine.toggleFeature('cot', false);
      ok(!engine.isFeatureEnabled('cot'), 'CoT disabled');
    });
  });
});
