import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '@lib/format'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', icon, children, className, ...rest }: ButtonProps) {
  const variants = {
    primary:   'bg-ink text-paper hover:opacity-90',
    secondary: 'bg-panel text-ink border border-paperEdge hover:border-inkFaint',
    ghost:     'bg-transparent text-ink hover:bg-paperDeep',
    danger:    'bg-danger text-paper hover:opacity-90',
  } as const
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-sm',
  } as const
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant], sizes[size], className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}
