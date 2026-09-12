// State & DOM Elements
let nextRefreshTime = null;
let countdownInterval = null;

const targetUrlText = document.getElementById('targetUrlText');
const globalStatusBadge = document.getElementById('globalStatusBadge');
const statusLabel = document.getElementById('statusLabel');
const countdownMin = document.getElementById('countdownMin');
const countdownSec = document.getElementById('countdownSec');
const lastRefreshTime = document.getElementById('lastRefreshTime');
const nextRefreshTimeEl = document.getElementById('nextRefreshTime');
const cookieCountEl = document.getElementById('cookieCount');
const rawCookieBox = document.getElementById('rawCookieBox');
const tokenBox = document.getElementById('tokenBox');
const btnManualRefresh = document.getElementById('btnManualRefresh');
const btnTestCookies = document.getElementById('btnTestCookies');
const btnCopyCookie = document.getElementById('btnCopyCookie');
const copyLabel = document.getElementById('copyLabel');
const btnCopyToken = document.getElementById('btnCopyToken');
const copyTokenLabel = document.getElementById('copyTokenLabel');
const cookiesTableBody = document.getElementById('cookiesTableBody');
const btnReloadTable = document.getElementById('btnReloadTable');

// Test elements
const testResultSection = document.getElementById('testResultSection');
const testStatusBadge = document.getElementById('testStatusBadge');
const testStatusCode = document.getElementById('testStatusCode');
const testLatency = document.getElementById('testLatency');
const testVerdict = document.getElementById('testVerdict');
const testResponseBox = document.getElementById('testResponseBox');

// Fetch Status & Data
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.state) {
      updateUIStatus(data);
    }
  } catch (err) {
    console.error('Error fetching status:', err);
    setStatusBadge('error', 'OFFLINE');
  }
}

async function fetchCookies() {
  try {
    const res = await fetch('/api/cookies');
    const data = await res.json();
    if (data.success) {
      rawCookieBox.textContent = data.cookieString || '(Belum ada cookies tersimpan)';
      if (tokenBox) {
        tokenBox.textContent = data.token || '(Belum login / belum ada token)';
      }
      renderCookiesTable(data.cookies || []);
      cookieCountEl.textContent = `${data.count || 0} Cookies`;
    }
  } catch (err) {
    console.error('Error fetching cookies:', err);
  }
}

function updateUIStatus(data) {
  const { isRefreshing, state } = data;

  targetUrlText.textContent = state.targetUrl || 'https://vhjgakh.com';

  if (isRefreshing || state.status === 'refreshing') {
    setStatusBadge('refreshing', 'REFRESHING...');
    btnManualRefresh.disabled = true;
    btnManualRefresh.querySelector('span').textContent = 'Sedang Refresh...';
  } else if (state.status === 'error') {
    setStatusBadge('error', 'ERROR');
    btnManualRefresh.disabled = false;
    btnManualRefresh.querySelector('span').textContent = 'Refresh Cookies Sekarang';
  } else if (state.hasValidSession) {
    setStatusBadge('success', 'SESSION ACTIVE');
    btnManualRefresh.disabled = false;
    btnManualRefresh.querySelector('span').textContent = 'Refresh Cookies Sekarang';
  } else {
    setStatusBadge('idle', 'IDLE');
    btnManualRefresh.disabled = false;
    btnManualRefresh.querySelector('span').textContent = 'Refresh Cookies Sekarang';
  }

  // Last refresh format
  if (state.lastRefresh) {
    const d = new Date(state.lastRefresh);
    lastRefreshTime.textContent = d.toLocaleTimeString('id-ID') + ' (' + d.toLocaleDateString('id-ID') + ')';
  } else {
    lastRefreshTime.textContent = 'Belum pernah';
  }

  // Next refresh
  if (state.nextRefresh) {
    nextRefreshTime = new Date(state.nextRefresh).getTime();
    const d = new Date(state.nextRefresh);
    nextRefreshTimeEl.textContent = d.toLocaleTimeString('id-ID');
  }
}

function setStatusBadge(type, label) {
  globalStatusBadge.className = 'status-badge ' + type;
  statusLabel.textContent = label;
}

// Countdown Timer
function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    if (!nextRefreshTime) {
      countdownMin.textContent = '--';
      countdownSec.textContent = '--';
      return;
    }

    const now = Date.now();
    const diff = Math.max(0, nextRefreshTime - now);

    const totalSeconds = Math.floor(diff / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    countdownMin.textContent = String(minutes).padStart(2, '0');
    countdownSec.textContent = String(seconds).padStart(2, '0');

    if (diff <= 0) {
      // Waktu habis, fetch status untuk cek apakah refresh sedang berjalan
      fetchStatus();
    }
  }, 1000);
}

// Render Table
function renderCookiesTable(cookies) {
  if (!cookies || cookies.length === 0) {
    cookiesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada cookie tersimpan</td></tr>';
    return;
  }

  let html = '';
  cookies.forEach(c => {
    html += `
      <tr>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td class="cookie-val" title="${escapeHtml(c.value)}">${escapeHtml(c.value)}</td>
        <td>${escapeHtml(c.domain || '-')}</td>
        <td>${escapeHtml(c.path || '/')}</td>
        <td>${c.httpOnly ? '✅' : '❌'}</td>
        <td>${c.secure ? '✅' : '❌'}</td>
      </tr>
    `;
  });
  cookiesTableBody.innerHTML = html;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Manual Refresh Trigger
btnManualRefresh.addEventListener('click', async () => {
  btnManualRefresh.disabled = true;
  btnManualRefresh.querySelector('span').textContent = 'Memulai Refresh...';
  setStatusBadge('refreshing', 'REFRESHING...');

  try {
    const res = await fetch('/api/refresh', { method: 'POST' });
    const data = await res.json();
    console.log('Refresh trigger response:', data);

    // Polling status setiap 2 detik sampai selesai
    const pollTimer = setInterval(async () => {
      await fetchStatus();
      await fetchCookies();
      const statusRes = await fetch('/api/status');
      const statusData = await statusRes.json();
      if (!statusData.isRefreshing) {
        clearInterval(pollTimer);
      }
    }, 2000);
  } catch (err) {
    alert('Gagal memicu refresh: ' + err.message);
    btnManualRefresh.disabled = false;
  }
});

// Test Cookies Button
btnTestCookies.addEventListener('click', async () => {
  btnTestCookies.disabled = true;
  btnTestCookies.querySelector('span').textContent = 'Menguji...';
  testResultSection.style.display = 'block';
  testVerdict.textContent = 'Mengirim request...';
  testStatusCode.textContent = '...';
  testLatency.textContent = '...';

  try {
    const res = await fetch('/api/test');
    const data = await res.json();

    testStatusCode.textContent = data.statusCode || (res.ok ? 200 : res.status);
    testLatency.textContent = data.latencyMs || '-';
    testResponseBox.textContent = JSON.stringify(data, null, 2);

    if (data.success) {
      testStatusBadge.className = 'badge badge-success';
      testStatusBadge.textContent = 'BERHASIL';
      testVerdict.textContent = 'Aktif & Valid';
      testVerdict.style.color = 'var(--accent-success)';
    } else {
      testStatusBadge.className = 'badge badge-warning';
      testStatusBadge.textContent = 'PERINGATAN';
      testVerdict.textContent = 'Gagal / Dialihkan';
      testVerdict.style.color = 'var(--accent-warning)';
    }
  } catch (err) {
    testStatusCode.textContent = 'ERR';
    testLatency.textContent = '-';
    testStatusBadge.className = 'badge badge-danger';
    testStatusBadge.textContent = 'ERROR';
    testVerdict.textContent = 'Koneksi Gagal';
    testVerdict.style.color = 'var(--accent-danger)';
    testResponseBox.textContent = err.message;
  } finally {
    btnTestCookies.disabled = false;
    btnTestCookies.querySelector('span').textContent = 'Test Validitas Cookies';
  }
});

// Copy Cookie Header Button
btnCopyCookie.addEventListener('click', () => {
  const text = rawCookieBox.textContent;
  if (!text || text.includes('Belum ada')) {
    alert('Belum ada cookies untuk disalin.');
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    copyLabel.textContent = 'Tersalin! ✅';
    setTimeout(() => {
      copyLabel.textContent = 'Copy Header';
    }, 2000);
  });
});

// Copy Auth Token Button
if (btnCopyToken) {
  btnCopyToken.addEventListener('click', () => {
    const text = tokenBox.textContent;
    if (!text || text.includes('Belum')) {
      alert('Belum ada token otentikasi untuk disalin.');
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      copyTokenLabel.textContent = 'Tersalin! ✅';
      setTimeout(() => {
        copyTokenLabel.textContent = 'Copy Token';
      }, 2000);
    });
  });
}

btnReloadTable.addEventListener('click', () => {
  fetchCookies();
  fetchStatus();
});

// Initialize
fetchStatus();
fetchCookies();
startCountdown();
setInterval(fetchStatus, 10000); // Polling status setiap 10 detik
