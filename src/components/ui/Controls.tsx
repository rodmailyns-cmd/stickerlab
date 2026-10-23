import { motion } from 'framer-motion'
import { useId, type ReactNode } from 'react'
import { cn } from './cn'

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  className,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  className?: string
}) {
  const id = useId()
  const fill = ((value - min) / (max - min)) * 100
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-semibold text-muted">
          {label}
        </label>
        <span className="tabular-nums font-bold text-ink text-xs bg-surface-3 rounded-lg px-2 py-0.5">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        className="sl-range w-full"
        style={{ ['--fill' as string]: `${fill}%` }}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl py-1.5 text-left cursor-pointer"
    >
      <span className="flex flex-col">
        <span className="text-sm font-bold">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
      <span className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-gradient-to-r from-accent to-accent-2' : 'bg-surface-3')}>
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-1 size-5 rounded-full bg-white shadow"
          style={{ left: checked ? 24 : 4 }}
        />
      </span>
    </button>
  )
}

export const PALETTE = ['#ffffff', '#2b2d42', '#ff5d8f', '#ff8fab', '#ffb3c6', '#ff6b6b', '#ffa94d', '#ffd43b', '#c0eb75', '#51cf66', '#38d9a9', '#66d9e8', '#4dabf7', '#748ffc', '#9775fa', '#da77f2', '#000000']

export function ColorField({ label, value, onChange, allowNone }: { label: string; value: string; onChange: (v: string) => void; allowNone?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {allowNone && (
          <button
            type="button"
            aria-label="Sin color"
            title="Sin color"
            onClick={() => onChange('transparent')}
            className={cn('size-7 rounded-full border-2 checker cursor-pointer', value === 'transparent' ? 'border-accent ring-2 ring-accent/40' : 'border-line')}
          />
        )}
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            title={c}
            onClick={() => onChange(c)}
            className={cn(
              'size-7 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer',
              value.toLowerCase() === c ? 'border-accent ring-2 ring-accent/40 scale-110' : 'border-line',
            )}
            style={{ background: c }}
          />
        ))}
        <label className="relative size-7 cursor-pointer rounded-full overflow-hidden border-2 border-line" title="Elegir otro color">
          <span className="absolute inset-0" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} />
          <input
            type="color"
            aria-label={`${label}: color personalizado`}
            className="sl-color absolute inset-0 opacity-0 cursor-pointer"
            value={value.startsWith('#') && value.length === 7 ? value : '#ffffff'}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      </div>
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode; title?: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-2xl bg-surface-3 p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative flex-1 rounded-xl px-2 py-1.5 text-sm font-bold transition-colors cursor-pointer',
            value === o.value ? 'text-ink' : 'text-muted hover:text-ink',
          )}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-xl bg-surface shadow-soft" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
          )}
          <span className="relative flex items-center justify-center gap-1">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[15px] font-semibold tracking-wide text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Chip({ active, children, onClick, title }: { active?: boolean; children: ReactNode; onClick?: () => void; title?: string }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold border-2 transition-colors cursor-pointer whitespace-nowrap',
        active ? 'border-transparent bg-gradient-to-r from-accent to-accent-2 text-white' : 'border-line bg-surface text-ink hover:border-accent/40',
      )}
    >
      {children}
    </motion.button>
  )
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  multiline,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  multiline?: boolean
  className?: string
}) {
  const id = useId()
  const cls =
    'w-full rounded-2xl border-2 border-line bg-surface px-3 py-2 text-[15px] font-semibold text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none transition-colors'
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-muted">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} className={cn(cls, 'min-h-20 resize-y')} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className={cls} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2.5 w-full overflow-hidden rounded-full bg-surface-3', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-accent via-accent-2 to-sky"
        initial={false}
        animate={{ width: `${Math.max(3, value * 100)}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
    </div>
  )
}
