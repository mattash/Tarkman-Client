// Executed in each page before Expo starts. All clients share Chrome's monotonic time origin.
export function installBridge(config) {
  const events = []
  let dropped = 0, committed = null, version = 0
  const bridge = { ...config, command: undefined, targetKey: null, events,
    emit(event) {
      if (events.length < 100000) events.push(event)
      else dropped++
      if (event.name !== 'ui.commit') return
      committed = event
      const checkVersion = ++version
      if (!bridge.command || event.part_key !== bridge.targetKey || event.refreshing || event.stale || event.failed || !event.connected) return
      let prior = null, stable = 0, frames = 0
      const command = bridge.command
      function check() {
        if (version !== checkVersion || bridge.command !== command || ++frames > 300) return
        const testId = config.client === 'controller' ? 'control-text' : `reading-${bridge.targetKey}`
        const element = document.querySelector(`[data-testid="${CSS.escape(testId)}"]`)
        const frame = document.querySelector(`[data-testid="${config.client === 'controller' ? 'control-reading' : 'reading-frame'}"]`)
        if (element && frame && document.visibilityState === 'visible') {
          const rect = element.getBoundingClientRect(), viewport = frame.getBoundingClientRect()
          // The beginning of the correct reading must be inside the reading viewport.
          const visible = rect.width > 0 && rect.top >= Math.max(0, viewport.top) - 2 && rect.top < Math.min(innerHeight, viewport.bottom) - 8
          const unchanged = prior && Math.abs(prior.top - rect.top) < 0.5 && Math.abs(prior.left - rect.left) < 0.5
          stable = visible && unchanged ? stable + 1 : 0
          prior = { top: rect.top, left: rect.left }
          if (stable >= 2) {
            bridge.emit({ name: 'ui.visible_estimate', run: bridge.run, client: bridge.client, command,
              session_id: bridge.sessionId, at_ms: performance.timeOrigin + performance.now(), part_key: bridge.targetKey,
              part_id: committed.part_id, frame_count: frames })
            return
          }
        }
        requestAnimationFrame(check)
      }
      requestAnimationFrame(check)
    },
    snapshot() { return { committed, dropped, visibility: document.visibilityState } },
    arm(command, targetKey) { bridge.command = command; bridge.targetKey = targetKey },
    drain() { return events.splice(0) },
  }
  globalThis.__TARKMAN_BENCHMARK__ = bridge
}
