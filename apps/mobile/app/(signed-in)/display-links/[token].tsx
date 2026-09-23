import { useLocalSearchParams } from 'expo-router'
import { ManagerRoute } from '../../../features/displayLinks/ManagerRoute'
export default function EditDisplayLinkRoute() {
  const { token } = useLocalSearchParams<{ token: string }>()
  return <ManagerRoute token={typeof token === 'string' ? token : ''} />
}
