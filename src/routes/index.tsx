import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  Factory,
  Package,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/')({ component: Dashboard })

const demo = { products: 8, stockItems: 8, productionToday: 3, movementsToday: 12 }

const dayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function Dashboard() {
  const [stats, setStats] = useState(demo)
  const [recent, setRecent] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])

  useEffect(() => {
    if (!supabase) return
    ;(async () => {
      const since = new Date()
      since.setDate(since.getDate() - 6)

      const [
        { count: products },
        { count: production },
        { count: movements },
        { data: rows },
        { data: batchRows },
      ] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase
          .from('production_batches')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date().toISOString().slice(0, 10)),
        supabase
          .from('stock_movements')
          .select('*', { count: 'exact', head: true })
          .gte('movement_date', new Date().toISOString().slice(0, 10)),
        supabase
          .from('stock_ledger')
          .select('*')
          .gte('movement_date', since.toISOString())
          .order('movement_date', { ascending: false })
          .limit(60),
        supabase
          .from('production_batches')
          .select('id,batch_number,product_id,output_quantity,status,created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      ])
      setStats({
        products: products ?? 0,
        stockItems: products ?? 0,
        productionToday: production ?? 0,
        movementsToday: movements ?? 0,
      })
      if (rows) setRecent(rows)

      if (batchRows?.length) {
        const { data: productData } = await supabase
          .from('products')
          .select('id,name,unit')
          .in(
            'id',
            batchRows.map((b: any) => b.product_id),
          )
        const productMap = new Map((productData ?? []).map((p: any) => [p.id, p]))
        setBatches(
          batchRows.map((b: any) => ({ ...b, product: productMap.get(b.product_id) })),
        )
      }
    })()
  }, [])

  const weekly = useMemo(() => buildWeekly(recent), [recent])

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[.16em] text-blue-600">Overview</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Gudang Kembaran</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Semua pergerakan bahan dan produk tercatat dalam satu ledger.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Produk aktif" value={stats.products} icon={Package} color="orange" />
        <Stat label="Item stok" value={stats.stockItems} icon={Boxes} color="emerald" />
        <Stat
          label="Produksi hari ini"
          value={`${stats.productionToday} batch`}
          icon={Factory}
          color="blue"
        />
        <Stat label="Mutasi hari ini" value={stats.movementsToday} icon={ClipboardList} color="rose" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <section className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Mutasi Mingguan</h2>
              <p className="mt-1 text-xs text-neutral-500">Total unit keluar-masuk 7 hari terakhir</p>
            </div>
          </div>
          <div className="mt-3 text-2xl font-semibold">
            {weekly.reduce((a, d) => a + d.total, 0).toLocaleString('id-ID')}{' '}
            <span className="text-sm font-normal text-neutral-400">unit</span>
          </div>
          <WeeklyChart data={weekly} />
        </section>

        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-sky-400 p-6 text-white shadow-sm">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-14 -right-6 h-44 w-44 rounded-full bg-white/10" />
          <span className="relative inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide">
            <Sparkles size={11} /> Baru
          </span>
          <h3 className="relative mt-4 text-lg font-semibold leading-snug">
            Catat batch produksi lebih cepat dari dashboard
          </h3>
          <p className="relative mt-2 text-xs text-blue-50/90">
            Stok bahan otomatis berkurang dan hasil produksi tercatat langsung ke ledger.
          </p>
          <Link
            to="/production"
            className="relative mt-6 flex w-full items-center justify-center rounded-xl bg-white py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Buat Batch Sekarang
          </Link>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
        <section className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Aktivitas</h2>
            <Link to="/movements" className="text-xs font-medium text-blue-600 hover:underline">
              Lihat semua
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {recent.length ? (
              recent.slice(0, 6).map((r) => <Movement key={r.id} row={r} />)
            ) : (
              <div className="rounded-xl bg-neutral-50 p-5 text-sm text-neutral-500">
                Belum ada mutasi. Mulai dengan stok masuk atau produksi.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Batch Produksi Terbaru</h2>
            <Link to="/production" className="text-xs font-medium text-blue-600 hover:underline">
              Lihat semua
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            {batches.length ? (
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-400">
                    <th className="pb-2 font-medium">Batch</th>
                    <th className="pb-2 font-medium">Produk</th>
                    <th className="pb-2 font-medium">Output</th>
                    <th className="pb-2 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="border-t border-neutral-100">
                      <td className="py-3 font-medium text-neutral-800">{b.batch_number}</td>
                      <td className="py-3 text-neutral-500">{b.product?.name ?? '—'}</td>
                      <td className="py-3 text-neutral-500">
                        {Number(b.output_quantity ?? 0)} {b.product?.unit ?? ''}
                      </td>
                      <td className="py-3 text-right">
                        <StatusPill status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rounded-xl bg-neutral-50 p-5 text-sm text-neutral-500">
                Belum ada batch produksi.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:hidden">
        <section className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Mulai aktivitas</h2>
          <p className="mt-1 text-xs text-neutral-500">Semua aksi akan membuat catatan mutasi.</p>
          <div className="mt-4 space-y-2">
            <Link
              to="/inventory"
              className="flex items-center justify-between rounded-xl border border-neutral-200 p-4 text-sm font-medium hover:bg-neutral-50"
            >
              <span>Stok masuk / keluar</span>
              <ArrowUpRight size={15} />
            </Link>
            <Link
              to="/production"
              className="flex items-center justify-between rounded-xl border border-neutral-200 p-4 text-sm font-medium hover:bg-neutral-50"
            >
              <span>Buat batch produksi</span>
              <ArrowUpRight size={15} />
            </Link>
            <Link
              to="/products"
              className="flex items-center justify-between rounded-xl border border-neutral-200 p-4 text-sm font-medium hover:bg-neutral-50"
            >
              <span>Kelola produk</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

function buildWeekly(rows: any[]) {
  const days: { key: string; label: string; total: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({ key: d.toISOString().slice(0, 10), label: dayLabels[d.getDay()], total: 0 })
  }
  const map = new Map(days.map((d) => [d.key, d]))
  for (const r of rows) {
    const key = String(r.movement_date).slice(0, 10)
    const day = map.get(key)
    if (day) day.total += Math.abs(Number(r.quantity) || 0)
  }
  return days
}

function WeeklyChart({ data }: { data: { key: string; label: string; total: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1)
  const todayKey = new Date().toISOString().slice(0, 10)
  return (
    <div className="mt-6 flex h-40 items-end gap-3 sm:gap-4">
      {data.map((d) => {
        const isToday = d.key === todayKey
        const height = Math.max((d.total / max) * 100, 6)
        return (
          <div key={d.key} className="relative flex flex-1 flex-col items-center gap-2">
            {isToday && d.total > 0 && (
              <div className="absolute -top-8 rounded-lg bg-neutral-900 px-2 py-1 text-[10px] font-semibold text-white">
                {d.total.toLocaleString('id-ID')}
              </div>
            )}
            <div className="flex h-32 w-full items-end rounded-lg bg-neutral-100">
              <div
                className={`w-full rounded-lg transition-all ${isToday ? 'bg-blue-600' : 'bg-neutral-200'}`}
                style={{ height: `${height}%` }}
              />
            </div>
            <span
              className={`text-[11px] ${isToday ? 'font-semibold text-blue-600' : 'text-neutral-400'}`}
            >
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const statColors: Record<string, string> = {
  orange: 'bg-orange-50 text-orange-500',
  emerald: 'bg-emerald-50 text-emerald-500',
  blue: 'bg-blue-50 text-blue-600',
  rose: 'bg-rose-50 text-rose-500',
}

function Stat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  icon: any
  color: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm">
      <div className={`rounded-xl p-2.5 ${statColors[color]}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="mt-0.5 text-lg font-semibold">{value}</p>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: 'bg-emerald-50 text-emerald-600',
    DONE: 'bg-emerald-50 text-emerald-600',
    IN_PROGRESS: 'bg-blue-50 text-blue-600',
    DRAFT: 'bg-neutral-100 text-neutral-500',
    CANCELLED: 'bg-red-50 text-red-600',
  }
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${map[status] ?? 'bg-neutral-100 text-neutral-500'}`}
    >
      {status}
    </span>
  )
}

function Movement({ row }: { row: any }) {
  const positive = Number(row.quantity) > 0
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-100 px-4 py-3">
      <div
        className={`rounded-lg p-2 ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
      >
        {positive ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{row.product_name}</p>
        <p className="text-[11px] text-neutral-500">
          {row.movement_type}
          {row.batch_number ? ` · ${row.batch_number}` : ''}
        </p>
      </div>
      <div className={`text-sm font-semibold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
        {positive ? '+' : ''}
        {row.quantity} {row.unit}
      </div>
    </div>
  )
}
