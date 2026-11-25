# Letter Moss: toko font handwritten (dulu Typology)

Situs statis tanpa dependensi untuk toko font handwritten. Katalog dibaca dari JSON, setiap font punya halaman sendiri (HTML statis, bagus untuk SEO), dan pembelian lewat Gumroad. Hosting: Cloudflare Pages.

## Isi
- Halaman: `/`, `/shop/`, `/fonts/<slug>/`, `/licensing/`, `/about/`, `/faq/`, `/contact/`, `/privacy/`, `/terms/`, `404`
- Tester font global (beranda & katalog) dan tester per font (halaman detail): teks, ukuran, warna teks, warna latar, perataan, reset, filter kategori
- Preview memakai file WOFF2 asli tiap font, dimuat malas (hanya saat mendekati layar), `font-display: swap`
- Sitemap, robots.txt, canonical, Open Graph, JSON-LD (Organization, Product, BreadcrumbList, FAQPage, ItemList)

## Menjalankan di komputer
```
node build.mjs        # hasil di dist/
npm run dev           # build + server lokal di http://localhost:8080
```
Butuh Node 18+. Tidak ada `npm install`.

## Deploy ke Cloudflare Pages (tanpa terminal)
1. Upload isi folder ini ke repo GitHub (lewat web: Add file, Upload files).
2. Cloudflare Dashboard, Workers & Pages, Create, Pages, Connect to Git, pilih repo.
3. Build command: `node build.mjs`. Build output directory: `dist`. Environment variable (opsional): `NODE_VERSION=20`.
4. Setelah live, ubah `url` di `data/site.json` ke domain asli, lalu commit ulang.

## Mengisi katalog asli
Semua data ada di `data/products.json`. Tiga produk saat ini adalah **placeholder** (nama, harga, dan URL Gumroad contoh). Untuk tiap font asli:
1. Konversi OTF/TTF ke WOFF2: `python3 scripts/convert-fonts.py MyFont.otf fonts/previews/font-04.woff2` (butuh `pip install fonttools brotli`). Simpan master OTF/TTF di luar repo.
2. Tambahkan objek baru di `products` (salin salah satu contoh). Kolom: id, slug, name, category, description, price, previewFont, previewFontFile, productImage, specimenImages, gumroadUrl, fontStyles, glyphInformation, languageSupport, features, releaseDate, featured, bestSeller.
3. `python3 scripts/inspect-fonts.py` membaca isi WOFF2 (jumlah glyph, karakter, fitur OpenType) dan menulis `data/font-report.json`; halaman detail memakainya untuk grid glyph dan daftar fitur.
4. `python3 scripts/make-images.py` membuat gambar OG dan specimen dari font (butuh `pillow`). Atau pakai gambar buatan sendiri.
5. Hapus `"placeholder": true` dan jalankan `node build.mjs`. Build akan gagal jika ada kolom, kategori, atau file font yang hilang.

## Hero beranda
Teks hero "Your words, handwritten" adalah SVG (`src/images/hero-your-words.svg`) yang diekspor dari frame Figma "Home revamp v1" (font Hegomoni Signature, teks di-outline). Caption-nya diatur lewat `heroCaption` di `data/site.json`. Untuk mengganti, ekspor ulang teks hero dari Figma sebagai SVG dan timpa file itu.

## Gumroad
- Tombol **Buy now** memakai `gumroadUrl` tiap produk dan membuka checkout Gumroad di tab baru. Link langsung ini selalu tersedia.
- Overlay Gumroad: set `"gumroadOverlay": true` di `data/site.json` hanya setelah Anda mengujinya dengan produk asli. Jika skrip Gumroad gagal, link langsung tetap jalan.
- Tidak ada pemrosesan pembayaran di situs ini, dan tidak ada pembelian yang dianggap sukses sebelum Gumroad mengonfirmasi.

## Yang harus Anda ganti sebelum rilis
- `data/site.json`: `url`, `email`, `instagram`, `licenseSummary`
- `data/products.json`: seluruh produk placeholder
- Teks `/about/`, `/faq/`, `/licensing/`, `/privacy/`, `/terms/` di `build.mjs` adalah draf umum. Periksa dan sesuaikan dengan ketentuan lisensi Anda; sebaiknya ditinjau ahli hukum.
- Formulir kontak membuka aplikasi email pengunjung (tanpa backend). Untuk formulir sungguhan, sambungkan layanan formulir dan ubah `src/js/contact.js`.

## Performa & catatan
- Skor Lighthouse (lokal, desktop, build ini): Performance 99-100, Accessibility 96-100, Best Practices 100, SEO 100, CLS 0. Ini hasil pengukuran sesaat, bukan jaminan; ukur ulang setelah deploy dengan font asli.
- Hanya font hero dan font UI yang di-preload; font lain dimuat saat spesimen mendekati layar.
- Struktur: `build.mjs` (generator + komponen), `src/css`, `src/js`, `data/`, `fonts/`, `public/` (`_headers`, robots, favicon), `wrangler.toml`.

### Bagian "Best for" di halaman font
Isi `bestFor` di `data/products.json` (3 kartu per font: dua berdampingan, kartu ketiga lebar penuh):
- `title`, `text`: nama kegunaan dan satu kalimat penjelasan.
- `words`: contoh tulisan yang tampil di kartu dan masuk ke tester saat "Try these words" diklik.
- `bg`, `fg`: warna latar dan tulisan (hex, misalnya `#1C1B18`). - `image` (opsional): foto mockup, misalnya `/images/mockups/lempo-cafe.jpg` (simpan di `src/images/mockups/`, rasio 3:2, lebar 1200 px untuk kartu kecil dan 2000 px untuk kartu lebar). Jika diisi, foto menggantikan contoh tulisan. `imageAlt` untuk teks alternatif.

## Brand Letter Moss (brand guidelines v3)

- Nama, tagline dan slogan ada di `data/site.json` (`name`, `tagline`, `slogan`). Di kalimat ditulis "Letter Moss"; domain dan akun: `lettermoss`.
- Logo di header dan footer: susunan horizontal (simbol garis tunggal + wordmark dua baris) sebagai SVG inline, konstanta `LOGO_PATHS` di `build.mjs`. Warnanya mengikuti tema lewat `currentColor`.
- Ikon: `public/favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png`. Gambar share default: `public/og-image.png` (1200 × 630).
- Tombol utama memakai warna Moss (`--olive`).
- Belum diganti (menunggu domain baru): `url` di `data/site.json`, link Gumroad `typology.gumroad.com`, nama proyek Cloudflare `typology` di `wrangler.toml`.
