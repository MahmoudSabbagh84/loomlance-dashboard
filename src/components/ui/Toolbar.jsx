import { cn } from './cn'

export function Toolbar({ children, className }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}
