/// <reference types="vite/client" />
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import '../styles/app.css'
import { AppShell } from '@/components/app-shell'
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Gudang Kembaran — Production & Stock Tracking' },
    ],
  }),
  component: RootComponent,
})
function RootComponent() {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <AppShell>
          <Outlet />
        </AppShell>
        <Scripts />
      </body>
    </html>
  )
}
