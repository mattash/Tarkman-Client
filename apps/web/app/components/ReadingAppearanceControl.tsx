import type { ReadingAppearance } from '@/hooks/useReadingAppearance'

interface ReadingAppearanceControlProps {
  value: ReadingAppearance
  onChange: (appearance: ReadingAppearance) => void
}

export function ReadingAppearanceControl({ value, onChange }: ReadingAppearanceControlProps) {
  return (
    <label className="reading-appearance-control">
      <span>Appearance</span>
      <select
        aria-label="Reading appearance"
        value={value}
        onChange={(event) => onChange(event.target.value as ReadingAppearance)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  )
}
