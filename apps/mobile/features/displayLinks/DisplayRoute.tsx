import { useLocalSearchParams } from 'expo-router'
import { readerConfig } from '../live/config'
import { DisplayLinkScreen } from './DisplayLinkScreen'
import { DisplayFrame, DisplayNotice } from './DisplayFrame'
export function DisplayRoute({ named = false, statusOnly = false }: { named?: boolean; statusOnly?: boolean }) {
  const params = useLocalSearchParams()
  const config = readerConfig()
  if (!config.endpoints) return <DisplayFrame><DisplayNotice title={config.error} /></DisplayFrame>
  return <DisplayLinkScreen endpoints={config.endpoints} params={params} named={named} statusOnly={statusOnly} />
}
