/**
 * Tests for WebUI Frontend Core App
 */

import { describe, it, beforeEach } from 'node:test';
import { ok, strictEqual } from 'node:assert';
import { FrontendApp } from '../../src/webui/frontend/app.js';
import type { ThemeConfig } from '../../src/webui/frontend/types.js';

const defaultTheme: ThemeConfig = {
  mode: 'light',
  primaryColor: '#3b82f6',
  fontSize: 14,
};

describe('FrontendApp', () => {
  let app: FrontendApp;

  beforeEach(() => {
    app = new FrontendApp(defaultTheme);
  });

  describe('constructor', () => {
    it('creates app with default theme', () => {
      ok(app, 'app created');
    });

    it('starts on chat page', () => {
      strictEqual(app.state.currentPage, 'chat');
    });

    it('starts unauthenticated', () => {
      strictEqual(app.state.isAuthenticated, false);
    });

    it('has empty notifications', () => {
      strictEqual(app.state.notifications.length, 0);
    });

    it('has no active session', () => {
      strictEqual(app.state.activeSessionId, null);
    });
  });

  describe('navigation', () => {
    it('navigates to dashboard', () => {
      app.navigate('dashboard');
      strictEqual(app.state.currentPage, 'dashboard');
    });

    it('navigates to plugins page', () => {
      app.navigate('plugins');
      strictEqual(app.state.currentPage, 'plugins');
    });

    it('navigates to config page', () => {
      app.navigate('config');
      strictEqual(app.state.currentPage, 'config');
    });

    it('navigates to sessions page', () => {
      app.navigate('sessions');
      strictEqual(app.state.currentPage, 'sessions');
    });

    it('navigates to media page', () => {
      app.navigate('media');
      strictEqual(app.state.currentPage, 'media');
    });

    it('stays on current page for invalid navigation', () => {
      app.navigate('dashboard');
      const prevPage = app.state.currentPage;
      app.navigate('nonexistent' as never);
      strictEqual(app.state.currentPage, prevPage);
    });
  });

  describe('authentication', () => {
    it('authenticates with valid key', () => {
      app.authenticate('valid-api-key');
      strictEqual(app.state.isAuthenticated, true);
    });

    it('rejects empty key', () => {
      app.authenticate('');
      strictEqual(app.state.isAuthenticated, false);
    });

    it('logs out', () => {
      app.authenticate('valid-key');
      app.logout();
      strictEqual(app.state.isAuthenticated, false);
      strictEqual(app.state.activeSessionId, null);
    });
  });

  describe('theme management', () => {
    it('switches to dark theme', () => {
      app.setThemeMode('dark');
      strictEqual(app.state.theme.mode, 'dark');
    });

    it('switches to light theme', () => {
      app.setThemeMode('light');
      strictEqual(app.state.theme.mode, 'light');
    });

    it('switches to system theme', () => {
      app.setThemeMode('system');
      strictEqual(app.state.theme.mode, 'system');
    });

    it('changes primary color', () => {
      app.setPrimaryColor('#ef4444');
      strictEqual(app.state.theme.primaryColor, '#ef4444');
    });

    it('changes font size', () => {
      app.setFontSize(16);
      strictEqual(app.state.theme.fontSize, 16);
    });

    it('clamps font size to minimum', () => {
      app.setFontSize(4);
      strictEqual(app.state.theme.fontSize, 10);
    });

    it('clamps font size to maximum', () => {
      app.setFontSize(100);
      strictEqual(app.state.theme.fontSize, 32);
    });
  });

  describe('notifications', () => {
    it('adds info notification', () => {
      app.addNotification('info', 'Test message');
      strictEqual(app.state.notifications.length, 1);
      strictEqual(app.state.notifications[0].type, 'info');
    });

    it('adds success notification', () => {
      app.addNotification('success', 'Operation completed');
      strictEqual(app.state.notifications[0].type, 'success');
    });

    it('adds warning notification', () => {
      app.addNotification('warning', 'Something might be wrong');
      strictEqual(app.state.notifications[0].type, 'warning');
    });

    it('adds error notification', () => {
      app.addNotification('error', 'Something failed');
      strictEqual(app.state.notifications[0].type, 'error');
    });

    it('dismisses notification by id', () => {
      app.addNotification('info', 'Test');
      const notif = app.state.notifications[0];
      app.dismissNotification(notif.id);
      ok(notif.dismissed, 'notification dismissed');
    });

    it('clears all notifications', () => {
      app.addNotification('info', 'First');
      app.addNotification('warning', 'Second');
      app.clearNotifications();
      strictEqual(app.state.notifications.length, 0);
    });

    it('limits notification count', () => {
      for (let i = 0; i < 50; i++) {
        app.addNotification('info', `Message ${i}`);
      }
      ok(app.state.notifications.length <= 25, 'notifications capped');
    });
  });

  describe('session management', () => {
    it('sets active session', () => {
      app.setActiveSession('session-123');
      strictEqual(app.state.activeSessionId, 'session-123');
    });

    it('clears active session', () => {
      app.setActiveSession('session-123');
      app.clearActiveSession();
      strictEqual(app.state.activeSessionId, null);
    });
  });

  describe('render', () => {
    it('renders chat page HTML', () => {
      const html = app.render();
      ok(typeof html === 'string', 'renders string');
      ok(html.includes('synthtek'), 'includes app name');
    });

    it('renders dashboard page HTML', () => {
      app.navigate('dashboard');
      const html = app.render();
      ok(html.includes('Dashboard'), 'includes dashboard title');
    });

    it('includes theme class in HTML', () => {
      app.setThemeMode('dark');
      const html = app.render();
      ok(html.includes('theme-dark'), 'includes dark theme class');
    });

    it('includes font size in HTML', () => {
      app.setFontSize(16);
      const html = app.render();
      ok(html.includes('font-size'), 'includes font size style');
    });
  });

  describe('state snapshot', () => {
    it('returns state snapshot', () => {
      const snapshot = app.getState();
      ok(snapshot, 'snapshot returned');
      strictEqual(snapshot.currentPage, 'chat');
    });

    it('snapshot reflects navigation changes', () => {
      app.navigate('dashboard');
      const snapshot = app.getState();
      strictEqual(snapshot.currentPage, 'dashboard');
    });
  });
});
