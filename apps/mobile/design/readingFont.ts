import { createContext, useContext } from 'react'
export const ReadingFontContext = createContext(false)
export const useReadingFont = () => useContext(ReadingFontContext)
