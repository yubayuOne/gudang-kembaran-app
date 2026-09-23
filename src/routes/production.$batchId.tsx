import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock3,
  Coffee,
  PackageCheck,
  Play,
  Scale,
  Thermometer,
  X,
} from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/production/$batchId')({ component: ProductionBatch })

const stages = [
  { key: 'roasting', label: 'Roasting', meta: '85 Kg input → 72,8 Kg output', icon: Thermometer },
  { key: 'grinding', label: 'Grinding', meta: '72,8 Kg → 71,4 Kg', icon: Scale },
  { key: 'packaging', label: 'Packaging', meta: '284 pack × 250g', icon: PackageCheck },
]

function ProductionBatch() {
  const { batchId } = Route.useParams()
  const [stage, setStage] = useState('roasting')
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to="/production"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-950"
          >
            <ArrowLeft size={14} /> Kembali ke produksi
          </Link>
          <div className="mt-4 flex items-center gap-2">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
              Sedang berjalan
            </span>
            <span className="text-xs text-neutral-400">Batch {batchId}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Espresso Blend</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Production Order PRD-260922-014 · Target 85 Kg
          </p>
        </div>
        <button
          onClick={() => setConfirm(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white"
        >
          <Check size={16} /> Selesaikan Batch
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Input" value="85 Kg" />
        <Metric label="Output" value="72,8 Kg" />
        <Metric label="Waste" value="12,2 Kg" />
        <Metric label="Yield" value="85,6%" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 p-5">
            <p className="text-xs font-medium text-neutral-500">Production flow</p>
            <h2 className="mt-1 font-semibold">Tahapan produksi</h2>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Satu tahapan hanya dapat dilanjutkan setelah data tahap sebelumnya lengkap.
            </p>
          </div>
          <div className="divide-y divide-neutral-100">
            {stages.map((item, index) => {
              const Icon = item.icon
              const active = stage === item.key
              const completed = index === 0 && done
              return (
                <button
                  key={item.key}
                  onClick={() => setStage(item.key)}
                  className={`flex w-full items-center gap-4 p-5 text-left transition ${active ? 'bg-neutral-50' : 'hover:bg-neutral-50/60'}`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${completed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : active ? 'border-neutral-300 bg-white text-neutral-950' : 'border-neutral-200 text-neutral-400'}`}
                  >
                    {completed ? <CircleCheck size={18} /> : <Icon size={18} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="mt-1 block text-xs text-neutral-500">{item.meta}</span>
                  </span>
                  <ChevronRight size={17} className="text-neutral-300" />
                </button>
              )
            })}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Coffee size={16} />
              <h2 className="font-semibold">Bahan baku</h2>
            </div>
            <div className="mt-4 space-y-3">
              <StockRow name="Arabica Gayo" qty="55 Kg" status="Cukup" />
              <StockRow name="Robusta Temanggung" qty="30 Kg" status="Cukup" />
            </div>
          </section>
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Clock3 size={16} />
              <h2 className="font-semibold">Aktivitas</h2>
            </div>
            <div className="mt-4 space-y-4 text-xs">
              <Activity title="Batch dimulai" time="10:12 · Hari ini" />
              <Activity title="Green beans dipakai" time="85 Kg · Hari ini" />
              <Activity title="Roasting sedang berjalan" time="Terakhir diperbarui 11:04" active />
            </div>
          </section>
        </aside>
      </div>

      {confirm && (
        <ConfirmModal
          close={() => setConfirm(false)}
          confirm={() => {
            setDone(true)
            setConfirm(false)
          }}
        />
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  )
}
function StockRow({ name, qty, status }: { name: string; qty: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="mt-0.5 text-xs text-neutral-500">Tersedia {qty}</p>
      </div>
      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
        {status}
      </span>
    </div>
  )
}
function Activity({ title, time, active }: { title: string; time: string; active?: boolean }) {
  return (
    <div className="flex gap-3">
      <span
        className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${active ? 'bg-amber-500' : 'bg-neutral-300'}`}
      />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-neutral-500">{time}</p>
      </div>
    </div>
  )
}
function ConfirmModal({ close, confirm }: { close: () => void; confirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between p-5">
          <div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <CircleAlert size={18} />
            </div>
            <h2 className="mt-3 font-semibold">Selesaikan batch?</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-500">
              Pastikan output, waste, dan QC sudah dicatat. Setelah diselesaikan, stok produk jadi
              akan bertambah.
            </p>
          </div>
          <button onClick={close} className="rounded-lg p-2 hover:bg-neutral-100">
            <X size={17} />
          </button>
        </div>
        <div className="flex gap-2 border-t border-neutral-100 p-5">
          <button
            onClick={close}
            className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium"
          >
            Batal
          </button>
          <button
            onClick={confirm}
            className="flex-1 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white"
          >
            Ya, selesaikan
          </button>
        </div>
      </div>
    </div>
  )
}
