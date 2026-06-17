import { cn } from './cn'

export function Table({ className, children }) {
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border bg-bg', className)}>
      <table className="min-w-full text-sm">{children}</table>
    </div>
  )
}
export function THead({ children }) {
  return <thead className="bg-bg-elevated text-xs uppercase tracking-wider text-fg-muted">{children}</thead>
}
export function TR({ children, className, onClick }) {
  return (
    <tr onClick={onClick} className={cn('border-t border-border transition-colors', onClick && 'cursor-pointer hover:bg-bg-muted', className)}>
      {children}
    </tr>
  )
}
export function TH({ children, className }) {
  return <th className={cn('text-left font-medium px-4 py-2.5', className)}>{children}</th>
}
export function TD({ children, className }) {
  return <td className={cn('px-4 py-2.5', className)}>{children}</td>
}
