import { expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { PreviewStage } from '../features/displayLinks/DisplayFrame'

jest.mock('../features/keepAwake/useScreenKeepAwake', () => ({ useScreenKeepAwake: jest.fn() }))

it('renders nothing until measured, then lays the display out against the stage size', async () => {
  const child = jest.fn((size: { width: number; height: number }) => <Text testID="stage-child">{`${size.width}x${size.height}`}</Text>)
  await render(<PreviewStage height={420}>{child}</PreviewStage>)
  const stage = screen.getByTestId('display-preview-stage')
  expect(stage).toHaveStyle({ height: 420, overflow: 'hidden' })
  expect(screen.queryByTestId('stage-child')).toBeNull()
  await fireEvent(stage, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 640, height: 420 } } })
  expect(screen.getByTestId('stage-child')).toHaveTextContent('640x420')
  await fireEvent(stage, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 420 } } })
  expect(screen.getByTestId('stage-child')).toHaveTextContent('320x420')
})
