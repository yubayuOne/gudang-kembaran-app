import { createFileRoute } from '@tanstack/react-router'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
export const Route = createFileRoute('/movements')({ component: Movements })
const demo = [
  {
    id: '1',
    movement_date: '2026-09-22T14:00:00Z',
    product_name: 'Espresso Blend',
    sku: 'ESP-001',
    unit: 'Kg',
    movement_type: 'PRODUCTION_OUTPUT',
    quantity: 12,
    batch_number: 'PRD-260922-001',
    notes: 'Hasil produksi',
  },
  {
    id: '2',
    movement_date: '2026-09-22T13:55:00Z',
    product_name: 'Green Bean Arabica Gayo',
    sku: 'GB-ARA',
    unit: 'Kg',
    movement_type: 'PRODUCTION_USE',
    quantity: -8,
    batch_number: 'PRD-260922-001',
    notes: 'Pemakaian produksi',
  },
  {
    id: '3',
    movement_date: '2026-09-22T09:00:00Z',
    product_name: 'Green Bean Arabica Gayo',
    sku: 'GB-ARA',
    unit: 'Kg',
    movement_type: 'IN',
    quantity: 20,
    batch_number: null,
    notes: 'Pembelian',
  },
]
function Movements() {
  const [rows, setRows] = useState<any[]>(demo)
  useEffect(() => {
    if (!supabase) return
    ;(async () => {
      const { data, error } = await supabase
        .from('stock_ledger')
        .select('*')
        .order('movement_date', { ascending: false })
        .limit(200)
      if (!error && data) setRows(data)
    })()
  }, [])
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[.16em] text-neutral-500">Ledger</p>
        <h1 className="mt-1 text-2xl font-semibold">Mutasi Stok</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Jejak lengkap setiap stok masuk, dipakai, diproduksi, dan keluar.
        </p>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Tanggal</th>
                <th className="px-5 py-3 font-medium">Produk</th>
                <th className="px-5 py-3 font-medium">Tipe</th>
                <th className="px-5 py-3 font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Batch</th>
                <th className="px-5 py-3 font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const positive = Number(r.quantity) > 0
                return (
                  <tr key={r.id} className="border-t border-neutral-100">
                    <td className="px-5 py-4 text-xs text-neutral-500">
                      {new Date(r.movement_date).toLocaleString('id-ID')}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium">{r.product_name}</p>
                      <p className="text-[11px] text-neutral-400">{r.sku}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium">
                        {r.movement_type}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-4 font-semibold ${positive ? 'text-emerald-700' : 'text-red-700'}`}
                    >
                      {positive ? '+' : ''}
                      {r.quantity} {r.unit}
                    </td>
                    <td className="px-5 py-4 text-xs text-neutral-500">{r.batch_number ?? '—'}</td>
                    <td className="px-5 py-4 text-neutral-600">{r.notes ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
