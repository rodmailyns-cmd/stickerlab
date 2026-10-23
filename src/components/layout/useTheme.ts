import { useEffect } from 'react'
import { useUi } from '@/store/ui'

export function useTheme() {
  const theme = useUi((s) => s.theme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#15111f' : '#ff7eb6')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}
