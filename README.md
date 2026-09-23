# Gudang Kembaran

Aplikasi pencatatan produksi, stok, recipe/BOM, dan mutasi stok.

## Setup

```bash
npm install
```

Buat file `.env` berdasarkan `.env.example`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

## Development

```bash
npm run dev
```

## Quality checks

Format seluruh source:

```bash
npm run format
```

Cek apakah source sudah sesuai Prettier:

```bash
npm run format:check
```

Cek TypeScript:

```bash
npm run typecheck
```

Build production:

```bash
npm run build
```

## Struktur fitur

- Dashboard
- Produksi
- Inventory
- Produk
- Recipe / BOM
- Mutasi Stok

Modul procurement, sales, receivables, dan costing yang tidak digunakan dalam alur inti sudah tidak disertakan agar aplikasi tetap fokus pada pencatatan bahan, produksi, hasil, dan pergerakan stok.
