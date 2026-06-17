import { cn } from './cn'

const PAD = { sm: 'p-3', md: 'p-4', lg: 'p-5' }

export function Card({ children, className, padding = 'md', as: Tag = 'div', ...rest }) {
  return (
    <Tag className={cn('rounded-lg border border-border bg-bg-elevated', PAD[padding], className)} {...rest}>
      {children}
    </Tag>
  )
}
