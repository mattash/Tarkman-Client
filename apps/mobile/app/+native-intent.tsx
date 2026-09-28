import { Platform } from 'react-native'
import { androidReaderLink } from '../features/links/androidReaderLink'

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return Platform.OS === 'android' ? androidReaderLink(path) : path
}
