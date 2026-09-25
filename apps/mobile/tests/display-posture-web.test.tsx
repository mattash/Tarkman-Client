/** @jest-environment jsdom */
import { expect, it, jest } from '@jest/globals'
import { act } from 'react'
import { PostureIcon } from '../features/displayLinks/PostureIcon.web'
import { I18nProvider } from '../features/i18n'

// Import the actual web SVG, mounting DOM nodes rather than the native PostureIcon.
// React DOM ships without types in this app; keep this test's adapter surface bounded.
const { createRoot } = jest.requireActual('react-dom/client') as {
  createRoot(container: HTMLElement): { render(element: React.ReactNode): void; unmount(): void }
}
jest.mock('../design/ThemeProvider', () => ({ useTheme: () => ({ colors: jest.requireActual<typeof import('../design/tokens')>('../design/tokens').colors.dark }) }))

it.each<[string | null | undefined, string, string, string]>([
  [null, 'Stand', '14 0 26 54', 'circle'], [undefined, 'Stand', '14 0 26 54', 'circle'],
  ['', 'Stand', '14 0 26 54', 'circle'], [' \t ', 'Stand', '14 0 26 54', 'circle'],
  [' STANDING ', 'Stand', '14 0 26 54', 'circle'],
  [' Sitting ', 'Sit', '26 5 76 119', 'path'], ['KNEELING', 'Kneel', '16 1 68 98', 'ellipse'],
  ['unknown', 'No posture indicated', '0 0 100 100', 'path'],
])('renders the actual web shape and accessible instruction for %p', async (posture, label, viewBox, shape) => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<I18nProvider preference="en"><PostureIcon posture={posture} /></I18nProvider>))
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('data-testid')).toBe('display-posture')
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe(label)
    expect(svg.getAttribute('viewBox')).toBe(viewBox)
    expect(svg.style.color).toBeTruthy()
    expect(svg.querySelector(shape)).not.toBeNull()
    const paths = [...svg.querySelectorAll('path')].map(path => path.getAttribute('d'))
    expect(paths.includes('M15 46h70v8H15z')).toBe(posture === 'unknown')
    if (label === 'Stand') {
      expect(svg.querySelector('circle')?.getAttribute('cx')).toBe('26.686')
      expect(paths).toHaveLength(1)
      expect(paths[0]).toContain('M28.256,11.163')
    }
    if (label === 'Sit') expect(paths).toHaveLength(3)
    if (label === 'Kneel') expect(paths[0]).toContain('M79.6,29')
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})
