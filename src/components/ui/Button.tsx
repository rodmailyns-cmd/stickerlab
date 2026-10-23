import { motion, type HTMLMotionProps } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { forwardRef, type ReactNode } from 'react'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  iconRight?: LucideIcon
  loading?: boolean
  children?: ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'text-white bg-accent hover:brightness-105 disabled:opacity-50',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2 disabled:opacity-50',
  soft: 'bg-accent-soft text-accent-text hover:brightness-[0.97] disabled:opacity-50',
  ghost: 'bg-transparent text-ink hover:bg-surface-3 disabled:opacity-40',
  danger: 'bg-danger text-white hover:brightness-105 disabled:opacity-50',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-2xl',
  lg: 'h-13 px-6 text-base gap-2.5 rounded-2xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      className={cn(
        'inline-flex items-center justify-center font-bold whitespace-nowrap transition-[background,border,filter,opacity] select-none cursor-pointer disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
      ) : (
        Icon && <Icon className={size === 'sm' ? 'size-4' : 'size-5'} aria-hidden strokeWidth={2.4} />
      )}
      {children}
      {IconRight && <IconRight className="size-4" aria-hidden strokeWidth={2.4} />}
    </motion.button>
  )
})

export interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  icon: LucideIcon
  label: string
  active?: boolean
  size?: 'sm' | 'md'
  variant?: 'ghost' | 'surface'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, active, size = 'md', variant = 'ghost', className, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.9 }}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center justify-center rounded-xl transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed',
        size === 'sm' ? 'size-8' : 'size-10',
        variant === 'surface' ? 'bg-surface border border-line' : 'hover:bg-surface-3',
        active && 'bg-accent-soft text-accent-text hover:bg-accent-soft',
        className,
      )}
      {...rest}
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-5'} strokeWidth={2.3} aria-hidden />
    </motion.button>
  )
})
