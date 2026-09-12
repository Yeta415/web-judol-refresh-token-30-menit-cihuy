const express = require('express');
const axios = require('axios');
const https = require('https');
const sessionStore = require('../services/sessionStore');
const puppeteerService = require('../services/puppeteerService');
const scheduler = require('../services/scheduler');

const router = express.Router();

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  timeout: 15000,
  validateStatus: () => true
});

/**
 * GET /api/status
 */
router.get('/status', (req, res) => {
  const state = sessionStore.getState();
  const token = state.token || state.localStorage?.token || '';
  const nowMs = Date.now();

  const expiresAtMs = state.expiresAt ? new Date(state.expiresAt).getTime() : null;
  const nextRefreshMs = state.nextRefresh ? new Date(state.nextRefresh).getTime() : null;

  const timeUntilExpirySec = expiresAtMs ? Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000)) : null;
  const timeUntilRefreshSec = nextRefreshMs ? Math.max(0, Math.floor((nextRefreshMs - nowMs) / 1000)) : null;

  res.json({
    status: 'ok',
    isRefreshing: puppeteerService.isRefreshing,
    mode: 'auto_detect_expiry',
    state: {
      status: state.status,
      accountUsername: process.env.ACCOUNT_USERNAME || '',
      nickName: state.tokenInfo?.nickName || '',
      userAmount: state.tokenInfo?.amount || '',
      lastRefresh: state.lastRefresh,
      expiresAt: state.expiresAt,
      nextRefresh: state.nextRefresh,
      expirySource: state.expirySource,
      timeUntilExpirySec,
      timeUntilRefreshSec,
      cookieCount: state.cookieCount,
      hasAuthToken: Boolean(token && token.length > 5),
      tokenPreview: token ? `${token.substring(0, 20)}...` : null,
      tokenInfo: state.tokenInfo,
      hasValidSession: state.hasValidSession,
      targetUrl: state.targetUrl,
      lastError: state.lastError
    }
  });
});

/**
 * GET /api/cookies
 */
router.get('/cookies', (req, res) => {
  const state = sessionStore.getState();
  const token = state.token || state.localStorage?.token || '';

  res.json({
    success: true,
    count: state.cookies.length,
    cookies: state.cookies,
    cookieString: state.cookieString,
    token: token,
    tokenInfo: state.tokenInfo,
    expiresAt: state.expiresAt,
    expirySource: state.expirySource,
    userAgent: state.userAgent,
    localStorage: state.localStorage,
    lastRefresh: state.lastRefresh
  });
});

/**
 * GET /api/cookies/raw
 */
router.get('/cookies/raw', (req, res) => {
  const cookieString = sessionStore.getCookieString();
  const format = req.query.format;

  if (format === 'json') {
    return res.json({
      success: true,
      cookie: cookieString
    });
  }

  res.setHeader('Content-Type', 'text/plain');
  res.send(cookieString || '');
});

/**
 * GET /api/test
 */
router.get('/test', async (req, res) => {
  const state = sessionStore.getState();
  const mode = req.query.mode;
  const token = state.token || state.localStorage?.token || '';
  const targetUrl = state.targetUrl || process.env.TARGET_URL || 'https://vhjgakh.com';

  if (mode === 'browser') {
    const liveResult = await puppeteerService.testSessionLive();
    return res.json(liveResult);
  }

  const startTime = Date.now();

  try {
    const response = await axiosInstance.get(targetUrl, {
      headers: {
        'User-Agent': state.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Cookie': state.cookieString || '',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    const latencyMs = Date.now() - startTime;

    if (response.status === 403 && response.headers['server'] === 'cloudflare') {
      const browserResult = await puppeteerService.testSessionLive();
      return res.json({
        ...browserResult,
        httpStatus: 403,
        note: 'Cloudflare memblokir direct HTTP client (403), pengujian dialihkan otomatis via browser engine stealth.'
      });
    }

    const isSuccess = response.status >= 200 && response.status < 400;

    res.json({
      success: isSuccess,
      method: 'http_get',
      message: isSuccess
        ? 'Session cookies aktif dan web target merespon dengan baik.'
        : `Target web merespon dengan HTTP status ${response.status}`,
      statusCode: response.status,
      latencyMs: `${latencyMs}ms`,
      testedUrl: targetUrl,
      cookieCount: state.cookies.length,
      hasAuthToken: Boolean(token && token.length > 5),
      tokenPreview: token ? `${token.substring(0, 15)}...` : null,
      responseHeaders: {
        'content-type': response.headers['content-type'],
        'server': response.headers['server'],
        'set-cookie': response.headers['set-cookie'] ? `${response.headers['set-cookie'].length} cookies received` : null
      }
    });
  } catch (err) {
    const browserResult = await puppeteerService.testSessionLive();
    res.json({
      ...browserResult,
      httpError: err.message,
      note: 'Direct HTTP error, pengujian dijalankan via browser engine stealth.'
    });
  }
});

/**
 * POST /api/refresh
 */
router.post('/refresh', async (req, res) => {
  if (puppeteerService.isRefreshing) {
    return res.status(409).json({
      success: false,
      message: 'Proses refresh cookies sedang berjalan di latar belakang. Silakan tunggu beberapa detik.'
    });
  }

  const waitParam = req.query.wait === 'true' || req.body?.wait === true;

  if (waitParam) {
    const result = await puppeteerService.refreshCookies();
    scheduler.onManualRefreshComplete();
    return res.json(result);
  }

  puppeteerService.refreshCookies().then(result => {
    console.log('[API] Background manual refresh selesai:', result.success ? 'BERHASIL' : 'GAGAL');
    scheduler.onManualRefreshComplete();
  });

  res.json({
    success: true,
    message: 'Proses login & refresh cookies Puppeteer telah dipicu di latar belakang.',
    status: 'refreshing'
  });
});

module.exports = router;
