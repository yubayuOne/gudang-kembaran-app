import { createFileRoute } from '@tanstack/react-router'
import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
export const Route = createFileRoute('/products')({ component: Products })
type Product = {
  id: string
  sku: string
  name: string
  unit: string
  product_type: string
  is_active?: boolean
}
const demo: Product[] = [
  {
    id: 'p-a',
    sku: 'GB-ARA',
    name: 'Green Bean Arabica Gayo',
    unit: 'Kg',
    product_type: 'RAW_MATERIAL',
  },
  {
    id: 'p-r',
    sku: 'GB-ROB',
    name: 'Green Bean Robusta Temanggung',
    unit: 'Kg',
    product_type: 'RAW_MATERIAL',
  },
  { id: 'p-e', sku: 'ESP-001', name: 'Espresso Blend', unit: 'Kg', product_type: 'FINISHED_GOOD' },
]
function Products() {
  const [rows, setRows] = useState(demo)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!supabase) return
    ;(async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (!error && data) setRows(data as Product[])
    })()
  }, [])
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[.16em] text-neutral-500">Master Data</p>
          <h1 className="mt-1 text-2xl font-semibold">Produk</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Bahan baku, WIP, dan produk jadi yang bergerak di gudang.
          </p>
        </div>
        <button
          onClick={() => setShow(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white"
        >
          <Plus size={16} /> Produk Baru
        </button>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Nama</th>
                <th className="px-5 py-3 font-medium">Jenis</th>
                <th className="px-5 py-3 font-medium">Satuan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-neutral-100">
                  <td className="px-5 py-4 font-mono text-xs text-neutral-500">{p.sku}</td>
                  <td className="px-5 py-4 font-medium">{p.name}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium">
                      {p.product_type}
                    </span>
                  </td>
                  <td className="px-5 py-4">{p.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {show && (
        <ProductModal
          close={() => setShow(false)}
          onSaved={(p) => {
            setRows((v) => [p, ...v])
            setShow(false)
          }}
        />
      )}
    </div>
  )
}
function ProductModal({ close, onSaved }: { close: () => void; onSaved: (p: Product) => void }) {
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('Kg')
  const [type, setType] = useState('RAW_MATERIAL')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!sku || !name || !supabase) return
    setSaving(true)
    const { data, error: e } = await supabase
      .from('products')
      .insert({ sku, name, unit, product_type: type })
      .select()
      .single()
    if (e) setError(e.message)
    else if (data) onSaved(data as Product)
    setSaving(false)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 p-5">
          <div>
            <h2 className="font-semibold">Produk Baru</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Produk menjadi dasar semua transaksi stok.
            </p>
          </div>
          <button onClick={close} className="rounded-lg p-2 hover:bg-neutral-100">
            <X size={17} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <Field label="SKU">
            <input
              className="field"
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Nama">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jenis">
              <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="RAW_MATERIAL">Bahan Baku</option>
                <option value="WIP">WIP</option>
                <option value="FINISHED_GOOD">Produk Jadi</option>
                <option value="PACKAGING">Packaging</option>
              </select>
            </Field>
            <Field label="Satuan">
              <input className="field" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </Field>
          </div>
          {error && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</div>}
        </div>
        <div className="flex gap-2 border-t border-neutral-100 p-5">
          <button
            onClick={close}
            className="flex-1 rounded-xl border border-neutral-200 py-2.5 text-sm"
          >
            Batal
          </button>
          <button
            disabled={saving}
            onClick={save}
            className="flex-1 rounded-xl bg-neutral-950 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? 'Menyimpan...' : 'Simpan Produk'}
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
