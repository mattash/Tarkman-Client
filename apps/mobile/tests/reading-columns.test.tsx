import { expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import type { Language } from '@tarkman/core'
import { ThemeProvider } from '../design/ThemeProvider'
import { normalizeParts } from '../features/live/contracts'
import { PartList } from '../features/live/PartList'

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => ({ width: 1133, height: 744, scale: 2, fontScale: 1 }) }))

const parts = normalizeParts({ parts: [
  { part: { id: 1, position: 1, role: 'priest', en: 'Short.', grabar: 'Հայր մեր, որ յերկինս ես, սուրբ եղիցի անուն քո։ Եկեսցէ արքայութիւն քո։', translit: 'Hayr mer', ru: 'Отче наш' } },
  { part: { id: 2, position: 2, role: 'deacon', en: 'A much longer English line that would widen a content-sized column considerably.', grabar: 'Ամէն։', translit: 'Amen', ru: 'Аминь' } },
] })

async function layout(selectedLanguages: Language[], width: number, language: Language = 'en') {
  const view = await render(<ThemeProvider scheme="light"><PartList parts={parts} currentKey={parts[0].key} following={false} language={language}
    selectedLanguages={selectedLanguages} manual={() => {}} open={() => {}} /></ThemeProvider>)
  await fireEvent(screen.getByTestId('reading-frame'), 'layout', { nativeEvent: { layout: { width, height: 700, x: 0, y: 0 } } })
  return view
}
const widths = (key: string) => screen.getAllByTestId(new RegExp(`^reading-column-${key.replace(/[:]/g, '\\:')}-`))
  .map(node => [node.props.testID.split('-').at(-1), [node.props.style].flat().find((style: { width?: number }) => style?.width !== undefined)?.width])

it('gives every column one width, the same in every part, whatever its text or which language leads', async () => {
  const view = await layout(['en', 'grabar', 'translit'], 1133)
  // (1133 − 2 × 20 page − 2 × 24 gap) ÷ 3, floored.
  expect(widths(parts[0].key)).toEqual([['en', 348], ['grabar', 348], ['translit', 348]])
  expect(widths(parts[1].key)).toEqual(widths(parts[0].key))
  await view.rerender(<ThemeProvider scheme="light"><PartList parts={parts} currentKey={parts[0].key} following={false} language="grabar"
    selectedLanguages={['en', 'grabar', 'translit']} manual={() => {}} open={() => {}} /></ThemeProvider>)
  expect(widths(parts[0].key)).toEqual([['grabar', 348], ['en', 348], ['translit', 348]])
})

it('shows as many chosen languages side by side as fit, rather than falling back to one', async () => {
  await layout(['en', 'grabar', 'translit'], 744)
  // Three columns would leave under 300pt each at 744pt; two still fit.
  expect(widths(parts[0].key)).toEqual([['en', 340], ['grabar', 340]])
})
