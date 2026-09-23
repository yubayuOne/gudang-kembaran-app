import { Link, useRouterState } from '@tanstack/react-router'
import {
  Bell,
  Boxes,
  ClipboardList,
  Factory,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Package,
  Search,
  Settings,
  X,
} from 'lucide-react'
import { useState } from 'react'

const nav = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Produksi', to: '/production', icon: Factory },
  { label: 'Inventory', to: '/inventory', icon: Boxes },
  { label: 'Produk', to: '/products', icon: Package },
  { label: 'Recipe / BOM', to: '/recipes', icon: FlaskConical },
  { label: 'Mutasi Stok', to: '/movements', icon: ClipboardList },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const path = useRouterState({ select: (s) => s.location.pathname })
  return (
    <div className="min-h-screen bg-[#f4f5fb]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[240px] border-r border-neutral-100 bg-white p-4 transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-11 items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-500 text-white shadow-sm shadow-blue-200">
              <Boxes size={18} />
            </div>
            <div>
              <div className="text-[13.5px] font-bold leading-tight tracking-tight text-neutral-900">
                Gudang<span className="text-blue-600">.</span>
              </div>
              <div className="text-[9px] uppercase tracking-[.16em] text-neutral-400">
                Production &amp; Stock
              </div>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 hover:bg-neutral-100 lg:hidden"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-7 space-y-1">
          {nav.map((n) => {
            const I = n.icon
            const active = path === n.to
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                    : 'text-neutral-500 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                <I size={16} />
                {n.label}
              </Link>
            )
          })}
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <button className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-neutral-500 hover:bg-blue-50 hover:text-blue-700">
            <Settings size={16} />
            Pengaturan
          </button>
        </div>
      </aside>
      <div className="lg:pl-[240px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-neutral-100 bg-white/90 px-4 backdrop-blur lg:px-7">
          <button
            onClick={() => setOpen(true)}
            className="rounded-xl border border-neutral-200 p-2 lg:hidden"
          >
            <Menu size={18} />
          </button>
          <div className="hidden items-center gap-2 rounded-full bg-neutral-100 px-4 py-2.5 text-xs text-neutral-400 lg:flex lg:w-[280px]">
            <Search size={14} />
            Cari apa saja...
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button className="hidden rounded-xl border border-neutral-200 p-2 sm:flex sm:items-center">
              <Search size={16} className="text-neutral-500" />
            </button>
            <button className="relative rounded-xl border border-neutral-200 p-2">
              <Bell size={16} className="text-neutral-500" />
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-semibold text-white">
                2
              </span>
            </button>
            <div className="flex items-center gap-2 border-l border-neutral-200 pl-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                GK
              </div>
              <div className="hidden leading-tight sm:block">
                <p className="text-xs font-semibold text-neutral-800">Admin Gudang</p>
                <p className="text-[10px] text-neutral-400">
                  {nav.find((n) => n.to === path)?.label ?? 'Dashboard'}
                </p>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] p-4 pb-24 sm:p-6 lg:p-8">{children}</main>
      </div>
      <nav className="fixed bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-neutral-200 bg-white/95 p-1.5 shadow-lg backdrop-blur lg:hidden">
        {nav.slice(0, 5).map((n) => {
          const I = n.icon
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`rounded-xl p-3 ${path === n.to ? 'bg-blue-600 text-white' : 'text-neutral-500'}`}
            >
              <I size={17} />
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
