import { useLocalSearchParams } from 'expo-router'
import { EditSessionRoute } from '../../../../features/services/management/EditSession'
export default function EditSessionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  return <EditSessionRoute id={id} />
}
