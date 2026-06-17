import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-4 text-center">
      <p className="text-6xl font-semibold tracking-tight text-fg-subtle tabular-nums">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-fg-muted">The page you’re looking for doesn’t exist.</p>
      <Link to="/" className="mt-2 text-sm text-primary hover:underline">Back to dashboard</Link>
    </div>
  )
}
