import { createShareAdapter } from '../displayLinks/share'
import { isLibraryLink } from '../links/libraryLink'
export const libraryShare = createShareAdapter(isLibraryLink)
