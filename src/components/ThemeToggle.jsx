import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('mes-comptes-theme') === 'light' ? 'light' : 'dark' }
    catch { return 'dark' }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try { localStorage.setItem('mes-comptes-theme', theme) } catch { /* Session-only preference if storage is blocked. */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f8fafc' : '#030712')
  }, [theme])
  return <button className="rounded-lg p-2 bg-card text-foreground" aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
    onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}>
    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
  </button>
}
