import { describe, expect, it } from 'vitest'
import { frameDurations, frameTimes, optimizationLadder, optimizeToLimit, posterize, type EncodeParams } from '../src/lib/export/optimizer'
import { SAFETY_RATIO, WA_LIMITS } from '../src/lib/export/limits'

describe('optimizador', () => {
  it('la escalera empieza con los parámetros pedidos y nunca sube calidad ni FPS', () => {
    const start = { quality: 85, fps: 24, colors: 0 }
    const ladder = optimizationLadder(start, true)
    expect(ladder[0]).toEqual({ ...start, scale: 1 })
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i].quality).toBeLessThanOrEqual(ladder[i - 1].quality)
      expect(ladder[i].fps).toBeLessThanOrEqual(ladder[i - 1].fps)
      expect(ladder[i].scale ?? 1).toBeLessThanOrEqual(ladder[i - 1].scale ?? 1)
      expect(ladder[i].fps).toBeGreaterThanOrEqual(4)
    }
    // Los FPS de emergencia (< 8) solo aparecen al final, tras agotar el resto
    const firstLow = ladder.findIndex((l) => l.fps < WA_LIMITS.minFps)
    expect(ladder.slice(0, firstLow).some((l) => l.quality === 10)).toBe(true)
    expect(ladder.at(-1)!.colors).toBeGreaterThan(0)
  })

  it('en estáticos no toca los FPS', () => {
    const ladder = optimizationLadder({ quality: 80, fps: 15, colors: 0 }, false)
    expect(new Set(ladder.map((l) => l.fps))).toEqual(new Set([15]))
  })

  it('para en cuanto cumple el límite', async () => {
    // Codificador simulado: el tamaño depende de calidad × fps
    const fake = async (p: EncodeParams) => new Uint8Array(p.quality * p.fps * 300)
    const res = await optimizeToLimit(fake, { quality: 80, fps: 24, colors: 0 }, true, WA_LIMITS.animatedMaxBytes)
    expect(res.withinLimit).toBe(true)
    expect(res.data.length).toBeLessThanOrEqual(WA_LIMITS.animatedMaxBytes * SAFETY_RATIO)
    expect(res.attempts.length).toBeGreaterThan(1)
    // El primer intento no cumplía
    expect(res.attempts[0].bytes).toBeGreaterThan(WA_LIMITS.animatedMaxBytes)
  })

  it('devuelve el mejor intento si nada cumple', async () => {
    const fake = async () => new Uint8Array(WA_LIMITS.staticMaxBytes * 2)
    const res = await optimizeToLimit(fake, { quality: 80, fps: 1, colors: 0 }, false, WA_LIMITS.staticMaxBytes)
    expect(res.withinLimit).toBe(false)
  })

  it('posteriza a N niveles', () => {
    const d = new Uint8ClampedArray([10, 100, 200, 255, 130, 129, 1, 255])
    posterize(d, 2)
    expect([...d]).toEqual([0, 0, 255, 255, 255, 255, 0, 255])
  })

  it('reparte duraciones exactas sin pasar de 10 s', () => {
    const d = frameDurations(30, 2000)
    expect(d.reduce((a, b) => a + b, 0)).toBe(2000)
    expect(Math.min(...d)).toBeGreaterThanOrEqual(8)
    const long = frameDurations(100, 15000)
    expect(long.reduce((a, b) => a + b, 0)).toBe(10000)
    expect(frameTimes(12, 30).length).toBe(300)
  })
})
