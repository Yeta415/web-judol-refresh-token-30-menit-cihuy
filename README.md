# 🔄 Puppeteer Auto-Login & 30-Minute Cookie/Token Refresher

Aplikasi otomatisasi berbasis **Node.js**, **Express**, dan **Puppeteer Stealth** yang secara otomatis melakukan login ulang ke target website (`https://vhjgakh.com`), mengekstrak & memperbarui **Cookies** dan **JWT Auth Token** setiap **30 menit**, serta menyediakan antarmuka **REST API** dan **Web Dashboard Interaktif**.

---

## 📑 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Struktur Proyek](#-struktur-proyek)
- [Persyaratan Sistem](#-persyaratan-sistem)
- [Instalasi & Pengaturan](#-instalasi--pengaturan)
- [Konfigurasi `.env`](#-konfigurasi-env)
- [Menjalankan Aplikasi](#-menjalankan-aplikasi)
- [Dokumentasi REST API](#-dokumentasi-rest-api)
  - [1. GET `/api/cookies`](#1-get-apicookies)
  - [2. GET `/api/cookies/raw`](#2-get-apicookiesraw)
  - [3. GET `/api/test`](#3-get-apitest)
  - [4. POST `/api/refresh`](#4-post-apirefresh)
  - [5. GET `/api/status`](#5-get-apistatus)
- [Web Dashboard](#-web-dashboard)
- [Cara Kerja Scheduler 30 Menit](#-cara-kerja-scheduler-30-menit)
- [Troubleshooting & Solusi](#-troubleshooting--solusi)

---

## ✨ Fitur Utama

- 🔄 **Auto-Refresh 30 Menit**: Background scheduler (`node-cron`) otomatis melakukan login ulang dan memperbarui sesi setiap 30 menit.
- 🥷 **Puppeteer Stealth Plugin**: Menyamarkan browser Chromium dari deteksi bot, sensor WAF, dan proteksi Cloudflare.
- 🔑 **Ekstraksi JWT Auth Token**: Menangkap token otentikasi sesi dari `localStorage.token` dan data profil user.
- 🍪 **Manajemen Cookies Lengkap**: Menyimpan semua cookies sesi dan menyediakan format raw string siap pakai di header `Cookie`.
- 💾 **Persistensi Sesi (`session.json`)**: Sesi dan token tersimpan otomatis ke file lokal sehingga tidak hilang saat server di-restart.
- 🧪 **API Test Validitas Sesi**: Pengujian live ke website target menggunakan headless browser engine untuk memastikan akun tetap login.
- 📊 **Web Dashboard Real-time**: Dashboard modern dark-mode dengan live countdown timer, 1-klik copy token/cookie, dan trigger refresh manual.
- 🛡️ **SSL & Cloudflare Bypass**: Dilengkapi flag `--ignore-certificate-errors` dan penanganan modal / dialog announcement secara otomatis.

---

## 📁 Struktur Proyek

```
.
├── .env                  # Konfigurasi aktif (Port, Akun, Password, URL, dll.)
├── .env.example          # Template contoh konfigurasi
├── package.json          # Dependensi Node.js & script
├── session.json          # Tempat penyimpanan cookies, token, & metadata sesi
├── screenshots/          # Tangkapan layar otomatis saat login (latest_success.png / error)
├── public/               # Frontend Web Dashboard
│   ├── index.html        # Halaman dashboard UI
│   ├── style.css         # Styling dark-mode & glassmorphism
│   └── app.js           # Logika interaktif, timer countdown, & API fetch
└── src/
    ├── server.js         # Entry point server Express
    ├── routes/
    │   └── api.js        # Definisi route REST API (/cookies, /test, /refresh, dll.)
    └── services/
        ├── puppeteerService.js  # Otomasi Puppeteer, auto-login form, & ekstraksi
        ├── sessionStore.js      # Pengelolaan memori & file session.json
        └── scheduler.js         # Pengatur jadwal cron per 30 menit
```

---

## 💻 Persyaratan Sistem

- **Node.js**: Versi `18.x` atau lebih baru (`v20.x` direkomendasikan)
- **NPM**: Versi `9.x` atau lebih baru
- **Sistem Operasi**: Windows, Linux, atau macOS

---

## ⚙️ Instalasi & Pengaturan

1. **Clone atau buka folder proyek:**
   ```bash
   cd "y:/code/web judol refresh token per 30 menit"
   ```

2. **Install semua dependensi:**
   ```bash
   npm install
   ```

3. **Salin file konfigurasi `.env`:**
   ```bash
   cp .env.example .env
   ```

---

## 🔧 Konfigurasi `.env`

Edit file [`.env`](file:///y:/code/web%20judol%20refresh%20token%20per%2030%20menit/.env) sesuai dengan akun dan preferensi Anda:

```env
# ============================================================
# SERVER CONFIGURATION
# ============================================================
PORT=3000

# ============================================================
# TARGET SITE & CREDENTIALS
# ============================================================
TARGET_URL=https://vhjgakh.com
ACCOUNT_USERNAME=6283170370428
ACCOUNT_PASSWORD=Cikol1777

# ============================================================
# REFRESH INTERVAL (dalam menit, default: 30)
# ============================================================
REFRESH_INTERVAL_MINUTES=30

# ============================================================
# PUPPETEER CONFIGURATION
# ============================================================
# 'true' = headless (background), 'false' = tampilkan jendela Chrome
HEADLESS=true

# Proxy opsional jika domain diblokir ISP lokal (contoh: http://127.0.0.1:8080)
# PROXY_SERVER=

# Timeout navigasi (milidetik)
NAVIGATION_TIMEOUT=60000

# Selector kustom (opsional, biarkan kosong untuk deteksi otomatis)
SELECTOR_USERNAME=
SELECTOR_PASSWORD=
SELECTOR_SUBMIT=
```

---

## 🚀 Menjalankan Aplikasi

Jalankan perintah berikut di terminal:

```bash
npm start
```

Setelah berjalan, output log akan menampilkan:
```text
====================================================
🚀 Cookie Refresher Service berjalan di port 3000
🌐 Dashboard UI: http://localhost:3000
🍪 API Cookies:  http://localhost:3000/api/cookies
🧪 API Test:     http://localhost:3000/api/test
🔄 Target URL:   https://vhjgakh.com
⏰ Interval:     30 menit
====================================================
[Scheduler] Mengatur auto-refresh login & cookies setiap 30 menit.
```

---

## 📚 Dokumentasi REST API

### 1. `GET /api/cookies`
Mengembalikan data lengkap cookies, JWT auth token, user agent, dan seluruh isi `localStorage`.

- **Contoh Request:**
  ```bash
  curl http://localhost:3000/api/cookies
  ```
- **Contoh Response JSON:**
  ```json
  {
    "success": true,
    "count": 2,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQi...",
    "cookies": [
      {
        "name": "_ga",
        "value": "GA1.1.1309476648.1789215143",
        "domain": ".vhjgakh.com",
        "path": "/",
        "expires": 1823775143.482271,
        "httpOnly": false,
        "secure": false
      }
    ],
    "cookieString": "_ga=GA1.1.1309476648.1789215143; _ga_FY6BMXPSR0=...",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    "lastRefresh": "2026-09-12T12:13:07.647Z"
  }
  ```

---

### 2. `GET /api/cookies/raw`
Mengembalikan string cookie mentah yang siap langsung ditempelkan ke HTTP header `Cookie: <value>`.

- **Contoh Request:**
  ```bash
  curl http://localhost:3000/api/cookies/raw
  ```
- **Contoh Response (Plain Text):**
  ```text
  _ga=GA1.1.1309476648.1789215143; _ga_FY6BMXPSR0=GS2.1.s1789215143$o1$g1$t1789215175$j28$l0$h0
  ```

---

### 3. `GET /api/test`
Menguji apakah sesi login dan cookies yang tersimpan saat ini masih aktif dan valid pada website target.

- **Contoh Request:**
  ```bash
  curl http://localhost:3000/api/test
  ```
- **Contoh Response (Sesi Aktif):**
  ```json
  {
    "success": true,
    "method": "puppeteer_live_check",
    "statusCode": 200,
    "latencyMs": "8550ms",
    "currentUrl": "https://vhjgakh.com/#/",
    "pageTitle": "55five",
    "hasAuthToken": true,
    "tokenPreview": "eyJhbGciOiJIUzI...",
    "cookieCount": 2,
    "message": "Session login valid & aktif dengan Token!"
  }
  ```

---

### 4. `POST /api/refresh`
Memicu proses login Puppeteer dan pembaruan cookies secara seketika tanpa harus menunggu interval 30 menit.

- **Parameter:**
  - `?wait=true` *(opsional)* : Menunggu hingga login selesai sebelum mengirimkan response.
- **Contoh Request:**
  ```bash
  curl -X POST "http://localhost:3000/api/refresh?wait=true"
  ```
- **Contoh Response:**
  ```json
  {
    "success": true,
    "cookieCount": 2,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ...",
    "cookieString": "_ga=GA1.1...; _ga_FY6BMXPSR0=...",
    "lastRefresh": "2026-09-12T12:13:07.647Z"
  }
  ```

---

### 5. `GET /api/status`
Mengecek status service, waktu refresh terakhir, dan waktu refresh berikutnya.

- **Contoh Request:**
  ```bash
  curl http://localhost:3000/api/status
  ```
- **Contoh Response:**
  ```json
  {
    "status": "ok",
    "isRefreshing": false,
    "state": {
      "status": "idle",
      "accountUsername": "6283170370428",
      "lastRefresh": "2026-09-12T12:13:07.647Z",
      "nextRefresh": "2026-09-12T12:43:07.647Z",
      "cookieCount": 2,
      "hasAuthToken": true,
      "tokenPreview": "eyJhbGciOiJIUzI...",
      "hasValidSession": true,
      "targetUrl": "https://vhjgakh.com",
      "lastError": null
    }
  }
  ```

---

## 🖥️ Web Dashboard

Buka **`http://localhost:3000`** pada browser untuk mengakses dashboard visual:

1. ⏱️ **Countdown Timer 30 Menit**: Menghitung mundur real-time menuju eksekusi refresh otomatis berikutnya.
2. 🔑 **Token Box**: Menampilkan JWT auth token aktif dan tombol *1-Click Copy*.
3. 🍪 **Raw Cookie Box**: Menampilkan string header cookie dan tombol *1-Click Copy*.
4. 🧪 **Test Validitas Cookies**: Tombol untuk melakukan pengecekan live ke web target dan melihat status HTTP & latensi.
5. 🔄 **Refresh Cookies Sekarang**: Tombol trigger manual login ulang instan.
6. 📑 **Tabel Detail Cookies**: Memeriksa nama, value, domain, path, secure, dan httponly dari tiap cookie.

---

## ⏰ Cara Kerja Scheduler 30 Menit

1. Saat server dinyalakan (`npm start`), scheduler memeriksa apakah sudah ada sesi tersimpan di `session.json`.
2. Jika belum ada atau sesi kosong, Puppeteer otomatis menjalankan login awal.
3. Cron job (`node-cron`) aktif dengan interval yang diatur pada `REFRESH_INTERVAL_MINUTES=30`.
4. Setiap 30 menit sekali:
   - Puppeteer Stealth membuka `https://vhjgakh.com/#/login` di latar belakang (mode headless).
   - Menutup modal / dialog pengumuman jika ada.
   - Mengisi nomor telepon & kata sandi dari `.env`.
   - Mengklik tombol login.
   - Mengambil token auth (`localStorage.token`) dan cookies terbaru.
   - Menyimpan pembaruan ke memori dan file `session.json`.
   - Menghitung waktu mundur 30 menit berikutnya.

---

## 🛠️ Troubleshooting & Solusi

| Masalah | Penyebab | Solusi |
| :--- | :--- | :--- |
| **Status 403 saat test via Axios** | Cloudflare WAF memblokir direct HTTP client | Aplikasi secara otomatis mengalihkan pengecekan ke browser stealth engine. Hasil validitas tetap akurat (`hasAuthToken: true`). |
| **Domain dialihkan ke Internet Positif** | DNS ISP lokal memblokir domain judol | Isi opsi `PROXY_SERVER=http://ip:port` di `.env` atau gunakan VPN/DNS kustom (1.1.1.1). |
| **Form login tidak terisi** | Perubahan selector pada website | Sesuaikan selector di `.env` (`SELECTOR_USERNAME`, `SELECTOR_PASSWORD`, `SELECTOR_SUBMIT`) atau set `HEADLESS=false` untuk melihat interaksi browser. |
| **Port 3000 sudah dipakai** | Aplikasi lain menggunakan port 3000 | Ganti port di `.env` (misal: `PORT=3001` atau `PORT=5000`). |

---

## 📄 Lisensi

ISC License &copy; 2026
