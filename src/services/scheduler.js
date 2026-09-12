const puppeteerService = require('./puppeteerService');
const sessionStore = require('./sessionStore');

class DynamicScheduler {
  constructor() {
    this.timer = null;
    this.bufferSeconds = 60; // Re-login 60 detik sebelum token/cookie benar-benar kedaluwarsa
  }

  start() {
    console.log('[Scheduler] Mode Auto-Detect Expiry aktif (Re-login otomatis berdasarkan waktu kedaluwarsa cookies/token).');

    // Cek apakah sudah ada session dengan expiresAt tersimpan
    const state = sessionStore.getState();
    if (!state.hasAuthToken && (!state.cookies || state.cookies.length === 0)) {
      console.log('[Scheduler] Tidak ada sesi aktif. Memulai login awal...');
      setTimeout(() => {
        this.runRefresh();
      }, 2000);
    } else {
      console.log(`[Scheduler] Menggunakan sesi tersimpan. Expiry: ${state.expiresAt || 'Belum terdeteksi'}`);
      this.scheduleNextRun();
    }
  }

  scheduleNextRun() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const state = sessionStore.getState();
    const nowMs = Date.now();
    let targetTimeMs;

    if (state.expiresAt) {
      const expMs = new Date(state.expiresAt).getTime();
      // Jadwalkan re-login sebelum waktu kedaluwarsa (kurangi buffer)
      targetTimeMs = expMs - (this.bufferSeconds * 1000);

      // Jika waktu target sudah lewat atau kurang dari 10 detik, jadwalkan 10 detik lagi
      if (targetTimeMs <= nowMs + 10000) {
        targetTimeMs = nowMs + 10000;
        console.log('[Scheduler] Sesi mendekati kedaluwarsa atau sudah lewat. Re-login dijadwalkan dalam 10 detik.');
      }
    } else {
      // Fallback 30 menit jika tidak ada informasi kedaluwarsa
      targetTimeMs = nowMs + (30 * 60 * 1000);
    }

    const nextRunDate = new Date(targetTimeMs);
    sessionStore.setNextRefresh(nextRunDate);

    const msUntilRun = Math.max(1000, targetTimeMs - nowMs);
    const minutesUntil = (msUntilRun / 60000).toFixed(1);

    console.log(`[Scheduler] Re-login otomatis dijadwalkan pada: ${nextRunDate.toLocaleTimeString('id-ID')} (dalam ~${minutesUntil} menit)`);
    console.log(`[Scheduler] Sumber deteksi: ${state.expirySource || 'Auto'}`);

    this.timer = setTimeout(async () => {
      await this.runRefresh();
    }, msUntilRun);
  }

  async runRefresh() {
    console.log(`[Scheduler] Menjalankan re-login otomatis: ${new Date().toISOString()}`);
    const result = await puppeteerService.refreshCookies();

    if (result.success) {
      console.log('[Scheduler] Re-login sukses. Menjadwalkan siklus berikutnya berdasarkan kedaluwarsa baru...');
    } else {
      console.warn('[Scheduler] Re-login gagal. Mencoba kembali dalam 2 menit...');
      // Retry dalam 2 menit jika gagal
      sessionStore.setNextRefresh(new Date(Date.now() + 2 * 60 * 1000));
    }

    // Jadwalkan siklus berikutnya
    this.scheduleNextRun();
  }

  // Dipanggil saat manual refresh selesai
  onManualRefreshComplete() {
    this.scheduleNextRun();
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      console.log('[Scheduler] Dynamic scheduler dihentikan.');
    }
  }
}

module.exports = new DynamicScheduler();
