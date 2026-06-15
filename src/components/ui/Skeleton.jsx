import { cn } from './cn'

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse bg-bg-muted rounded', className)} />
}
