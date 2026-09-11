import { expect, it, jest } from '@jest/globals'
import { AppState } from 'react-native'
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network'
import { lifecycle } from '../features/live/lifecycle'
jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn(), getNetworkStateAsync: jest.fn() }))
it('removes foreground/network listeners and ignores late initial network reads', async () => {
  let resolve!: (value: NetworkState) => void, network!: (value: NetworkState) => void
  const removeNetwork = jest.fn(), removeApp = jest.fn(), callback = jest.fn()
  jest.mocked(getNetworkStateAsync).mockImplementation(() => new Promise(r => { resolve = r }))
  jest.mocked(addNetworkStateListener).mockImplementation(cb => { network = cb; return { remove: removeNetwork } })
  const spy = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: removeApp })
  const stop = lifecycle.listen(callback)
  network({ isConnected: false }); expect(callback).toHaveBeenLastCalledWith(true, false)
  resolve({ isConnected: true }); await Promise.resolve(); expect(callback).toHaveBeenLastCalledWith(true, false)
  stop(); expect(removeApp).toHaveBeenCalledTimes(1); expect(removeNetwork).toHaveBeenCalledTimes(1)
  const count = callback.mock.calls.length; network({ isConnected: true }); expect(callback).toHaveBeenCalledTimes(count)
  spy.mockRestore()
})
