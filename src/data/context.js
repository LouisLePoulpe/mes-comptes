import { createContext, useContext } from 'react'
export const DataContext = createContext(null)
export function useData() {
  const value = useContext(DataContext)
  if (!value) throw new Error('Données indisponibles')
  return value
}
