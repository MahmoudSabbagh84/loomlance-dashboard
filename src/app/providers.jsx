import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/queryClient'

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* offset clears the 64px sticky topbar so toasts don't cover the notification bell */}
      <Toaster richColors position="top-right" offset="76px" />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
