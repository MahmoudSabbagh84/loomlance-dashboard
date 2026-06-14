import { cn } from './cn'

export function Label({ className, children, htmlFor, required }) {
  return (
    <label htmlFor={htmlFor} className={cn('block text-sm font-medium text-fg mb-1', className)}>
      {children}
      {required ? <span className="text-danger ml-0.5">*</span> : null}
    </label>
  )
}
