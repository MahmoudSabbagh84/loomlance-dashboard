import { Component } from 'react'
import { Button } from '@/components/ui/Button'
import { logError } from '@/lib/logError'

// Catches render-time errors anywhere below it and shows a calm fallback instead of a
// white screen, logging the error to error_logs. Wrap the app (and optionally subtrees).
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    logError(error, {
      boundary: this.props.name || 'app',
      componentStack: info?.componentStack ? String(info.componentStack).slice(0, 4000) : null,
    })
  }

  handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <div className="grid min-h-screen place-items-center bg-bg px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-fg">Something went wrong</h1>
          <p className="mt-2 text-sm text-fg-muted">
            An unexpected error interrupted the page. Reloading usually fixes it — if it keeps happening, get in touch and we will sort it out.
          </p>
          <Button className="mt-5" onClick={this.handleReload}>Reload</Button>
        </div>
      </div>
    )
  }
}
