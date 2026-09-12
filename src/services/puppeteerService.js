const sessionStore = require('./sessionStore');
const path = require('path');
const fs = require('fs');

class PuppeteerService {
  constructor() {
    this.isRefreshing = false;
    this.puppeteerInstance = null;
    this.screenshotsDir = path.join(__dirname, '../../screenshots');
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  getPuppeteer() {
    if (!this.puppeteerInstance) {
      const puppeteer = require('puppeteer-extra');
      const StealthPlugin = require('puppeteer-extra-plugin-stealth');
      puppeteer.use(StealthPlugin());
      this.puppeteerInstance = puppeteer;
    }
    return this.puppeteerInstance;
  }

  async refreshCookies() {
    // Reload dotenv to pick up any changes in .env
    require('dotenv').config();

    if (this.isRefreshing) {
      console.log('[Puppeteer] Refresh sedang berjalan, abaikan request duplikat.');
      return { success: false, message: 'Refresh is already in progress' };
    }

    this.isRefreshing = true;
    sessionStore.setStatus('refreshing');

    let baseTargetUrl = process.env.TARGET_URL || 'https://vhjgakh.com';
    baseTargetUrl = baseTargetUrl.replace(/\/+$/, '');
    
    // Pastikan URL login SPA
    const loginUrl = baseTargetUrl.includes('#') ? baseTargetUrl : `${baseTargetUrl}/#/login`;

    const username = process.env.ACCOUNT_USERNAME;
    const password = process.env.ACCOUNT_PASSWORD;
    const headless = process.env.HEADLESS !== 'false';
    const timeout = parseInt(process.env.NAVIGATION_TIMEOUT, 10) || 60000;
    const proxyServer = process.env.PROXY_SERVER;

    console.log(`[Puppeteer] Memulai proses login ke ${loginUrl}...`);

    let browser = null;
    try {
      const puppeteer = this.getPuppeteer();
      const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--window-size=1366,768'
      ];

      if (proxyServer) {
        args.push(`--proxy-server=${proxyServer}`);
        console.log(`[Puppeteer] Menggunakan proxy: ${proxyServer}`);
      }

      browser = await puppeteer.launch({
        headless: headless ? 'new' : false,
        args,
        defaultViewport: { width: 1366, height: 768 },
        ignoreHTTPSErrors: true
      });

      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );

      page.setDefaultNavigationTimeout(timeout);
      page.setDefaultTimeout(timeout);

      // Navigasi ke Halaman Login
      console.log(`[Puppeteer] Navigasi ke ${loginUrl}...`);
      await page.goto(loginUrl, {
        waitUntil: ['domcontentloaded', 'networkidle2'],
        timeout
      });

      // Tunggu hingga Vue router merender input
      await page.waitForSelector('input', { timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));

      // Tutup popup banner jika ada
      await this.dismissPopups(page);

      // Cek kredensial
      if (username && password && password.trim().length > 0) {
        console.log(`[Puppeteer] Memasukkan kredensial akun: ${username}...`);
        await this.performLogin(page, username, password);
      } else {
        console.log(`[Puppeteer] Username (${username}) tersedia, namun password di .env kosong.`);
      }

      // Tunggu respons login & storage terupdate
      await new Promise(r => setTimeout(r, 4000));
      await this.dismissPopups(page);

      // Ambil seluruh cookies
      const cookies = await page.cookies();
      const userAgent = await page.evaluate(() => navigator.userAgent);

      // Ambil localStorage & sessionStorage
      const { localStorageData, sessionStorageData } = await page.evaluate(() => {
        const ls = {};
        const ss = {};
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            ls[key] = localStorage.getItem(key);
          }
        } catch (e) {}
        try {
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            ss[key] = sessionStorage.getItem(key);
          }
        } catch (e) {}
        return { localStorageData: ls, sessionStorageData: ss };
      });

      const authToken = localStorageData.token || '';
      console.log(`[Puppeteer] Selesai: ${cookies.length} cookies didapatkan. Token auth: ${authToken ? 'Berhasil didapatkan (panjang: ' + authToken.length + ')' : 'Tidak ditemukan / belum login'}`);

      // Simpan session
      sessionStore.updateSession({
        cookies,
        localStorage: localStorageData,
        sessionStorage: sessionStorageData,
        userAgent,
        error: null
      });

      try {
        await page.screenshot({ path: path.join(this.screenshotsDir, 'latest_success.png'), fullPage: false });
      } catch (e) {}

      return {
        success: true,
        cookieCount: cookies.length,
        cookies,
        token: authToken,
        cookieString: sessionStore.getCookieString(),
        lastRefresh: sessionStore.getState().lastRefresh
      };
    } catch (err) {
      console.error(`[Puppeteer] Error saat refresh: ${err.message}`);
      sessionStore.setStatus('error', err.message);

      if (browser) {
        try {
          const pages = await browser.pages();
          if (pages.length > 0) {
            await pages[0].screenshot({ path: path.join(this.screenshotsDir, 'latest_error.png'), fullPage: false });
          }
        } catch (e) {}
      }

      return {
        success: false,
        error: err.message
      };
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (e) {}
      }
      this.isRefreshing = false;
    }
  }

  async dismissPopups(page) {
    try {
      const popupSelectors = [
        '.close',
        '.popup-close',
        '.modal-close',
        '.btn-close',
        '[aria-label="Close"]',
        '.announcement-close',
        '.modal .close',
        '#popupClose',
        '.swal2-confirm',
        '.swal2-close',
        'button.dialogBtn',
        '.van-dialog__cancel'
      ];

      for (const selector of popupSelectors) {
        const elements = await page.$$(selector);
        for (const el of elements) {
          try {
            const isVisible = await el.isIntersectingViewport();
            if (isVisible) {
              await el.click();
              await new Promise(r => setTimeout(r, 400));
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      // Ignored
    }
  }

  async performLogin(page, username, password) {
    let formattedPhone = username.trim();
    if (formattedPhone.startsWith('+62')) {
      formattedPhone = formattedPhone.substring(3);
    } else if (formattedPhone.startsWith('62')) {
      formattedPhone = formattedPhone.substring(2);
    } else if (formattedPhone.startsWith('0')) {
      formattedPhone = formattedPhone.substring(1);
    }

    // Tunggu input nomor telepon & password
    const userSelectors = [
      'input[name="userNumber"]',
      'input[placeholder*="telepon" i]',
      'input[placeholder*="phone" i]',
      'input[placeholder*="nomor" i]',
      'input[type="tel"]',
      'input[name="username"]',
      'input[type="text"]'
    ];

    const passSelectors = [
      'input[type="password"]',
      'input[placeholder*="Kata sandi" i]',
      'input[placeholder*="sandi" i]',
      'input[placeholder*="password" i]',
      'input[name="password"]'
    ];

    let userInput = null;
    for (const sel of userSelectors) {
      try {
        const els = await page.$$(sel);
        for (const el of els) {
          const isVisible = await el.isIntersectingViewport();
          if (isVisible) {
            userInput = el;
            break;
          }
        }
        if (userInput) break;
      } catch (e) {}
    }

    let passInput = null;
    for (const sel of passSelectors) {
      try {
        const els = await page.$$(sel);
        for (const el of els) {
          const isVisible = await el.isIntersectingViewport();
          if (isVisible) {
            passInput = el;
            break;
          }
        }
        if (passInput) break;
      } catch (e) {}
    }

    if (userInput && passInput) {
      console.log(`[Puppeteer] Mengisi form login dengan nomor telepon: ${formattedPhone}...`);
      await userInput.click({ clickCount: 3 });
      await userInput.type(formattedPhone, { delay: 60 });
      await new Promise(r => setTimeout(r, 400));

      console.log('[Puppeteer] Mengisi kata sandi...');
      await passInput.click({ clickCount: 3 });
      await passInput.type(password, { delay: 60 });
      await new Promise(r => setTimeout(r, 500));

      console.log('[Puppeteer] Menekan tombol Login...');
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, .van-button, .btn-login, input[type="submit"]'));
        const loginBtn = buttons.find(b => {
          const t = (b.innerText || b.value || '').trim().toLowerCase();
          return t === 'login' || t === 'masuk' || t.includes('login') || t.includes('masuk');
        });
        if (loginBtn) {
          loginBtn.click();
        } else if (buttons.length > 0) {
          buttons[0].click();
        }
      });

      await new Promise(r => setTimeout(r, 3500));
    } else {
      console.warn('[Puppeteer] Input username/password tidak ditemukan pada halaman.');
    }
  }

  async testSessionLive() {
    const targetUrl = process.env.TARGET_URL || 'https://vhjgakh.com';
    const cookies = sessionStore.getCookies();
    const state = sessionStore.getState();

    let browser = null;
    const startTime = Date.now();
    try {
      const puppeteer = this.getPuppeteer();
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
        ignoreHTTPSErrors: true
      });

      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );

      if (cookies.length > 0) {
        await page.setCookie(...cookies);
      }

      if (state.localStorage && Object.keys(state.localStorage).length > 0) {
        await page.evaluateOnNewDocument((storageData) => {
          for (const [k, v] of Object.entries(storageData)) {
            try { localStorage.setItem(k, v); } catch (e) {}
          }
        }, state.localStorage);
      }

      const response = await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });

      await new Promise(r => setTimeout(r, 2000));
      const latencyMs = Date.now() - startTime;
      const currentUrl = page.url();
      const pageTitle = await page.title();

      const token = await page.evaluate(() => localStorage.getItem('token') || '');
      const hasToken = Boolean(token && token.length > 5);

      return {
        success: true,
        method: 'puppeteer_live_check',
        statusCode: response ? response.status() : 200,
        latencyMs: `${latencyMs}ms`,
        currentUrl,
        pageTitle,
        hasAuthToken: hasToken,
        tokenPreview: hasToken ? `${token.substring(0, 15)}...` : 'Belum login / belum ada token',
        cookieCount: cookies.length,
        message: hasToken
          ? 'Session login valid & aktif dengan Token!'
          : 'Web dapat diakses dengan sukses melalui browser stealth. (Kredensial belum login/belum ada token)'
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        method: 'puppeteer_live_check',
        error: err.message,
        latencyMs: `${latencyMs}ms`
      };
    } finally {
      if (browser) {
        try { await browser.close(); } catch (e) {}
      }
    }
  }
}

module.exports = new PuppeteerService();
