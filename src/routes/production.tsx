import { createFileRoute } from '@tanstack/react-router'
import { Check, ChevronRight, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { supabase } from '@/lib/supabase'
import {
  calculateRequirements,
  formatQty,
  type Product,
  type Recipe,
  type Stock,
} from '@/lib/production'

export const Route = createFileRoute('/production')({
  component: Production,
})

type Batch = {
  id: string
  batch_number: string
  product_id: string
  output_quantity: number
  status: string
  started_at: string | null
  completed_at: string | null
  created_at: string
  product?: {
    id: string
    name: string
    unit: string
  }
}

const demoProducts: Product[] = [
  {
    id: 'p-e',
    sku: 'ESP-001',
    name: 'Espresso Blend',
    unit: 'Kg',
    product_type: 'FINISHED_GOOD',
  },
  {
    id: 'p-p',
    sku: 'KBP-001',
    name: 'Kopi Bubuk Premium',
    unit: 'Kg',
    product_type: 'FINISHED_GOOD',
  },
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
]

const demoRecipes: Recipe[] = [
  {
    id: 'r-e',
    product_id: 'p-e',
    name: 'Espresso Blend',
    version: 1,
    output_quantity: 1,
    output_unit: 'Kg',
    items: [
      {
        id: 'ri-a',
        material_id: 'p-a',
        quantity: 0.7,
        unit: 'Kg',
        material: demoProducts[2],
      },
      {
        id: 'ri-r',
        material_id: 'p-r',
        quantity: 0.3,
        unit: 'Kg',
        material: demoProducts[3],
      },
    ],
  },
]

const demoStock: Stock[] = [
  {
    product_id: 'p-a',
    quantity: 55,
  },
  {
    product_id: 'p-r',
    quantity: 30,
  },
  {
    product_id: 'p-e',
    quantity: 12,
  },
]

function Production() {
  const [products, setProducts] = useState<Product[]>(demoProducts)
  const [recipes, setRecipes] = useState<Recipe[]>(demoRecipes)
  const [stock, setStock] = useState<Stock[]>(demoStock)
  const [batches, setBatches] = useState<Batch[]>([])

  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  async function loadData() {
    if (!supabase) return

    setLoading(true)
    setLoadError('')

    try {
      /*
       * PRODUCTS
       */
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id,sku,name,unit,product_type')
        .eq('is_active', true)

      if (productError) {
        throw new Error(`Gagal mengambil produk: ${productError.message}`)
      }

      /*
       * RECIPES
       */
      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes')
        .select('id,product_id,name,version,output_quantity,output_unit')
        .eq('is_active', true)

      if (recipeError) {
        throw new Error(`Gagal mengambil recipe: ${recipeError.message}`)
      }

      /*
       * RECIPE ITEMS
       */
      const { data: recipeItemData, error: recipeItemError } = await supabase
        .from('recipe_items')
        .select(
          `
            id,
            recipe_id,
            material_id,
            quantity,
            unit,
            material:products!recipe_items_material_id_fkey(
              id,
              sku,
              name,
              unit,
              product_type
            )
          `,
        )

      if (recipeItemError) {
        throw new Error(`Gagal mengambil bahan recipe: ${recipeItemError.message}`)
      }

      /*
       * STOCK BALANCE
       */
      const { data: stockData, error: stockError } = await supabase
        .from('stock_balances')
        .select('product_id,quantity')

      if (stockError) {
        throw new Error(`Gagal mengambil stok: ${stockError.message}`)
      }

      /*
       * PRODUCTION BATCHES
       *
       * Jangan menggunakan:
       * - actual_output
       * - unit
       * - production_date
       *
       * karena kolom tersebut tidak ada pada schema aktual.
       */
      const { data: batchData, error: batchError } = await supabase
        .from('production_batches')
        .select(
          `
            id,
            batch_number,
            product_id,
            output_quantity,
            status,
            started_at,
            completed_at,
            created_at
          `,
        )
        .order('created_at', {
          ascending: false,
        })
        .limit(30)

      if (batchError) {
        throw new Error(`Gagal mengambil batch produksi: ${batchError.message}`)
      }

      /*
       * PRODUCTS
       */
      if (productData?.length) {
        setProducts(productData as Product[])
      }

      /*
       * STOCK
       */
      if (stockData) {
        setStock(
          stockData.map((item) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity ?? 0),
          })),
        )
      }

      /*
       * RECIPES
       */
      if (recipeData) {
        const mappedRecipes: Recipe[] = recipeData.map((recipe) => ({
          id: recipe.id,
          product_id: recipe.product_id,
          name: recipe.name,
          version: Number(recipe.version),
          output_quantity: Number(recipe.output_quantity ?? 0),
          output_unit: recipe.output_unit,
          items: (recipeItemData ?? [])
            .filter((item: any) => item.recipe_id === recipe.id)
            .map((item: any) => ({
              id: item.id,
              material_id: item.material_id,
              quantity: Number(item.quantity ?? 0),
              unit: item.unit,
              material: item.material,
            })),
        }))

        setRecipes(mappedRecipes)
      }

      /*
       * BATCHES
       *
       * Product tidak di-join langsung.
       * Kita map berdasarkan product_id dari data products.
       * Ini lebih aman karena tidak bergantung pada
       * nama foreign key relationship di Supabase.
       */
      const productMap = new Map<string, Product>(
        (productData ?? []).map((product) => [product.id, product as Product]),
      )

      const mappedBatches: Batch[] = (batchData ?? []).map((batch: any) => {
        const product = productMap.get(batch.product_id)

        return {
          id: batch.id,
          batch_number: batch.batch_number,
          product_id: batch.product_id,
          output_quantity: Number(batch.output_quantity ?? 0),
          status: batch.status,
          started_at: batch.started_at,
          completed_at: batch.completed_at,
          created_at: batch.created_at,
          product: product
            ? {
                id: product.id,
                name: product.name,
                unit: product.unit,
              }
            : undefined,
        }
      })

      setBatches(mappedBatches)
    } catch (error) {
      console.error('Production load error:', error)

      setLoadError(error instanceof Error ? error.message : 'Gagal mengambil data produksi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[.16em] text-neutral-500">Production</p>

          <h1 className="mt-1 text-2xl font-semibold">Produksi</h1>

          <p className="mt-1 text-sm text-neutral-500">
            Satu batch mencatat bahan yang dipakai dan produk yang dihasilkan.
          </p>
        </div>

        <button
          onClick={() => setShow(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white"
        >
          <Plus size={16} />
          Batch Produksi
        </button>
      </div>

      {/* ERROR */}
      {loadError && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
      )}

      {/* SUMMARY */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Mini label="Batch tercatat" value={batches.length} />

        <Mini
          label="Produk jadi"
          value={products.filter((product) => product.product_type === 'FINISHED_GOOD').length}
        />

        <Mini label="Prinsip" value="Input → Output" />
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Batch</th>

                <th className="px-5 py-3 font-medium">Produk</th>

                <th className="px-5 py-3 font-medium">Output</th>

                <th className="px-5 py-3 font-medium">Tanggal</th>

                <th className="px-5 py-3 font-medium">Status</th>

                <th />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-neutral-500">
                    Memuat batch produksi...
                  </td>
                </tr>
              ) : batches.length ? (
                batches.map((batch) => (
                  <tr key={batch.id} className="border-t border-neutral-100">
                    <td className="px-5 py-4 font-medium">{batch.batch_number}</td>

                    <td className="px-5 py-4">{batch.product?.name ?? '—'}</td>

                    <td className="px-5 py-4">
                      {formatQty(batch.output_quantity, batch.product?.unit ?? '')}{' '}
                      {batch.product?.unit ?? ''}
                    </td>

                    <td className="px-5 py-4 text-xs text-neutral-500">
                      {formatDate(batch.completed_at ?? batch.created_at)}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                        {batch.status}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <ChevronRight size={16} className="text-neutral-400" />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-neutral-500">
                    Belum ada batch produksi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {show && (
        <ProductionModal
          products={products}
          recipes={recipes}
          stock={stock}
          close={() => setShow(false)}
          refresh={loadData}
        />
      )}
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-xs text-neutral-500">{label}</p>

      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function ProductionModal({
  products,
  recipes,
  stock,
  close,
  refresh,
}: {
  products: Product[]
  recipes: Recipe[]
  stock: Stock[]
  close: () => void
  refresh: () => void | Promise<void>
}) {
  const finished = products.filter((product) => product.product_type === 'FINISHED_GOOD')

  const [productId, setProductId] = useState(finished[0]?.id ?? '')

  const [recipeId, setRecipeId] = useState('')

  const [output, setOutput] = useState('')

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const [actuals, setActuals] = useState<Record<string, string>>({})

  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')

  const product = products.find((item) => item.id === productId)

  const productRecipes = useMemo(
    () => recipes.filter((recipe) => recipe.product_id === productId),
    [recipes, productId],
  )

  useEffect(() => {
    setRecipeId(productRecipes[0]?.id ?? '')
  }, [productId, productRecipes.length])

  const recipe = productRecipes.find((item) => item.id === recipeId) ?? productRecipes[0]

  const target = Number(output)

  const req = calculateRequirements(recipe, target, stock)

  useEffect(() => {
    if (!recipe) {
      setActuals({})
      return
    }

    setActuals(
      Object.fromEntries(
        recipe.items.map((item) => [
          item.material_id,
          String(item.quantity * (target / (recipe.output_quantity || 1))),
        ]),
      ),
    )
  }, [recipeId, target])

  const shortage = req.some(
    (item) => Number(actuals[item.material_id] ?? item.required) > item.available,
  )

  async function save() {
    if (!supabase || !product || !recipe || !target || shortage) {
      return
    }

    setSaving(true)
    setError('')

    const items = recipe.items.map((item) => ({
      material_id: item.material_id,
      planned_quantity: item.quantity * (target / recipe.output_quantity),

      actual_quantity: Number(actuals[item.material_id] ?? 0),

      unit: item.unit,
    }))

    if (items.some((item) => item.actual_quantity <= 0)) {
      setError('Semua bahan harus memiliki qty aktual.')

      setSaving(false)

      return
    }

    const batchNumber = `PRD-${date.replaceAll('-', '')}-${String(Date.now()).slice(-4)}`

    const { error: saveError } = await supabase.rpc('create_production_batch', {
      p_batch_number: batchNumber,
      p_product_id: product.id,
      p_planned_output: target,
      p_actual_output: target,
      p_unit: product.unit,
      p_production_date: date,
      p_items: items,
      p_notes: notes || null,
    })

    if (saveError) {
      console.error('Create production batch error:', saveError)

      setError(saveError.message)

      setSaving(false)

      return
    }

    await refresh()

    close()

    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* MODAL HEADER */}
        <div className="flex items-start justify-between border-b border-neutral-100 p-5">
          <div>
            <h2 className="font-semibold">Catat Batch Produksi</h2>

            <p className="mt-1 text-xs text-neutral-500">
              Stok bahan berkurang dan produk hasil bertambah otomatis.
            </p>
          </div>

          <button onClick={close} className="rounded-lg p-2 hover:bg-neutral-100">
            <X size={17} />
          </button>
        </div>

        {/* MODAL CONTENT */}
        <div className="space-y-4 overflow-y-auto p-5">
          {/* PRODUCT + RECIPE */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Produk">
              <select
                className="field"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
              >
                {finished.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Recipe">
              <select
                className="field"
                value={recipe?.id ?? ''}
                onChange={(event) => setRecipeId(event.target.value)}
              >
                {productRecipes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · v{item.version}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* OUTPUT + DATE */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Output aktual">
              <div className="flex">
                <input
                  className="field rounded-r-none"
                  value={output}
                  onChange={(event) => setOutput(event.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  inputMode="decimal"
                />

                <span className="flex items-center rounded-r-xl border border-l-0 border-neutral-200 px-3 text-sm text-neutral-500">
                  {product?.unit ?? 'Kg'}
                </span>
              </div>
            </Field>

            <Field label="Tanggal">
              <input
                className="field"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
          </div>

          {/* MATERIALS */}
          {recipe && target > 0 && (
            <div className="overflow-hidden rounded-2xl border border-neutral-200">
              <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
                <p className="text-xs font-semibold">Bahan yang digunakan</p>

                <p className="mt-1 text-[11px] text-neutral-500">
                  Angka aktual yang disimpan menjadi jejak produksi.
                </p>
              </div>

              {recipe.items.map((item) => {
                const requirement = req.find((value) => value.material_id === item.material_id)

                const value = actuals[item.material_id] ?? ''

                const low = Number(value) > Number(requirement?.available ?? 0)

                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_130px_auto] items-center gap-3 border-t border-neutral-100 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.material.name}</p>

                      <p className="text-[11px] text-neutral-500">
                        Rencana {formatQty(requirement?.required ?? 0, item.unit)} · tersedia{' '}
                        {formatQty(requirement?.available ?? 0, item.unit)}
                      </p>
                    </div>

                    <input
                      className={`field ${low ? 'border-red-300' : ''}`}
                      value={value}
                      onChange={(event) =>
                        setActuals((current) => ({
                          ...current,
                          [item.material_id]: event.target.value.replace(/[^0-9.]/g, ''),
                        }))
                      }
                      inputMode="decimal"
                    />

                    <span className="text-xs text-neutral-500">{item.unit}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* SHORTAGE */}
          {shortage && (
            <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
              Qty bahan aktual melebihi stok tersedia. Batch tidak dapat disimpan.
            </div>
          )}

          {/* NOTES */}
          <Field label="Catatan">
            <textarea
              className="field min-h-20 resize-none"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Opsional"
            />
          </Field>

          {/* ERROR */}
          {error && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</div>}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex gap-2 border-t border-neutral-100 p-5">
          <button
            onClick={close}
            className="flex-1 rounded-xl border border-neutral-200 py-2.5 text-sm font-medium"
          >
            Batal
          </button>

          <button
            onClick={save}
            disabled={saving || !recipe || target <= 0 || shortage}
            className="flex-1 rounded-xl bg-neutral-950 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            <Check size={15} className="mr-2 inline" />

            {saving ? 'Menyimpan...' : 'Simpan Batch'}
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

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
