// Small arithmetic grammar, never eval/Function. Exact fractions avoid floating point
// surprises such as 1.005 rounding down. Only the final result is rounded to cents.
export function calculateAmount(input) {
  const text = String(input).replace(/\s/g, '').replace(/,/g, '.').replace(/[×x]/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
  if (!text) throw new Error('Saisis un montant supérieur à zéro.')
  if (text.length > 200 || /[^\d.+*/()-]/.test(text)) throw new Error('Utilise des nombres, +, −, ×, ÷ et des parenthèses.')
  let position = 0
  const limit = 10n ** 60n
  const fraction = (n, d = 1n) => {
    if (d === 0n) throw new Error('La division par zéro est impossible.')
    if (d < 0n) { n = -n; d = -d }
    if (n > limit || n < -limit || d > limit) throw new Error('Calcul trop grand ou trop précis.')
    let a = n < 0n ? -n : n, b = d
    while (b) { const next = a % b; a = b; b = next }
    return { n: n / a, d: d / a }
  }
  const factor = () => {
    if (text[position] === '+' || text[position] === '-') {
      const negative = text[position++] === '-'
      const value = factor()
      return { ...value, n: negative ? -value.n : value.n }
    }
    if (text[position] === '(') {
      position++
      const value = expression()
      if (text[position++] !== ')') throw new Error('Vérifie les parenthèses.')
      return value
    }
    const match = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(text.slice(position))
    if (!match) throw new Error('Le calcul est incomplet.')
    position += match[0].length
    const [whole, decimals = ''] = match[0].split('.')
    return fraction(BigInt((whole || '0') + decimals), 10n ** BigInt(decimals.length))
  }
  const product = () => {
    let value = factor()
    while (text[position] === '*' || text[position] === '/') {
      const operator = text[position++]
      const right = factor()
      value = operator === '*'
        ? fraction(value.n * right.n, value.d * right.d)
        : fraction(value.n * right.d, value.d * right.n)
    }
    return value
  }
  const expression = () => {
    let value = product()
    while (text[position] === '+' || text[position] === '-') {
      const operator = text[position++]
      const right = product()
      value = fraction(value.n * right.d + (operator === '+' ? 1n : -1n) * right.n * value.d, value.d * right.d)
    }
    return value
  }
  const result = expression()
  if (position !== text.length) throw new Error('Vérifie les opérateurs du calcul.')
  if (result.n <= 0n) throw new Error('Le montant doit être supérieur à zéro.')
  const cents = (result.n * 200n + result.d) / (result.d * 2n)
  if (cents === 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Le résultat doit être compris entre 0,01 € et la limite de précision.')
  return Number(cents) / 100
}
