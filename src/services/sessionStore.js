const fs = require('fs');
const path = require('path');

const SESSION_FILE_PATH = path.join(__dirname, '../../session.json');

class SessionStore {
  constructor() {
    this.state = {
      cookies: [],
      cookieString: '',
      localStorage: {},
      sessionStorage: {},
      userAgent: '',
      targetUrl: process.env.TARGET_URL || 'https://vhjgakh.com',
      lastRefresh: null,
      nextRefresh: null,
      status: 'idle', // 'idle' | 'logging_in' | 'refreshing' | 'success' | 'error'
      lastError: null,
      accountUsername: process.env.ACCOUNT_USERNAME || ''
    };

    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(SESSION_FILE_PATH)) {
        const rawData = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
        const savedData = JSON.parse(rawData);
        if (savedData && Array.isArray(savedData.cookies)) {
          this.state.cookies = savedData.cookies || [];
          this.state.cookieString = savedData.cookieString || this.buildCookieString(savedData.cookies);
          this.state.localStorage = savedData.localStorage || {};
          this.state.sessionStorage = savedData.sessionStorage || {};
          this.state.userAgent = savedData.userAgent || '';
          this.state.lastRefresh = savedData.lastRefresh || null;
          this.state.lastError = savedData.lastError || null;
          this.state.status = 'idle';
          console.log(`[SessionStore] Berhasil memuat ${this.state.cookies.length} cookies dari session.json`);
        }
      }
    } catch (err) {
      console.warn(`[SessionStore] Gagal membaca session.json sebelumnya: ${err.message}`);
    }
  }

  saveToDisk() {
    try {
      const dataToSave = {
        cookies: this.state.cookies,
        cookieString: this.state.cookieString,
        localStorage: this.state.localStorage,
        sessionStorage: this.state.sessionStorage,
        userAgent: this.state.userAgent,
        targetUrl: this.state.targetUrl,
        lastRefresh: this.state.lastRefresh,
        lastError: this.state.lastError,
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(dataToSave, null, 2), 'utf-8');
      console.log(`[SessionStore] Session berhasil disimpan ke ${SESSION_FILE_PATH}`);
    } catch (err) {
      console.error(`[SessionStore] Gagal menyimpan session ke disk: ${err.message}`);
    }
  }

  buildCookieString(cookies) {
    if (!Array.isArray(cookies) || cookies.length === 0) return '';
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }

  updateSession({ cookies, localStorage = {}, sessionStorage = {}, userAgent = '', error = null }) {
    if (error) {
      this.state.status = 'error';
      this.state.lastError = error;
      this.saveToDisk();
      return;
    }

    this.state.cookies = cookies || [];
    this.state.cookieString = this.buildCookieString(this.state.cookies);
    this.state.localStorage = localStorage;
    this.state.sessionStorage = sessionStorage;
    if (userAgent) this.state.userAgent = userAgent;
    this.state.lastRefresh = new Date().toISOString();
    this.state.status = 'success';
    this.state.lastError = null;

    this.saveToDisk();
  }

  setStatus(status, error = null) {
    this.state.status = status;
    if (error) this.state.lastError = error;
  }

  setNextRefresh(date) {
    this.state.nextRefresh = date instanceof Date ? date.toISOString() : date;
  }

  getState() {
    return {
      ...this.state,
      cookieCount: this.state.cookies.length,
      hasValidSession: this.state.cookies.length > 0 && !this.state.lastError
    };
  }

  getCookies() {
    return this.state.cookies;
  }

  getCookieString() {
    return this.state.cookieString;
  }

  getUserAgent() {
    return this.state.userAgent;
  }
}

module.exports = new SessionStore();
