import { AppState } from 'react-native'
import * as Network from 'expo-network'
import { createAppLifecycle, type Lifecycle } from '@tarkman/reader'

export const lifecycle: Lifecycle = createAppLifecycle(AppState, Network)
