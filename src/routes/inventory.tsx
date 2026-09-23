import { createFileRoute } from '@tanstack/react-router'
import { ArrowDownRight, ArrowUpRight, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
export const Route = createFileRoute('/inventory')({ component: Inventory })
type Product = { id: string; sku: string; name: string; unit: string; product_type: string }
type Row = Product & { quantity: number }
const demo: Row[] = [
  {
    id: 'p-a',
    sku: 'GB-ARA',
    name: 'Green Bean Arabica Gayo',
    unit: 'Kg',
    product_type: 'RAW_MATERIAL',
    quantity: 55,
  },
  {
    id: 'p-r',
    sku: 'GB-ROB',
    name: 'Green Bean Robusta Temanggung',
    unit: 'Kg',
    product_type: 'RAW_MATERIAL',
    quantity: 30,
  },
  {
    id: 'p-e',
    sku: 'ESP-001',
    name: 'Espresso Blend',
    unit: 'Kg',
    product_type: 'FINISHED_GOOD',
    quantity: 12,
  },
]
function Inventory() {
  const [rows, setRows] = useState(demo)
  const [show, setShow] = useState(false)
  const [kind, setKind] = useState<'IN' | 'OUT'>('IN')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!supabase) return
    ;(async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id,sku,name,unit,product_type')
        .eq('is_active', true)
        .order('name')
      if (error || !data) return
      const ids = data.map((p) => p.id)
      const { data: balances } = await supabase
        .from('stock_balances')
        .select('product_id,quantity')
        .in('product_id', ids)
      setRows(
        data.map((p) => ({
          ...p,
          quantity: Number(balances?.find((b) => b.product_id === p.id)?.quantity ?? 0),
        })),
      )
    })()
  }, [])
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[.16em] text-neutral-500">Inventory</p>
          <h1 className="mt-1 text-2xl font-semibold">Stok</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Saldo stok selalu berasal dari ledger mutasi.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setKind('IN')
              setShow(true)
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white"
          >
            <Plus size={16} /> Stok Masuk
          </button>
          <button
            onClick={() => {
              setKind('OUT')
              setShow(true)
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium"
          >
            <ArrowDownRight size={16} /> Stok Keluar
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Produk</th>
                <th className="px-5 py-3 font-medium">Jenis</th>
                <th className="px-5 py-3 font-medium">Stok</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const low = false
                return (
                  <tr key={r.id} className="border-t border-neutral-100">
                    <td className="px-5 py-4 font-mono text-xs text-neutral-500">{r.sku}</td>
                    <td className="px-5 py-4 font-medium">{r.name}</td>
                    <td className="px-5 py-4 text-xs text-neutral-500">{r.product_type}</td>
                    <td className="px-5 py-4 font-semibold">
                      {r.quantity} {r.unit}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {low && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                          Menipis
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {show && (
        <StockModal
          kind={kind}
          products={rows}
          loading={loading}
          setLoading={setLoading}
          close={() => setShow(false)}
          refresh={async () => {
            if (!supabase) return
            const { data } = await supabase.from('stock_balances').select('product_id,quantity')
            setRows((v) =>
              v.map((p) => ({
                ...p,
                quantity: Number(data?.find((x) => x.product_id === p.id)?.quantity ?? 0),
              })),
            )
          }}
        />
      )}
    </div>
  )
}
function StockModal({
  kind,
  products,
  close,
  refresh,
  loading,
  setLoading,
}: {
  kind: 'IN' | 'OUT'
  products: Product[]
  close: () => void
  refresh: () => Promise<void>
  loading: boolean
  setLoading: (v: boolean) => void
}) {
  const [id, setId] = useState(products[0]?.id ?? '')
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  async function save() {
    if (!supabase || !id || Number(qty) <= 0) return
    setLoading(true)
    setError('')
    const { error: e } = await supabase.rpc('record_stock_movement', {
      p_product_id: id,
      p_quantity: kind === 'IN' ? Number(qty) : -Number(qty),
      p_movement_type: kind,
      p_notes: notes || null,
    })
    if (e) setError(e.message)
    else {
      await refresh()
      close()
    }
    setLoading(false)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 p-5">
          <div>
            <h2 className="font-semibold">{kind === 'IN' ? 'Stok Masuk' : 'Stok Keluar'}</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Perubahan akan langsung masuk ke ledger.
            </p>
          </div>
          <button onClick={close} className="rounded-lg p-2 hover:bg-neutral-100">
            <X size={17} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <Field label="Produk">
            <select className="field" value={id} onChange={(e) => setId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.sku}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Qty">
            <input
              className="field"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              placeholder="0"
            />
          </Field>
          <Field label="Keterangan">
            <input
              className="field"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                kind === 'IN' ? 'Pembelian / hasil koreksi' : 'Penjualan / distribusi / koreksi'
              }
            />
          </Field>
          {error && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</div>}
        </div>
        <div className="flex gap-2 border-t border-neutral-100 p-5">
          <button
            onClick={close}
            className="flex-1 rounded-xl border border-neutral-200 py-2.5 text-sm font-medium"
          >
            Batal
          </button>
          <button
            disabled={loading || Number(qty) <= 0}
            onClick={save}
            className="flex-1 rounded-xl bg-neutral-950 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {loading ? 'Menyimpan...' : 'Simpan Mutasi'}
          </button>
        </div>
      </div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  )
}
