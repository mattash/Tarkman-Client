import { useEffect, useRef, useState } from 'react'
import { findNodeHandle, Platform, View } from 'react-native'
import { useI18n } from '../i18n'
import { libraryLinkUrl } from '../links/libraryLink'
import { libraryShare } from './share'

export function useShareService() {
  const { t } = useI18n(), anchor = useRef<React.ComponentRef<typeof View>>(null), lock = useRef(false), mounted = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [manual, setManual] = useState<string | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current) } }, [])
  function share(id: number, name: string) {
    const url = libraryLinkUrl(id)
    if (!url || lock.current) return
    lock.current = true; setBusy(true); setNotice(''); clearTimeout(timer.current)
    const line = t('library.shareMessage', { name })
    const message = Platform.OS === 'android' ? `${line}\n${url}` : line
    const handle = Platform.OS === 'web' ? undefined : findNodeHandle(anchor.current) ?? undefined
    // Keep Web Share invocation in the tap handler, before any await.
    void libraryShare.share(url, name, message, handle).then(async result => {
      if (result !== 'copy' || !mounted.current) return
      const copied = await libraryShare.copy(url)
      if (!mounted.current) return
      if (copied) {
        setNotice(t('library.shareCopied'))
        timer.current = setTimeout(() => setNotice(''), 5000)
      } else setManual(url)
    }).finally(() => { lock.current = false; if (mounted.current) setBusy(false) })
  }
  return { anchor, busy, notice, manual, dismiss: () => setManual(null), share }
}
