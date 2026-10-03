const COLORS = [
  ['Rouge', '#c65f5b'], ['Orange', '#d58b46'], ['Jaune', '#b59a35'], ['Vert', '#3e9950'],
  ['Bleu', '#598dc4'], ['Violet', '#9471b7'], ['Rose', '#c8779c'], ['Marron', '#96745b'],
]

export default function ColorPalette({ label, value, onChange, disabled = false }) {
  return <fieldset disabled={disabled} className="w-full">
    <legend className="text-sm mb-2">{label}</legend>
    <div className="flex flex-wrap gap-2">{COLORS.map(([name, hex]) =>
      <button type="button" key={hex} aria-label={name} title={name} aria-pressed={value === hex}
        onClick={() => onChange(hex)} className="w-10 h-10 rounded-full border-2 disabled:opacity-50"
        style={{ backgroundColor: hex, borderColor: value === hex ? 'var(--foreground)' : 'transparent' }}>
        {value === hex ? '✓' : ''}
      </button>
    )}</div>
  </fieldset>
}
