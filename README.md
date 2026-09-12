# 🔄 Puppeteer Auto-Login & Smart Auto-Detect Expiry Token/Cookie Refresher

Aplikasi otomatisasi berbasis **Node.js**, **Express**, dan **Puppeteer Stealth** yang secara otomatis **mendeteksi waktu kedaluwarsa bawaan dari Cookies / JWT Auth Token**, menghitung jadwal kedaluwarsa secara dinamis, dan melakukan **re-login otomatis tepat sebelum sesi berakhir** tanpa perlu mengatur waktu manual.

---

## 📑 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Cara Kerja Auto-Detect Expiry](#-cara-kerja-auto-detect-expiry)
- [Struktur Proyek](#-struktur-proyek)
- [Konfigurasi `.env`](#-konfigurasi-env)
- [Menjalankan Aplikasi](#-menjalankan-aplikasi)
- [Dokumentasi REST API](#-dokumentasi-rest-api)
  - [1. GET `/api/cookies`](#1-get-apicookies)
  - [2. GET `/api/cookies/raw`](#2-get-apicookiesraw)
  - [3. GET `/api/test`](#3-get-apitest)
  - [4. POST `/api/refresh`](#4-post-apirefresh)
  - [5. GET `/api/status`](#5-get-apistatus)
- [Web Dashboard Interaktif](#-web-dashboard-interaktif)
- [Troubleshooting & Solusi](#-troubleshooting--solusi)

---

## ⚡ Cara Kerja Auto-Detect Expiry

Tidak perlu lagi mengatur timer interval secara manual! Sistem bekerja secara dinamis:

1. **Deteksi JWT Auth Token & Cookie Expiry**:
   - Sistem membedah payload JWT Token (`exp` epoch & expiration claim) dan timestamp cookie bawaan.
   - Contoh token `exp`: `1789218184` (kedaluwarsa pukul `22:03:04`).
2. **Kalkulasi Waktu Re-login Otomatis**:
   - Re-login dijadwalkan otomatis **60 detik sebelum token kedaluwarsa** (pukul `22:02:04`).
   - Mencegah sesi putus (*zero downtime*) di aplikasi atau bot pengguna.
3. **Pembaruan Siklus Berkelanjutan**:
   - Setiap kali re-login sukses, sistem membaca masa berlaku token baru dan memperbarui timer mundur berikutnya secara otomatis.

---

## ✨ Fitur Utama

- ⚡ **Smart Auto-Detect Expiry**: Menghitung masa aktif JWT Token / Cookies bawaan secara otomatis.
- 🥷 **Puppeteer Stealth Plugin**: Menyamarkan browser Chromium dari deteksi bot, sensor WAF, dan proteksi Cloudflare.
- 🔑 **Ekstraksi JWT Auth Token**: Menangkap token otentikasi sesi dari `localStorage.token` dan data profil user (NickName, Username, Saldo).
- 🍪 **Manajemen Cookies Lengkap**: Menyimpan semua cookies sesi dan menyediakan format raw string siap pakai di header `Cookie`.
- 💾 **Persistensi Sesi (`session.json`)**: Sesi dan token tersimpan otomatis ke file lokal sehingga tidak hilang saat server di-restart.
- 🧪 **API Test Validitas Sesi**: Pengujian live ke website target menggunakan headless browser engine untuk memastikan akun tetap login.
- 📊 **Web Dashboard Real-time**: Dashboard modern dark-mode dengan live countdown timer, 1-klik copy token/cookie, dan trigger refresh manual.

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
        ├── sessionStore.js      # Pengelolaan memori & deteksi masa kedaluwarsa
        └── scheduler.js         # Dynamic scheduler berbasis waktu kedaluwarsa
```

---

## 🔧 Konfigurasi `.env`

File [`.env`](file:///y:/code/web%20judol%20refresh%20token%20per%2030%20menit/.env):

```env
# Port Server API
PORT=3000

# Target Web & Kredensial Akun
TARGET_URL=https://vhjgakh.com
ACCOUNT_USERNAME=6283170370428
ACCOUNT_PASSWORD=Cikol1777

# Mode Headless (true = background, false = buka browser Chrome)
HEADLESS=true

# Proxy Opsional (jika domain diblokir ISP lokal)
# PROXY_SERVER=http://127.0.0.1:8080

# Selector Kustom (opsional, biarkan kosong untuk deteksi otomatis)
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

Log server akan menampilkan:
```text
====================================================
🚀 Cookie Refresher Service berjalan di port 3000
🌐 Dashboard UI: http://localhost:3000
🍪 API Cookies:  http://localhost:3000/api/cookies
🧪 API Test:     http://localhost:3000/api/test
🔄 Target URL:   https://vhjgakh.com
====================================================
[Scheduler] Mode Auto-Detect Expiry aktif (Re-login otomatis berdasarkan waktu kedaluwarsa cookies/token).
[Scheduler] Re-login otomatis dijadwalkan pada: 22.02.04 (dalam ~28.8 menit)
[Scheduler] Sumber deteksi: JWT Token (exp: 22.03.04)
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
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenInfo": {
      "userName": "6283170370428",
      "nickName": "Cikol17",
      "amount": "65.85",
      "expiresClaim": "9/12/2026 8:03:04 PM"
    },
    "expiresAt": "2026-09-12T13:03:04.000Z",
    "expirySource": "JWT Token (exp: 22.03.04)",
    "cookies": [ ... ],
    "cookieString": "_ga=...; _ga_FY6BMXPSR0=...",
    "lastRefresh": "2026-09-12T12:33:09.311Z"
  }
  ```

---

### 2. `GET /api/cookies/raw`
Mengembalikan string cookie mentah yang siap langsung ditempelkan ke HTTP header `Cookie: <value>`.

- **Contoh Request:**
  ```bash
  curl http://localhost:3000/api/cookies/raw
  ```

---

### 3. `GET /api/test`
Menguji apakah sesi login dan cookies yang tersimpan saat ini masih aktif dan valid pada website target.

- **Contoh Request:**
  ```bash
  curl http://localhost:3000/api/test
  ```
- **Contoh Response:**
  ```json
  {
    "success": true,
    "method": "puppeteer_live_check",
    "statusCode": 200,
    "latencyMs": "11099ms",
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
Memicu proses login Puppeteer dan pembaruan cookies secara manual seketika.

- **Contoh Request:**
  ```bash
  curl -X POST "http://localhost:3000/api/refresh?wait=true"
  ```

---

### 5. `GET /api/status`
Mengecek status service, waktu kedaluwarsa sesi (`expiresAt`), dan jadwal re-login otomatis berikutnya (`nextRefresh`).

- **Contoh Request:**
  ```bash
  curl http://localhost:3000/api/status
  ```
- **Contoh Response:**
  ```json
  {
    "status": "ok",
    "isRefreshing": false,
    "mode": "auto_detect_expiry",
    "state": {
      "status": "success",
      "accountUsername": "6283170370428",
      "nickName": "Cikol17",
      "userAmount": "65.85",
      "lastRefresh": "2026-09-12T12:33:09.311Z",
      "expiresAt": "2026-09-12T13:03:04.000Z",
      "nextRefresh": "2026-09-12T13:02:04.000Z",
      "expirySource": "JWT Token (exp: 22.03.04)",
      "timeUntilExpirySec": 1789,
      "timeUntilRefreshSec": 1729,
      "cookieCount": 2,
      "hasAuthToken": true,
      "hasValidSession": true,
      "targetUrl": "https://vhjgakh.com"
    }
  }
  ```

---

## 🖥️ Web Dashboard Interaktif

Buka **`http://localhost:3000`** pada browser:
1. ⏱️ **Countdown Timer Otomatis**: Menghitung mundur menuju jadwal re-login dinamis berikutnya.
2. 👤 **Profil & Saldo**: Menampilkan Nama Akun, Nickname (`Cikol17`), dan Saldo aktif.
3. ⏳ **Info Kedaluwarsa Sesi**: Jam kedaluwarsa token JWT & sumber deteksi.
4. 🔑 **Token Box**: Menampilkan token JWT aktif dan tombol *1-Click Copy*.
5. 🍪 **Raw Cookie Box**: Menampilkan string header cookie dan tombol *1-Click Copy*.
6. 🧪 **Test Validitas Cookies**: Tombol pengecekan live ke web target.
7. 🔄 **Refresh Cookies Sekarang**: Tombol trigger manual login ulang instan.

---

## 📄 Lisensi

ISC License &copy; 2026
