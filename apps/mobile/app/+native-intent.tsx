import { libraryLinkPath } from '../features/links/libraryLink'
import { Platform } from 'react-native'
import { androidReaderLink } from '../features/links/androidReaderLink'

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const library = libraryLinkPath(path)
  if (library !== undefined) return library
  return Platform.OS === 'android' ? androidReaderLink(path) : path
}
