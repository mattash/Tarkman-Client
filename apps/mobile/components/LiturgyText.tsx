import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { Linking, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { parseMarkdown, parseMarkdownBlocks, safeHttpsUrl, type TextRun } from '../design/markdown'
import { parseMarkdownSource } from '../design/markdownSource'
import { useTheme } from '../design/ThemeProvider'
import { useReadingFont } from '../design/readingFont'
import { readingSizes, spacing, type ReadingSize } from '../design/tokens'
import { AppText, type AppTextProps } from './AppText'
import { useI18n } from '../features/i18n'

export interface PassageHighlight {
  start: number; end: number; requestId: number
  /** Called with the first highlighted glyph's window bounds (not the whole row). */
  onMeasure?(y: number, height: number, anchor: ComponentRef<typeof Text>): void
}
export interface VisibleTextLayout {
  /** Observer-owned invalidation hook, called after fresh line/stanza geometry arrives. */
  onChange?(): void
  measure(report: (top: number, height: number) => void): void
  /** Viewport bounds relative to this text, returning original UTF-16 source offsets. */
  range(top: number, bottom: number, width?: number): { start: number; end: number } | undefined
}
export interface LiturgyTextProps extends Omit<AppTextProps, 'children'> { text: string | null | undefined; readingSize?: ReadingSize; compactStanzas?: boolean; blocks?: boolean; passageHighlight?: PassageHighlight; registerVisibleText?(layout: VisibleTextLayout): () => void }
export function LiturgyText({ text, selectable = true, language = 'en', tone = 'default', readingSize = 'standard', compactStanzas = false, blocks = false, passageHighlight, registerVisibleText, variant = 'liturgy', style, ...props }: LiturgyTextProps) {
  const { fontScale, width: windowWidth, scale } = useWindowDimensions()
  const fontReady = useReadingFont()
  // Capture and jumps share layout qualification, never request identity.
  const styleKey = JSON.stringify(StyleSheet.flatten(style))
  const geometry = useMemo(() => ({ text, language, readingSize, variant, fontReady, fontScale, windowWidth, scale, styleKey,
    maxFontSizeMultiplier: props.maxFontSizeMultiplier, numberOfLines: props.numberOfLines, adjustsFontSizeToFit: props.adjustsFontSizeToFit,
    minimumFontScale: props.minimumFontScale, textBreakStrategy: props.textBreakStrategy,
    lineBreakStrategyIOS: props.lineBreakStrategyIOS, ellipsizeMode: props.ellipsizeMode,
    dynamicTypeRamp: props.dynamicTypeRamp, hyphenation: props.android_hyphenationFrequency,
  }), [text, language, readingSize, variant, fontReady, fontScale, windowWidth, scale, styleKey,
    props.maxFontSizeMultiplier, props.numberOfLines, props.adjustsFontSizeToFit, props.minimumFontScale,
    props.textBreakStrategy, props.lineBreakStrategyIOS, props.ellipsizeMode, props.dynamicTypeRamp, props.android_hyphenationFrequency])
  const lines = useRef<{ geometry: object; width?: number; values: { end: number; y: number; height: number }[];
    visible?: { y: number; height: number; start: number; end: number }[] } | undefined>(undefined)
  const textWidth = useRef<number | undefined>(undefined)
  const activeGeometry = useRef(geometry)
  const visibleNode = useRef<ComponentRef<typeof View> | null>(null)
  const stanzaFrame = useRef<ComponentRef<typeof View> | null>(null)
  const visibleLayout = useRef<VisibleTextLayout | undefined>(undefined)
  const children = useRef(new Map<number, { layout: VisibleTextLayout; revision: number }>())
  const stanzaNodes = useRef(new Map<number, ComponentRef<typeof View>>())
  const stanzaRevision = useRef(0)
  const stanzaBounds = useRef(new Map<number, { geometry: object; y: number; height: number; width: number }>())
  const activeVisibility = useRef<object | undefined>(geometry)
  useLayoutEffect(() => {
    activeVisibility.current = geometry
    return () => { activeVisibility.current = undefined }
  }, [geometry])
  useLayoutEffect(() => {
    if (!registerVisibleText || !text?.trim()) return
    const identity = geometry
    let measuredWidth: number | undefined
    type Frame = { x: number; y: number; width: number; height: number }
    let measuredParent: Frame | undefined
    let recovering = false
    let cancelRecovery: (() => void) | undefined
    let stanzaStarts: number[] | undefined
    const sameFrame = (a: Frame, b: Frame) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
    // Fabric can suppress onLayout when a new text context leaves a wrapper's
    // frame unchanged. Recover from current native frames, never by retagging old
    // bounds. Only a binary-search path and the visible window need native reads.
    const recoverStanzas = (top: number, bottom: number, width: number | undefined) => {
      const parent = stanzaFrame.current
      const origin = measuredParent
      if (recovering || !parent?.measureInWindow || !origin || width !== origin.width || width <= 0) return
      recovering = true
      const revision = stanzaRevision.current
      let finished = false
      const samples = new Map<number, { node: ComponentRef<typeof View>; child: NonNullable<ReturnType<typeof children.current.get>>;
        revision: number; previous: ReturnType<typeof stanzaBounds.current.get>; frame: Frame }>()
      const current = () => !finished && activeVisibility.current === identity && visibleLayout.current === layout
        && stanzaFrame.current === parent && measuredParent !== undefined && sameFrame(measuredParent, origin)
        && [...samples].every(([start, sample]) => stanzaNodes.current.get(start) === sample.node
          && children.current.get(start) === sample.child && sample.child.revision === sample.revision
          && stanzaBounds.current.get(start) === sample.previous)
      const stop = () => {
        if (finished) return
        finished = true
        clearTimeout(timeout)
        cancelRecovery = undefined
        recovering = false
        // A fresh child event may already have requested capture while this read
        // was pending. Give that event one new attempt after releasing the guard;
        // an unmeasurable node alone must not cause an automatic retry loop.
        if (activeVisibility.current === identity && visibleLayout.current === layout
          && stanzaRevision.current !== revision) layout.onChange?.()
      }
      // Detached native nodes need not answer; release the guard without polling.
      let timeout = setTimeout(stop, 500)
      const awaitNative = () => { clearTimeout(timeout); timeout = setTimeout(stop, 500) }
      cancelRecovery = stop
      const measureStanza = (index: number, report: (frame: Frame) => void) => {
        const start = stanzaStarts![index]
        const node = stanzaNodes.current.get(start), child = children.current.get(start)
        if (!current() || !node?.measureInWindow || !child) { stop(); return }
        const revision = child.revision, previous = stanzaBounds.current.get(start)
        awaitNative()
        node.measureInWindow((x, y, nativeWidth, height) => {
          if (!current() || stanzaNodes.current.get(start) !== node || children.current.get(start) !== child
            || child.revision !== revision || stanzaBounds.current.get(start) !== previous
            || nativeWidth !== width || height <= 0) { stop(); return }
          const frame = { x, y, width: nativeWidth, height }
          samples.set(start, { node, child, revision, previous, frame })
          report(frame)
        })
      }
      const commit = () => {
        awaitNative()
        parent.measureInWindow((x, y, nativeWidth, height) => {
          if (!current() || !sameFrame(origin, { x, y, width: nativeWidth, height })) { stop(); return }
          let changed = false
          for (const [start, { frame, previous }] of samples) {
            const y = frame.y - origin.y
            if (previous?.geometry !== identity || previous.width !== frame.width || previous.y !== y || previous.height !== frame.height) {
              stanzaBounds.current.set(start, { geometry: identity, y, height: frame.height, width: frame.width })
              changed = true
            }
          }
          stop()
          if (changed) layout.onChange?.()
        })
      }
      parent.measureInWindow((x, y, nativeWidth, height) => {
        if (!current() || !sameFrame(origin, { x, y, width: nativeWidth, height })) { stop(); return }
        // Source order is stable for this geometry; do not sort every scroll.
        stanzaStarts ??= [...children.current.keys()].sort((a, b) => a - b)
        const visible = (index: number): void => {
          if (index >= stanzaStarts!.length) { commit(); return }
          measureStanza(index, frame => {
            if (frame.y - origin.y >= bottom) commit()
            else visible(index + 1)
          })
        }
        const search = (low: number, high: number): void => {
          if (low >= high) { visible(low); return }
          const mid = Math.floor((low + high) / 2)
          measureStanza(mid, frame => {
            if (frame.y + frame.height - origin.y <= top) search(mid + 1, high)
            else search(low, mid)
          })
        }
        search(0, stanzaStarts.length)
      })
    }
    let webSource: ReturnType<typeof visibleSource> | undefined
    const layout: VisibleTextLayout = {
      measure(report) {
        const node = stanzaFrame.current ?? visibleNode.current
        if (!node?.measureInWindow) { report(0, 0); return }
        node.measureInWindow((x, y, width, height) => {
          if (activeVisibility.current !== identity || node !== (stanzaFrame.current ?? visibleNode.current)) { report(0, 0); return }
          measuredWidth = width
          measuredParent = { x, y, width, height }
          if (Platform.OS !== 'web' && !stanzaFrame.current) {
            const cached = lines.current
            if (cached?.geometry !== identity || cached.width !== width
              || (textWidth.current !== undefined && textWidth.current !== width)) { report(0, 0); return }
          }
          report(y, width > 0 ? height : 0)
        })
      },
      range(top, bottom, parentWidth) {
        if (activeVisibility.current !== identity) return
        if (stanzaFrame.current) {
          const width = parentWidth ?? measuredWidth
          for (const [start, child] of children.current) {
            const bounds = stanzaBounds.current.get(start)
            if (!bounds || bounds.geometry !== identity || (width !== undefined && bounds.width !== width)
              || bounds.y + bounds.height <= top || bounds.y >= bottom) continue
            const range = child.layout.range(top - bounds.y, bottom - bounds.y, width)
            if (range) return { start: start + range.start, end: start + range.end }
          }
          recoverStanzas(top, bottom, width)
          return
        }
        if (Platform.OS === 'web') return webVisibleRange(visibleNode.current, webSource ??= visibleSource(text), top, bottom)
        // A current source range is only meaningful in the matching native layout.
        const cached = lines.current
        const width = parentWidth ?? measuredWidth
        if (cached?.geometry !== identity || cached.width === undefined
          || (textWidth.current !== undefined && cached.width !== textWidth.current)
          || (width !== undefined && cached.width !== width)) return
        // Prefer a legible line, not a sliver disappearing beyond the top edge.
        const measured = cached.visible ?? []
        let low = 0, high = measured.length
        while (low < high) {
          const mid = Math.floor((low + high) / 2)
          if (measured[mid].y + measured[mid].height / 2 < top) low = mid + 1
          else high = mid
        }
        const line = measured[low]
        return line && line.y + line.height / 2 < bottom ? { start: line.start, end: line.end } : undefined
      },
    }
    visibleLayout.current = layout
    const unregister = registerVisibleText(layout)
    return () => { visibleLayout.current = undefined; cancelRecovery?.(); unregister() }
  }, [registerVisibleText, geometry, text])
  const anchor = useRef<ComponentRef<typeof Text> | null>(null)
  const textFrame = useRef<ComponentRef<typeof Text> | null>(null)
  const activeHighlight = useRef(passageHighlight)
  useLayoutEffect(() => {
    activeHighlight.current = passageHighlight
    activeGeometry.current = geometry
    return () => { activeHighlight.current = undefined }
  }, [passageHighlight, geometry])
  useEffect(() => {
    if (!passageHighlight) return
    const mapped = parseMarkdownSource(text ?? '')
    let selectedOffset = 0
    let found = false
    for (const positions of mapped.offsets) {
      const local = positions.findIndex(position => position.end > passageHighlight.start && position.start < passageHighlight.end)
      if (local >= 0) { selectedOffset += local; found = true; break }
      selectedOffset += positions.length
    }
    // Nested native Text can finish layout after the row's onLayout/FlashList onLoad.
    // A bounded retry also accommodates fonts and FlashList's deferred initial positioning.
    const timers = [0, 80, 200, 450, 900, 1600].map(delay => setTimeout(() => {
      const node = anchor.current
      const report = (y: number, height: number) => {
        if (node && activeHighlight.current === passageHighlight && activeGeometry.current === geometry && node === anchor.current && height > 0) {
          passageHighlight.onMeasure?.(y, height, node)
        }
      }
      // Native nested Text is a virtual node on some RN versions. onTextLayout
      // supplies exact line geometry when its own measureInWindow is unavailable.
      const cached = lines.current
      const line = found && cached?.geometry === geometry && cached.width !== undefined
        && (textWidth.current === undefined || cached.width === textWidth.current)
        ? cached.values.find(value => selectedOffset < value.end) : undefined
      if (Platform.OS !== 'web' && line) {
        textFrame.current?.measureInWindow?.((_x, y, width, height) => {
          // Reject an old-width map even if native reflow precedes its onLayout event.
          if (lines.current === cached && width === cached?.width && height > 0
            && (textWidth.current === undefined || width === textWidth.current)) report(y + line.y, line.height)
        })
      } else node?.measureInWindow?.((_x, y, width, height) => {
        if (width > 0) report(y, height)
      })
    }, delay))
    return () => { timers.forEach(clearTimeout) }
  }, [passageHighlight, text, geometry])
  // Keyed to the text it happened on, so a reused row showing another part does not carry the message over.
  const [failedText, setFailedText] = useState<string | null>(null)
  const linkFailed = failedText !== null && failedText === text
  const { colors } = useTheme()
  const { t } = useI18n()
  const missing = text == null || text.trim().length === 0
  const failureNotice = linkFailed && <AppText variant="caption" accessibilityRole="alert">{t('liturgyText.linkFailed')}</AppText>
  // One nested Text per inline form, shared by every paragraph-shaped block below.
  const styledRuns = (runs: TextRun[], source?: string) => {
    const ranges = passageHighlight && source !== undefined ? parseMarkdownSource(source).offsets.map(positions => {
      const start = positions.findIndex(position => position.end > passageHighlight.start && position.start < passageHighlight.end)
      if (start < 0) return undefined
      let end = start + 1
      while (end < positions.length && positions[end].start < passageHighlight.end) end++
      return [start, end] as const
    }) : []
    let anchored = false
    const content = (run: TextRun, index: number) => {
      const range = ranges[index]
      if (!range) return run.text
      const first = !anchored
      anchored = true
      // Anchor one code point: measuring an entire long match can produce a row-sized box.
      const anchorEnd = range[0] + (run.text.codePointAt(range[0])! > 0xffff ? 2 : 1)
      return <>{run.text.slice(0, range[0])}<Text testID={first ? 'passage-highlight-anchor' : 'passage-highlight'}
        ref={first ? anchor : undefined} style={{ backgroundColor: colors.subtle, color: colors.primary }}>
        {run.text.slice(range[0], first ? anchorEnd : range[1])}</Text>
        {first && anchorEnd < range[1] && <Text style={{ backgroundColor: colors.subtle, color: colors.primary }}>{run.text.slice(anchorEnd, range[1])}</Text>}
        {run.text.slice(range[1])}</>
    }
    return runs.map((run, index) => run.kind === 'plain' ? passageHighlight ? <Text key={index}>{content(run, index)}</Text> : run.text :
    <Text key={index} allowFontScaling
      {...(run.kind === 'link' && Platform.OS === 'web' ? { href: run.url, hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : {})} accessibilityRole={run.kind === 'link' ? 'link' : undefined}
      accessibilityLabel={run.kind === 'link' ? `${run.text} (${run.url})` : undefined}
      accessibilityHint={run.kind === 'link' ? t('liturgyText.linkHint') : undefined}
      onPress={run.kind === 'link' && Platform.OS !== 'web' ? () => {
        if (run.url && safeHttpsUrl(run.url)) Linking.openURL(run.url).catch(() => setFailedText(text ?? null))
      } : undefined}
      style={run.kind === 'bold'
        ? language === 'grabar' && fontReady ? { fontFamily: 'NotoSerifArmenian-Bold', fontWeight: '400' }
          : fontReady ? { fontFamily: 'SourceSerif4-Semibold', fontWeight: '400' } : { fontWeight: '600' }
        : run.kind === 'italic' ? {
          // No pinned literary italic ships yet. Use the platform's real
          // italic face rather than synthesizing one from Source Serif.
          fontFamily: Platform.OS === 'ios' ? 'System' : Platform.OS === 'android' ? 'sans-serif' : 'system-ui',
          fontStyle: 'italic',
        }
        : run.kind === 'code' ? { backgroundColor: colors.subtle }
        : { color: colors.primary, textDecorationLine: 'underline' }}>{content(run, index)}</Text>)
  }
  // Authored explanation Markdown renders the agreed block subset through these same primitives, so
  // text scaling, selection, the reading font and link handling still apply to every block.
  if (blocks && !missing) {
    const parsed = parseMarkdownBlocks(text!)
    if (parsed.length > 1 || parsed[0].kind !== 'paragraph') {
      // Paragraph-shaped blocks share the reading variant's size choice; headings keep their own
      // variant sizes. The h1 cap keeps it above the uncapped body at the OS maximum: body 17pt can
      // reach about 3.1× (53pt), so 23pt at 2.4× (55pt) stays the largest text on screen.
      const bodyStyle = [variant === 'liturgy' ? readingSizes[readingSize] : undefined, style]
      return <View style={{ gap: spacing.md }}>
        {parsed.map((block, index) => {
          if (block.kind === 'heading') return <AppText key={index} {...props} accessibilityRole="header"
            // The app distinguishes three in-text heading sizes; the explanation title is a heading of its own.
            variant={block.level === 1 ? 'heading' : block.level === 2 ? 'rowTitle' : 'label'}
            maxFontSizeMultiplier={block.level === 1 ? 2.4 : undefined}
            selectable={selectable} language={language} tone={tone} style={style}>{styledRuns(block.runs)}</AppText>
          if (block.kind === 'list') return <View key={index} style={{ gap: spacing.xs }}>
            {block.items.map((item, itemIndex) => <View key={itemIndex} style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
              <AppText {...props} variant={variant} selectable={false} language={language} tone="muted"
                style={[...bodyStyle, { minWidth: 22, textAlign: 'right' }]}>{block.ordered ? `${block.start + itemIndex}.` : '•'}</AppText>
              <AppText {...props} variant={variant} selectable={selectable} language={language} tone={tone}
                style={[...bodyStyle, { flex: 1 }]}>{styledRuns(item)}</AppText>
            </View>)}
          </View>
          if (block.kind === 'quote') return <View key={index} style={{ borderLeftWidth: 2, borderLeftColor: colors.divider, paddingLeft: spacing.md }}>
            <AppText {...props} variant={variant} selectable={selectable} language={language} tone={tone} style={bodyStyle}>{styledRuns(block.runs)}</AppText>
          </View>
          return <AppText key={index} {...props} variant={variant} selectable={selectable} language={language} tone={tone} style={bodyStyle}>{styledRuns(block.runs)}</AppText>
        })}
        {failureNotice}
      </View>
    }
  }
  if (compactStanzas && !missing && !text!.includes('```') && /\n\s*\n/.test(text!)) {
    // Keep authored line breaks inside each selectable stanza. Blank lines become
    // proportional space between stanzas instead of a full empty line between them.
    // Do not backtrack one CRLF into two separate line breaks; offsets stay raw.
    const stanzas = text!.split(/((?:\r\n|\r(?!\n)|\n)[ \t]*(?:\r\n|\r(?!\n)|\n)(?:[ \t]*(?:\r\n|\r(?!\n)|\n))*)/)
    let sourceOffset = 0
    const starts: number[] = []
    for (const stanza of stanzas) { starts.push(sourceOffset); sourceOffset += stanza.length }
    const firstMatch = passageHighlight ? stanzas.findIndex((stanza, index) => index % 2 === 0
      && passageHighlight.end > starts[index] && passageHighlight.start < starts[index] + stanza.length) : -1
    return <View ref={registerVisibleText ? stanzaFrame : undefined} collapsable={registerVisibleText ? false : undefined}>{stanzas.map((stanza, index) => {
      const start = starts[index]
      const localHighlight = index % 2 === 0 && passageHighlight && passageHighlight.end > start && passageHighlight.start < start + stanza.length
        ? { ...passageHighlight, onMeasure: index === firstMatch ? passageHighlight.onMeasure : undefined, start: Math.max(0, passageHighlight.start - start), end: Math.min(stanza.length, passageHighlight.end - start) } : undefined
      if (index % 2 !== 0) return <View key={index} style={{ height: spacing.stanza * fontScale * (readingSizes[readingSize].lineHeight / 38) * (stanza.replace(/\r\n?/g, '\n').split('\n').length - 2) }} />
      if (!stanza.length) return null
      const content = <LiturgyText key={index} {...props} variant={variant} style={style} text={stanza} language={language} tone={tone} selectable={selectable} readingSize={readingSize} passageHighlight={localHighlight}
        registerVisibleText={registerVisibleText ? layout => {
          const child = { layout, revision: 0 }
          layout.onChange = () => { child.revision++; stanzaRevision.current++; visibleLayout.current?.onChange?.() }
          children.current.set(start, child)
          stanzaRevision.current++
          return () => {
            if (children.current.get(start) === child) { children.current.delete(start); stanzaRevision.current++ }
          }
        } : undefined} />
      return registerVisibleText ? <View key={index} testID={`visible-stanza-${start}`} collapsable={false}
        ref={node => { if (node) stanzaNodes.current.set(start, node); else stanzaNodes.current.delete(start) }} onLayout={event => {
        if (activeVisibility.current !== geometry) return
        stanzaBounds.current.set(start, { ...event.nativeEvent.layout, geometry })
        stanzaRevision.current++
        visibleLayout.current?.onChange?.()
      }}>{content}</View> : content
    })}</View>
  }
  // Nested native Text preserves paragraph breaks and selection without a DOM renderer.
  // AppText forwards React 19's ref prop to its outer native Text via its existing prop spread.
  const body = <><AppText {...props} {...(passageHighlight || registerVisibleText ? { ref: textFrame } : {})} onLayout={passageHighlight || registerVisibleText ? event => {
    props.onLayout?.(event)
    if (activeGeometry.current !== geometry) return
    const width = event.nativeEvent.layout.width
    textWidth.current = width
    visibleLayout.current?.onChange?.()
  } : props.onLayout} onTextLayout={passageHighlight || registerVisibleText ? event => {
    props.onTextLayout?.(event)
    if (activeGeometry.current !== geometry) return
    const mapped = registerVisibleText && !missing ? parseMarkdownSource(text ?? '') : undefined
    const displayed = mapped ? mapped.runs.map(run => run.text).join('') : parseMarkdown(text ?? '').map(run => run.text).join('')
    const positions = mapped?.offsets.flat()
    const visibleValues: { y: number; height: number; start: number; end: number }[] = []
    let offset = 0
    const values: { end: number; y: number; height: number }[] = []
    for (const line of event.nativeEvent.lines) {
      const start = displayed.indexOf(line.text, offset)
      // Native lines are substrings of the rendered text. A recycled row can
      // deliver an old payload through the current handler; never invent offsets.
      if (start < 0) return
      const end = start + line.text.length
      offset = end
      values.push({ end, y: line.y, height: line.height })
      const first = line.text.search(/\S/u), last = line.text.trimEnd().length
      if (positions && first >= 0 && positions[start + first] && positions[start + last - 1]) {
        visibleValues.push({ y: line.y, height: line.height, start: positions[start + first].start, end: positions[start + last - 1].end })
      }
    }
    const cached: NonNullable<typeof lines.current> = { geometry, values, visible: positions ? visibleValues : undefined }
    lines.current = cached
    // Qualify these lines by their native Text width. Either native event may arrive
    // first: a later onLayout must not erase a fresh map, nor validate an old-width one.
    const measuredText = textFrame.current
    measuredText?.measureInWindow?.((_x, _y, width) => {
      if (activeGeometry.current === geometry && lines.current === cached && measuredText === textFrame.current && width > 0) {
        cached.width = width
        visibleLayout.current?.onChange?.()
      }
    })
  } : props.onTextLayout} variant={variant} style={[variant === 'liturgy' ? readingSizes[readingSize] : undefined, style]} selectable={selectable} language={missing ? 'en' : language} tone={missing ? 'muted' : tone}>
    {missing ? t('liturgyText.translationUnavailable') : styledRuns(parseMarkdown(text!), text!)}
  </AppText>{failureNotice}</>
  return passageHighlight || registerVisibleText ? <View ref={visibleNode} collapsable={false}>{body}</View> : body
}

/** RN web does not emit onTextLayout. DOM ranges locate a visible line without pixel/source interpolation.
 * Binary searches bound layout reads even for a very long passage; no offscreen rows are mounted. */
function visibleSource(source: string) {
  const mapped = parseMarkdownSource(source)
  return { displayed: mapped.runs.map(run => run.text).join(''), positions: mapped.offsets.flat() }
}
function webVisibleRange(node: ComponentRef<typeof View> | null, { displayed, positions }: ReturnType<typeof visibleSource>, top: number, bottom: number) {
  const element = node as unknown as HTMLElement | null
  if (!element?.ownerDocument?.createRange) return
  const document = element.ownerDocument
  const walker = document.createTreeWalker(element, 4 /* SHOW_TEXT */)
  const nodes: { node: Node; start: number; end: number }[] = []
  let length = 0
  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    const start = length
    length += current.textContent?.length ?? 0
    nodes.push({ node: current, start, end: length })
  }
  if (!length || length !== displayed.length) return
  const origin = element.getBoundingClientRect().top
  const range = document.createRange()
  const rect = (index: number) => {
    const entry = nodes.find(value => index >= value.start && index < value.end)!
    range.setStart(entry.node, index - entry.start)
    range.setEnd(entry.node, Math.min(entry.end - entry.start, index - entry.start + (displayed.codePointAt(index)! > 0xffff ? 2 : 1)))
    return range.getBoundingClientRect()
  }
  let low = 0, high = length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    const bounds = rect(mid)
    if ((bounds.top + bounds.bottom) / 2 - origin < top) low = mid + 1
    else high = mid
  }
  let start = low
  while (start < length && /\s/u.test(displayed[start])) start++
  if (start >= length) return
  // Never split an emoji's UTF-16 surrogate pair.
  if (start > 0 && /[\uDC00-\uDFFF]/u.test(displayed[start])) start--
  const first = rect(start)
  if ((first.top + first.bottom) / 2 - origin >= bottom || first.bottom - origin <= top) return
  low = start + 1; high = length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (rect(mid).top > first.top + 1) high = mid
    else low = mid + 1
  }
  let end = low
  while (end > start && /\s/u.test(displayed[end - 1])) end--
  if (end < length && /[\uDC00-\uDFFF]/u.test(displayed[end]) && /[\uD800-\uDBFF]/u.test(displayed[end - 1])) end++
  return end > start ? { start: positions[start].start, end: positions[end - 1].end } : undefined
}