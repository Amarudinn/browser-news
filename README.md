# Browser Cash Automation Scripts

Ini adalah kumpulan script otomatisasi untuk platform Browser.cash.

## Persiapan

1.  Pastikan Node.js terinstal.
2.  Buat file `.env` dan isi dengan API Key Anda:
    ```env
    API_KEY=your_api_key_here
    QUICKCONNECT_CDP_URL=your_cdp_url_here
    ```
    (Catatan: `runner.js` yang baru menggunakan `API_KEY` untuk membuat sesi dinamis, `QUICKCONNECT_CDP_URL` tidak lagi wajib jika menggunakan mode interaktif penuh, tapi tetap bagus untuk disimpan).

3.  Install dependensi:
    ```bash
    npm install
    ```

## Cara Menjalankan

Gunakan `runner.js` untuk mengeksekusi script. Runner ini akan meminta konfigurasi sesi secara interaktif.

```bash
npm start -- task-script/indeed.js
# ATAU
node runner.js task-script/indeed.js
```

## Opsi Sesi Interaktif

Saat dijalankan, Anda akan diminta memilih:

*   **Session Type**: `hosted` (milik Browser Cash) atau `consumer_distributed` (milik user lain).
*   **Country**: Kode negara (misal `US`, `ID`, `SG`) atau `Any`.
*   **Node ID**: (Opsional) ID spesifik node yang ingin digunakan.
*   **Window Size**: Resolusi viewport (default `1920x1080`).
*   **Use Custom Proxy**: (Opsional) URL proxy jika ingin menggunakan proxy sendiri.
*   **Use specific profile**: (Opsional) Nama profil untuk menyimpan cookie/cache antar sesi.

## Daftar Script

*   `task-script/indeed.js`: Mencari pekerjaan di Indeed.
*   `task-script/g2-reviews.js`: Mengambil review produk dari G2.
*   `task-script/ticketmaster.js`: Mencari tiket konser di Ticketmaster.
*   `task-script/load-template.js`: Template dasar.
