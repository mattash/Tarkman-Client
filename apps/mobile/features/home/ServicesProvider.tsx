import { createContext, useContext, type ReactNode } from 'react'
import type { Endpoints } from '../live/config'
import { useReader } from '../live/useReader'

type ServicesValue = ReturnType<typeof useReader> & { endpoints: Endpoints }
const ServicesContext = createContext<ServicesValue | null>(null)

/** One services poll shared by Today and Services, which stay mounted side by side in the tab bar. */
export function ServicesProvider({ endpoints, children }: { endpoints: Endpoints; children: ReactNode }) {
  const reader = useReader(endpoints, null)
  return <ServicesContext.Provider value={{ ...reader, endpoints }}>{children}</ServicesContext.Provider>
}

export function useServices(): ServicesValue {
  const value = useContext(ServicesContext)
  if (!value) throw new Error('useServices must be used within a ServicesProvider')
  return value
}
