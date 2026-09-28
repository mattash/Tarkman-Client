import { expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react-native'
import { Platform, Text } from 'react-native'

it("runs on the react-native-tvos preset", async () => {
  await render(<Text>hello</Text>)
  expect(screen.getByText('hello')).toBeTruthy()
  expect(typeof Platform.isTV).toBe('boolean')
})
