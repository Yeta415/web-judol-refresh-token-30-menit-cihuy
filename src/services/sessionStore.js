const fs = require('fs');
const path = require('path');

const SESSION_FILE_PATH = path.join(__dirname, '../../session.json');

class SessionStore {
  constructor() {
    this.state = {
      cookies: [],
      cookieString: '',
      token: '',
      tokenInfo: null,
      localStorage: {},
      sessionStorage: {},
      userAgent: '',
      targetUrl: process.env.TARGET_URL || 'https://vhjgakh.com',
      lastRefresh: null,
      expiresAt: null,
      nextRefresh: null,
      expirySource: 'unknown',
      status: 'idle', // 'idle' | 'logging_in' | 'refreshing' | 'success' | 'error'
      lastError: null,
      accountUsername: process.env.ACCOUNT_USERNAME || ''
    };

    this.loadFromDisk();
  }

  parseJwt(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
      return JSON.parse(payloadJson);
    } catch (e) {
      return null;
    }
  }

  detectExpiration(cookies, token) {
    const nowMs = Date.now();
    const nowSec = nowMs / 1000;

    // 1. Cek Token JWT (paling akurat untuk otentikasi login)
    if (token) {
      const jwtPayload = this.parseJwt(token);
      if (jwtPayload && jwtPayload.exp) {
        const expDate = new Date(jwtPayload.exp * 1000);
        return {
          expiresAt: expDate.toISOString(),
          expirySource: `JWT Token (exp: ${expDate.toLocaleTimeString('id-ID')})`,
          tokenInfo: {
            userName: jwtPayload.UserName || '',
            nickName: jwtPayload.NickName || '',
            amount: jwtPayload.Amount || '',
            expiresClaim: jwtPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/expiration'] || '',
            expEpoch: jwtPayload.exp
          }
        };
      }
    }

    // 2. Cek Cookies bawaan
    if (Array.isArray(cookies) && cookies.length > 0) {
      const futureCookies = cookies.filter(c => c.expires && c.expires > nowSec && c.expires > 0);
      if (futureCookies.length > 0) {
        // Ambil cookie dengan waktu expire terdekat
        futureCookies.sort((a, b) => a.expires - b.expires);
        const nearest = futureCookies[0];
        const expDate = new Date(nearest.expires * 1000);
        return {
          expiresAt: expDate.toISOString(),
          expirySource: `Cookie '${nearest.name}' (exp: ${expDate.toLocaleTimeString('id-ID')})`,
          tokenInfo: null
        };
      }
    }

    // 3. Fallback default jika tidak ada timestamp spesifik
    const fallbackMinutes = 30;
    const fallbackDate = new Date(nowMs + fallbackMinutes * 60 * 1000);
    return {
      expiresAt: fallbackDate.toISOString(),
      expirySource: `Default Fallback (${fallbackMinutes} menit)`,
      tokenInfo: null
    };
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(SESSION_FILE_PATH)) {
        const rawData = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
        const savedData = JSON.parse(rawData);
        if (savedData && Array.isArray(savedData.cookies)) {
          this.state.cookies = savedData.cookies || [];
          this.state.cookieString = savedData.cookieString || this.buildCookieString(savedData.cookies);
          this.state.token = savedData.token || savedData.localStorage?.token || '';
          this.state.localStorage = savedData.localStorage || {};
          this.state.sessionStorage = savedData.sessionStorage || {};
          this.state.userAgent = savedData.userAgent || '';
          this.state.lastRefresh = savedData.lastRefresh || null;
          this.state.expiresAt = savedData.expiresAt || null;
          this.state.nextRefresh = savedData.nextRefresh || null;
          this.state.expirySource = savedData.expirySource || 'unknown';
          this.state.lastError = savedData.lastError || null;
          this.state.status = 'idle';

          if (this.state.token) {
            const parsed = this.parseJwt(this.state.token);
            if (parsed) {
              this.state.tokenInfo = {
                userName: parsed.UserName || '',
                nickName: parsed.NickName || '',
                amount: parsed.Amount || '',
                expiresClaim: parsed['http://schemas.microsoft.com/ws/2008/06/identity/claims/expiration'] || ''
              };
            }
          }

          console.log(`[SessionStore] Berhasil memuat session (Cookies: ${this.state.cookies.length}, Token: ${this.state.token ? 'ADA' : 'TIDAK ADA'})`);
        }
      }
    } catch (err) {
      console.warn(`[SessionStore] Gagal membaca session.json: ${err.message}`);
    }
  }

  saveToDisk() {
    try {
      const dataToSave = {
        cookies: this.state.cookies,
        cookieString: this.state.cookieString,
        token: this.state.token,
        tokenInfo: this.state.tokenInfo,
        expiresAt: this.state.expiresAt,
        nextRefresh: this.state.nextRefresh,
        expirySource: this.state.expirySource,
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

    const authToken = localStorage.token || this.state.token || '';
    const expiryInfo = this.detectExpiration(cookies, authToken);

    this.state.cookies = cookies || [];
    this.state.cookieString = this.buildCookieString(this.state.cookies);
    this.state.token = authToken;
    this.state.tokenInfo = expiryInfo.tokenInfo;
    this.state.expiresAt = expiryInfo.expiresAt;
    this.state.expirySource = expiryInfo.expirySource;
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
      hasAuthToken: Boolean(this.state.token && this.state.token.length > 5),
      hasValidSession: (this.state.cookies.length > 0 || Boolean(this.state.token)) && !this.state.lastError
    };
  }

  getCookies() {
    return this.state.cookies;
  }

  getCookieString() {
    return this.state.cookieString;
  }

  getToken() {
    return this.state.token;
  }

  getUserAgent() {
    return this.state.userAgent;
  }
}

module.exports = new SessionStore();
