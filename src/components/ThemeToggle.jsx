import { useState } from 'react'
import { applyTheme, themePreference } from '../theme'
export default function ThemeToggle() {
  const [theme, setTheme] = useState(themePreference)
  return <div role="group" aria-label="Apparence" className="flex flex-wrap gap-2">
    {[['system','Système'],['light','Clair'],['dark','Sombre']].map(([id,label]) => <button key={id} aria-label={`Activer le mode ${id === 'system' ? 'système' : label.toLowerCase()}`} aria-pressed={theme === id} className={`rounded-xl px-3 py-2 border border-line ${theme === id ? 'bg-field text-positive' : 'bg-card'}`} onClick={() => {
      setTheme(id); try { localStorage.setItem('mes-comptes-theme',id) } catch { /* Session preference */ } applyTheme(id)
    }}>{label}</button>)}
  </div>
}
