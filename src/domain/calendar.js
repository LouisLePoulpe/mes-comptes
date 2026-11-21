// Dates calendaires, indépendantes du fuseau horaire de l'appareil.
//
// Une opération est enregistrée à « minuit UTC » du jour choisi (2026-11-01T00:00:00.000Z).
// Ce n'est pas un instant mais un JOUR : il doit être lu en UTC. Le lire avec les méthodes
// locales (getMonth, toLocaleDateString sans timeZone) décale les opérations de la veille
// à l'ouest de Greenwich (à New York, le 1er novembre devient le 31 octobre) et déplace
// leurs montants d'un mois à l'autre.
//
// À l'inverse, « aujourd'hui » est le jour affiché par l'horloge de l'appareil, donc local.

const STORED_DAY = /^(\d{4})-(\d{2})-(\d{2})/

const pad = value => String(value).padStart(2, '0')

// Jour AAAA-MM-JJ d'une date enregistrée (texte ISO, horodatage ou Date), ou '' si invalide.
export function storedDay(value) {
  if (typeof value === 'string') {
    const match = STORED_DAY.exec(value.trim())
    if (match) return `${match[1]}-${match[2]}-${match[3]}`
  }
  if (value === null || value === undefined || value === '') return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

// Mois AAAA-MM d'une date enregistrée, ou '' si invalide.
export const storedMonth = value => storedDay(value).slice(0, 7)

// Année (nombre) d'une date enregistrée, NaN si invalide.
export const storedYear = value => parseInt(storedDay(value).slice(0, 4), 10)

// Numéro du mois (1 à 12) d'une date enregistrée, NaN si invalide.
export const storedMonthNumber = value => parseInt(storedDay(value).slice(5, 7), 10)

// Affichage d'une date enregistrée (ex. « 01/11/2026 »), sans décalage de fuseau.
export function formatStoredDay(value, locale = 'fr-FR', options = {}) {
  const day = storedDay(value)
  if (!day) return ''
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString(locale, { ...options, timeZone: 'UTC' })
}

// Jour calendaire AAAA-MM-JJ affiché par l'horloge de l'appareil.
export function localDay(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// Mois AAAA-MM affiché par l'horloge de l'appareil.
export const localMonth = (now = new Date()) => localDay(now).slice(0, 7)
