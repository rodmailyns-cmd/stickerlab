import { App } from '@capacitor/app'
import { useEffect, useRef } from 'react'
import { isNative } from './platform'

/**
 * Botón "atrás" de Android: una pila de manejadores. Gana el último registrado
 * (el modal abierto, luego la hoja inferior, luego la pantalla…).
 */
const stack: { id: number; fn: () => void }[] = []
let seq = 0
let fallback: () => void = () => void App.minimizeApp()

export function setBackFallback(fn: () => void) {
  fallback = fn
}

/** Ejecuta la acción de "atrás" (también útil para probarla desde la web). */
export function goBack() {
  const top = stack[stack.length - 1]
  if (top) top.fn()
  else fallback()
}

if (isNative) void App.addListener('backButton', goBack)

/** Mientras `active` sea true, el botón atrás llama a `fn`. */
export function useBackHandler(active: boolean, fn: () => void) {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  useEffect(() => {
    if (!active) return
    const entry = { id: ++seq, fn: () => ref.current() }
    stack.push(entry)
    return () => {
      const i = stack.findIndex((e) => e.id === entry.id)
      if (i >= 0) stack.splice(i, 1)
    }
  }, [active])
}
