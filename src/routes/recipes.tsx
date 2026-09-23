import { createFileRoute } from '@tanstack/react-router'
import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
export const Route = createFileRoute('/recipes')({ component: Recipes })
type Product = { id: string; sku: string; name: string; unit: string; product_type: string }
type Recipe = {
  id: string
  product_id: string
  name: string
  version: number
  output_quantity: number
  output_unit: string
  items: any[]
}
function Recipes() {
  const [products, setProducts] = useState<Product[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [show, setShow] = useState(false)
  const load = async () => {
    if (!supabase) return
    const [p, r, ri] = await Promise.all([
      supabase
        .from('products')
        .select('id,sku,name,unit,product_type')
        .eq('is_active', true)
        .order('name'),
      supabase.from('recipes').select('*').eq('is_active', true).order('name'),
      supabase
        .from('recipe_items')
        .select(
          'id,recipe_id,material_id,quantity,unit,material:products!recipe_items_material_id_fkey(id,name,sku,unit)',
        ),
    ])
    if (p.data) setProducts(p.data as Product[])
    if (r.data)
      setRecipes(
        r.data.map((x) => ({
          ...x,
          output_quantity: Number(x.output_quantity),
          items: (ri.data ?? []).filter((i: any) => i.recipe_id === x.id),
        })) as Recipe[],
      )
  }
  useEffect(() => {
    load()
  }, [])
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[.16em] text-neutral-500">Production Formula</p>
          <h1 className="mt-1 text-2xl font-semibold">Recipe / BOM</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Definisi bahan yang digunakan untuk menghasilkan satu produk.
          </p>
        </div>
        <button
          onClick={() => setShow(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white"
        >
          <Plus size={16} /> Recipe Baru
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {recipes.map((r) => (
          <div key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">
                  {products.find((p) => p.id === r.product_id)?.name ?? 'Produk'}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {r.name} · v{r.version} · output {r.output_quantity} {r.output_unit}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {r.items.map((i) => (
                <div
                  key={i.id}
                  className="flex justify-between rounded-xl bg-neutral-50 px-3 py-2 text-sm"
                >
                  <span>{i.material?.name ?? 'Bahan'}</span>
                  <span className="font-medium">
                    {i.quantity} {i.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!recipes.length && (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 md:col-span-2">
            Belum ada recipe aktif.
          </div>
        )}
      </div>
      {show && (
        <RecipeModal
          products={products}
          close={() => setShow(false)}
          saved={() => {
            setShow(false)
            load()
          }}
        />
      )}
    </div>
  )
}
function RecipeModal({
  products,
  close,
  saved,
}: {
  products: Product[]
  close: () => void
  saved: () => void
}) {
  const finished = products.filter((p) => p.product_type === 'FINISHED_GOOD')
  const materials = products.filter((p) => p.product_type !== 'FINISHED_GOOD')
  const [productId, setProductId] = useState(finished[0]?.id ?? '')
  const [name, setName] = useState('')
  const [output, setOutput] = useState('1')
  const [items, setItems] = useState([
    { material_id: materials[0]?.id ?? '', quantity: '', unit: materials[0]?.unit ?? 'Kg' },
  ])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  function update(i: number, key: string, value: string) {
    setItems((v) => v.map((x, n) => (n === i ? { ...x, [key]: value } : x)))
  }
  async function save() {
    if (
      !supabase ||
      !productId ||
      !name ||
      Number(output) <= 0 ||
      items.some((i) => !i.material_id || Number(i.quantity) <= 0)
    ) {
      setError('Lengkapi produk, nama recipe, output, dan semua bahan.')
      return
    }
    setSaving(true)
    const { data, error: e } = await supabase
      .from('recipes')
      .insert({
        product_id: productId,
        name,
        version: 1,
        output_quantity: Number(output),
        output_unit: products.find((p) => p.id === productId)?.unit ?? 'Kg',
      })
      .select()
      .single()
    if (e || !data) {
      setError(e?.message ?? 'Gagal menyimpan recipe.')
      setSaving(false)
      return
    }
    const { error: ie } = await supabase.from('recipe_items').insert(
      items.map((i) => ({
        recipe_id: data.id,
        material_id: i.material_id,
        quantity: Number(i.quantity),
        unit: i.unit,
      })),
    )
    if (ie) {
      setError(ie.message)
      setSaving(false)
      return
    }
    saved()
    setSaving(false)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 p-5">
          <div>
            <h2 className="font-semibold">Recipe Baru</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Recipe dipakai otomatis saat membuat batch.
            </p>
          </div>
          <button onClick={close} className="rounded-lg p-2 hover:bg-neutral-100">
            <X size={17} />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Produk hasil">
              <select
                className="field"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {finished.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nama Recipe">
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Espresso Blend"
              />
            </Field>
          </div>
          <Field label="Output per recipe">
            <input
              className="field"
              value={output}
              onChange={(e) => setOutput(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </Field>
          <div className="rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="flex items-center justify-between bg-neutral-50 px-4 py-3">
              <span className="text-xs font-semibold">Bahan</span>
              <button
                onClick={() =>
                  setItems((v) => [
                    ...v,
                    {
                      material_id: materials[0]?.id ?? '',
                      quantity: '',
                      unit: materials[0]?.unit ?? 'Kg',
                    },
                  ])
                }
                className="text-xs font-medium"
              >
                + Tambah bahan
              </button>
            </div>
            {items.map((i, n) => (
              <div
                key={n}
                className="grid grid-cols-[1fr_110px_70px] gap-2 border-t border-neutral-100 p-3"
              >
                <select
                  className="field"
                  value={i.material_id}
                  onChange={(e) => update(n, 'material_id', e.target.value)}
                >
                  {materials.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  className="field"
                  value={i.quantity}
                  onChange={(e) => update(n, 'quantity', e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="Qty"
                />
                <input
                  className="field"
                  value={i.unit}
                  onChange={(e) => update(n, 'unit', e.target.value)}
                />
              </div>
            ))}
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
            {saving ? 'Menyimpan...' : 'Simpan Recipe'}
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
