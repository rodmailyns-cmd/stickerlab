import { create } from 'zustand'
import { allPacks, allStickers, deletePack, deleteSticker, putPack, putSticker, type PackRecord, type StickerRecord } from '@/lib/storage/db'

interface LibraryState {
  stickers: StickerRecord[]
  packs: PackRecord[]
  loaded: boolean
  refresh: () => Promise<void>
  saveSticker: (s: StickerRecord) => Promise<void>
  removeSticker: (id: string) => Promise<void>
  savePack: (p: PackRecord) => Promise<void>
  removePack: (id: string) => Promise<void>
}

export const useLibrary = create<LibraryState>()((set, get) => ({
  stickers: [],
  packs: [],
  loaded: false,
  refresh: async () => {
    const [stickers, packs] = await Promise.all([allStickers(), allPacks()])
    set({ stickers, packs, loaded: true })
  },
  saveSticker: async (s) => {
    await putSticker(s)
    const others = get().stickers.filter((x) => x.id !== s.id)
    set({ stickers: [s, ...others].sort((a, b) => b.updatedAt - a.updatedAt) })
  },
  removeSticker: async (id) => {
    await deleteSticker(id)
    // Quita el sticker de los packs que lo usan
    const packs = get().packs.map((p) => (p.items.some((i) => i.stickerId === id) ? { ...p, items: p.items.filter((i) => i.stickerId !== id), updatedAt: Date.now() } : p))
    await Promise.all(packs.filter((p, i) => p !== get().packs[i]).map(putPack))
    set({ stickers: get().stickers.filter((x) => x.id !== id), packs })
  },
  savePack: async (p) => {
    await putPack(p)
    const others = get().packs.filter((x) => x.id !== p.id)
    set({ packs: [p, ...others].sort((a, b) => b.updatedAt - a.updatedAt) })
  },
  removePack: async (id) => {
    await deletePack(id)
    set({ packs: get().packs.filter((x) => x.id !== id) })
  },
}))
