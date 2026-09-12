const cron = require('node-cron');
const puppeteerService = require('./puppeteerService');
const sessionStore = require('./sessionStore');

class Scheduler {
  constructor() {
    this.cronTask = null;
    this.intervalMinutes = parseInt(process.env.REFRESH_INTERVAL_MINUTES, 10) || 30;
  }

  start() {
    console.log(`[Scheduler] Mengatur auto-refresh login & cookies setiap ${this.intervalMinutes} menit.`);

    // Hitung waktu berikutnya
    this.updateNextRunTime();

    // Buat cron expression: misal interval 30 menit = `*/30 * * * *`
    let cronExpression;
    if (this.intervalMinutes >= 1 && this.intervalMinutes < 60) {
      cronExpression = `*/${this.intervalMinutes} * * * *`;
    } else {
      // jika 60 menit atau kelipatan jam
      cronExpression = '0 * * * *';
    }

    this.cronTask = cron.schedule(cronExpression, async () => {
      console.log(`[Scheduler] Trigger berkala (${this.intervalMinutes}m) dimulai: ${new Date().toISOString()}`);
      this.updateNextRunTime();
      await puppeteerService.refreshCookies();
    });

    // Jalankan refresh awal saat server pertama kali start (jika belum ada session)
    const state = sessionStore.getState();
    if (!state.cookies || state.cookies.length === 0) {
      console.log('[Scheduler] Tidak ada session tersimpan. Memulai login awal...');
      setTimeout(() => {
        puppeteerService.refreshCookies();
      }, 3000);
    } else {
      console.log(`[Scheduler] Menggunakan session tersimpan (${state.cookies.length} cookies). Refresh berikutnya dijadwalkan.`);
    }
  }

  updateNextRunTime() {
    const nextDate = new Date(Date.now() + this.intervalMinutes * 60 * 1000);
    sessionStore.setNextRefresh(nextDate);
  }

  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      console.log('[Scheduler] Cron auto-refresh dihentikan.');
    }
  }
}

module.exports = new Scheduler();
