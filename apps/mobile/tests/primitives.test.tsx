import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { AppButton } from '../components/AppButton'
import { AppText } from '../components/AppText'
import { LiturgyText } from '../components/LiturgyText'
import { TextField } from '../components/TextField'
import { AppModal } from '../components/AppModal'
import { ReadingFontContext } from '../design/readingFont'
import { colors } from '../design/tokens'
import { parseMarkdown, parseMarkdownBlocks } from '../design/markdown'
import { prayer, marksSample } from '../design/samples'

const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light"><ReadingFontContext.Provider value={true}>{children}</ReadingFontContext.Provider></ThemeProvider>

describe('native primitives', () => {
  it('invokes an enabled action and suppresses disabled/loading actions', async () => {
    const action = jest.fn()
    await render(<><AppButton onPress={action}>Read</AppButton><AppButton disabled onPress={action}>Disabled</AppButton><AppButton loading onPress={action}>Loading</AppButton></>, { wrapper })
    await fireEvent.press(screen.getByRole('button', { name: 'Read' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Disabled' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Loading' }))
    expect(action).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Loading' }).props.accessibilityState).toEqual({ busy: true, disabled: true })
  })
  it('uses explicit pressed colors while preserving button geometry', async () => {
    const onPressIn = jest.fn(), onPressOut = jest.fn()
    await render(<AppButton onPressIn={onPressIn} onPressOut={onPressOut}>Return to live</AppButton>, { wrapper })
    const button = screen.getByRole('button', { name: 'Return to live' })
    expect(button).toHaveStyle({ backgroundColor: colors.light.primary, minHeight: 48, minWidth: 48 })
    await fireEvent(button, 'pressIn')
    expect(button).toHaveStyle({ backgroundColor: colors.light.pressed })
    expect(onPressIn).toHaveBeenCalledTimes(1)
    await fireEvent(button, 'pressOut')
    expect(button).toHaveStyle({ backgroundColor: colors.light.primary })
    expect(onPressOut).toHaveBeenCalledTimes(1)
  })
  it('gives quiet and secondary controls neutral press feedback without inverting their text', async () => {
    await render(<><AppButton variant="quiet">Choose languages</AppButton><AppButton variant="secondary">Forget my reading choices</AppButton></>, { wrapper })
    for (const name of ['Choose languages', 'Forget my reading choices']) {
      const button = screen.getByRole('button', { name })
      await fireEvent(button, 'pressIn')
      expect(button).toHaveStyle({ backgroundColor: colors.light.pressedSubtle })
      expect(screen.getByText(name)).toHaveStyle({ color: colors.light.foreground })
      await fireEvent(button, 'pressOut')
    }
  })
  it('leaves an unpaired asterisk alone and emphasises the pair that follows', async () => {
    // Real explanation text: the first asterisk never closes, so only "Nersessi erg" is emphasised.
    const text = 'each stanza of *Nayatz seerov" form an acrostic, which spells *Nersessi erg* which means "Song".'
    expect(parseMarkdown(text).filter(run => run.kind === 'italic')).toEqual([{ kind: 'italic', text: 'Nersessi erg' }])
    expect(parseMarkdown(text).map(run => run.text).join('')).toBe(text.replace('*Nersessi erg*', 'Nersessi erg'))
    expect(parseMarkdown('The hymn *Shnorya Mez* is attributed to St. Nerses.').filter(run => run.kind === 'italic')).toEqual([{ kind: 'italic', text: 'Shnorya Mez' }])
    expect(parseMarkdown('2 * 3 * 4 stars stay literal').every(run => run.kind === 'plain')).toBe(true)
  })
  it('breaks paragraphs once when the source uses Windows line endings', async () => {
    expect(parseMarkdown('First.\r\n\r\nSecond.').map(run => run.text).join('')).toBe('First.\n\nSecond.')
  })
  it('parses the agreed block subset with inline marks inside every block', () => {
    expect(parseMarkdownBlocks('One.\r\n\r\nTwo.')).toEqual([
      { kind: 'paragraph', runs: [{ kind: 'plain', text: 'One.' }] },
      { kind: 'paragraph', runs: [{ kind: 'plain', text: 'Two.' }] },
    ])
    expect(parseMarkdownBlocks('## The *hymn*\n\n- one\n- two *marked*\n\n2. two\n3. three\n\n> quoted\n> more')).toEqual([
      { kind: 'heading', level: 2, runs: [{ kind: 'plain', text: 'The ' }, { kind: 'italic', text: 'hymn' }] },
      { kind: 'list', ordered: false, start: 0, items: [[{ kind: 'plain', text: 'one' }], [{ kind: 'plain', text: 'two ' }, { kind: 'italic', text: 'marked' }]] },
      { kind: 'list', ordered: true, start: 2, items: [[{ kind: 'plain', text: 'two' }], [{ kind: 'plain', text: 'three' }]] },
      { kind: 'quote', runs: [{ kind: 'plain', text: 'quoted\nmore' }] },
    ])
  })
  it('keeps non-agreed block markup literal and folds deeper headings', () => {
    expect(parseMarkdownBlocks('#NoSpace\n\n-NoBullet\n\n\\# Escaped\n\n| table |')).toEqual([
      { kind: 'paragraph', runs: [{ kind: 'plain', text: '#NoSpace' }] },
      { kind: 'paragraph', runs: [{ kind: 'plain', text: '-NoBullet' }] },
      { kind: 'paragraph', runs: [{ kind: 'plain', text: '# Escaped' }] },
      { kind: 'paragraph', runs: [{ kind: 'plain', text: '| table |' }] },
    ])
    expect(parseMarkdownBlocks('Para\n\n```\n# not a heading\n\n- not a list\n```\n\nTail')).toEqual([
      { kind: 'paragraph', runs: [{ kind: 'plain', text: 'Para' }] },
      { kind: 'paragraph', runs: [{ kind: 'plain', text: '```\n# not a heading\n\n- not a list\n```' }] },
      { kind: 'paragraph', runs: [{ kind: 'plain', text: 'Tail' }] },
     ])
     expect(parseMarkdownBlocks('#### Deepest')).toEqual([{ kind: 'heading', level: 3, runs: [{ kind: 'plain', text: 'Deepest' }] }])
  })
  it('renders explanation blocks through the reading primitives, keeping selection and the reading font', async () => {
    const text = '# Top title\n\nIntro line.\n\n## The *hymn*\n\n- one\n- two\n\n1. first\n2. second\n\n> Quoted words'
    await render(<LiturgyText variant="explanation" text={text} blocks />, { wrapper })
    const intro = screen.getByText('Intro line.')
    expect(intro.props.selectable).toBe(true)
    expect(intro.props.allowFontScaling).toBe(true)
    expect(screen.getByRole('header', { name: 'The hymn' })).toHaveStyle({ fontFamily: 'SourceSerif4-Semibold', fontWeight: '400' })
    // The h1 cap keeps it above the uncapped body at the OS maximum: 23pt × 2.4 > 17pt × ~3.1.
    expect(screen.getByRole('header', { name: 'Top title' }).props.maxFontSizeMultiplier).toBe(2.4)
    expect(screen.getByRole('header', { name: 'The hymn' }).props.maxFontSizeMultiplier).toBeUndefined()
    expect(screen.getAllByText('•')).toHaveLength(2)
    expect(screen.getAllByText('•')[0].props.selectable).toBe(false)
    expect(screen.getByText('1.')).toBeOnTheScreen()
    expect(screen.getByText('2.')).toBeOnTheScreen()
    expect(screen.getByText('Quoted words')).toBeOnTheScreen()
    // A single paragraph stays on the original inline path.
    await render(<LiturgyText variant="explanation" text="Plain *emphasis* only." blocks />, { wrapper })
    expect(screen.getByText('Plain emphasis only.').props.selectable).toBe(true)
  })
  it('applies the reading size choice to every paragraph-shaped block', async () => {
    await render(<LiturgyText variant="liturgy" readingSize="larger" blocks text={'Para\n\n> Quoted\n\n- item'} />, { wrapper })
    expect(screen.getByText('Para')).toHaveStyle({ fontSize: 30, lineHeight: 46 })
    expect(screen.getByText('Quoted')).toHaveStyle({ fontSize: 30, lineHeight: 46 })
    expect(screen.getByText('item')).toHaveStyle({ fontSize: 30, lineHeight: 46 })
  })
  it('caps title and heading growth at 1.6× while other text keeps scaling fully', async () => {
    await render(<>
      <AppText variant="title">Divine Liturgy</AppText>
      <AppText variant="heading">The service</AppText>
      <AppText variant="body">Plain body</AppText>
      <AppText variant="explanation">Explanation body</AppText>
      <AppText variant="tab" maxFontSizeMultiplier={1.6}>Services</AppText>
      <AppText variant="title" maxFontSizeMultiplier={1.2}>Custom cap</AppText>
    </>, { wrapper })
    expect(screen.getByText('Divine Liturgy').props.maxFontSizeMultiplier).toBe(1.6)
    expect(screen.getByText('The service').props.maxFontSizeMultiplier).toBe(1.6)
    expect(screen.getByText('Plain body').props.maxFontSizeMultiplier).toBeUndefined()
    expect(screen.getByText('Explanation body').props.maxFontSizeMultiplier).toBeUndefined()
    expect(screen.getByText('Services').props.maxFontSizeMultiplier).toBe(1.6)
    expect(screen.getByText('Custom cap').props.maxFontSizeMultiplier).toBe(1.2)
  })
  it('preserves paragraphs, marks, selection, language and text scaling', async () => {
    const text = prayer.grabar + '\n\n' + marksSample
    await render(<LiturgyText text={text} language="grabar" />, { wrapper })
    const reading = screen.getByText(text, { exact: true })
    expect(reading).toHaveTextContent(text)
    expect(reading.props.selectable).toBe(true)
    expect(reading.props.allowFontScaling).toBe(true)
    expect(reading.props.accessibilityLanguage).toBe('hy')
    expect(reading).toHaveStyle({ fontFamily: 'NotoSerifArmenian-Regular' })
  })
  it('uses the pinned literary faces for non-Armenian reading and titles', async () => {
    await render(<><LiturgyText text={prayer.en} /><AppText variant="title">Divine Liturgy</AppText></>, { wrapper })
    expect(screen.getByText(prayer.en)).toHaveStyle({ fontFamily: 'SourceSerif4-Regular', fontWeight: '400' })
    expect(screen.getByText('Divine Liturgy')).toHaveStyle({ fontFamily: 'SourceSerif4-Semibold', fontWeight: '400' })
  })
  it.each([null, '', '   '])('makes missing translation explicit: %s', async text => {
    await render(<LiturgyText text={text} language="grabar" />, { wrapper })
    expect(screen.getByText('Translation not available.').props.accessibilityLanguage).toBe('en')
  })
  it('keeps markup literal and honors a nonselectable muted sample', async () => {
    await render(<LiturgyText text="text <tag>" selectable={false} tone="muted" />, { wrapper })
    expect(screen.getByText('text <tag>').props.selectable).toBe(false)
  })
  it('labels the input, forwards keyboard behavior and reports feedback', async () => {
    const change = jest.fn()
    const submit = jest.fn()
    await render(<TextField label="Email" keyboardType="email-address" error="Enter an address" onChangeText={change} onSubmitEditing={submit} />, { wrapper })
    const input = screen.getByLabelText('Email')
    await fireEvent.changeText(input, 'reader@example.org')
    await fireEvent(input, 'submitEditing')
    expect(change).toHaveBeenCalledWith('reader@example.org')
    expect(submit).toHaveBeenCalledTimes(1)
    expect(input.props.keyboardType).toBe('email-address')
    expect(input.props.keyboardAppearance).toBe('light')
    expect(input.props.allowFontScaling).toBe(true)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an address')
  })
  it('lets a caller override the keyboard appearance', async () => {
    await render(<TextField label="Note" keyboardAppearance="dark" />, { wrapper })
    expect(screen.getByLabelText('Note').props.keyboardAppearance).toBe('dark')
  })
  it('dismisses through close, backdrop, and the native back request', async () => {
    const dismiss = jest.fn()
    const previous = Platform.OS
    Platform.OS = 'android'
    try {
      await render(<AppModal visible title="Reading" onDismiss={dismiss}><LiturgyText text={prayer.en} /></AppModal>, { wrapper })
      await fireEvent.press(screen.getByRole('button', { name: 'Close Reading' }))
      await fireEvent.press(screen.getByTestId('modal-backdrop', { includeHiddenElements: true }))
      await fireEvent(screen.getByTestId('app-modal'), 'requestClose')
      expect(dismiss).toHaveBeenCalledTimes(3)
    } finally { Platform.OS = previous }
  })
  it('uses the native iOS page sheet contract', async () => {
    const previous = Platform.OS
    Platform.OS = 'ios'
    try {
      await render(<AppModal visible title="Reading" onDismiss={() => {}} />, { wrapper })
      expect(screen.getByTestId('app-modal')).toHaveProp('presentationStyle', 'pageSheet')
      expect(screen.getByTestId('app-modal')).toHaveProp('allowSwipeDismissal', true)
      expect(screen.getByTestId('modal-shell')).toHaveStyle({ flex: 1, height: undefined, maxHeight: '100%' })
      expect(screen.getByTestId('modal-content')).toHaveStyle({ flex: 1 })
    } finally { Platform.OS = previous }
  })
  it.each(['android', 'web'] as const)('keeps %s sheet children in a flexible scroll area with platform-specific shell sizing', async platform => {
    const previous = Platform.OS
    Platform.OS = platform
    const select = jest.fn()
    try {
      await render(<AppModal visible title="Reading language" onDismiss={() => {}}>
        <AppButton onPress={select}>English</AppButton>
        <AppButton>Armenian</AppButton>
      </AppModal>, { wrapper })
      // Jest does not run native layout: enforce the bounded Android parent
      // contract that prevents flex content from collapsing on the device.
      expect(screen.getByTestId('modal-shell')).toHaveStyle({ height: platform === 'android' ? '90%' : undefined, maxHeight: '90%', flex: undefined })
      const content = screen.getByTestId('modal-content')
      expect(content).toHaveStyle({ flex: 1 })
      expect(content).toHaveProp('keyboardShouldPersistTaps', 'handled')
      expect(content).toHaveProp('keyboardDismissMode', 'on-drag')
      expect(within(content).getByRole('button', { name: 'Armenian' })).toBeOnTheScreen()
      await fireEvent.press(within(content).getByRole('button', { name: 'English' }))
      expect(select).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('app-modal')).toHaveProp('presentationStyle', 'overFullScreen')
      expect(screen.getByTestId('app-modal')).toHaveProp('animationType', 'none')
    } finally { Platform.OS = previous }
  })
  it('leads with Cancel and trails the commit action when a sheet has one', async () => {
    await render(<AppModal visible title="Choose languages" dismissLabel="Cancel" onDismiss={() => {}}
      headerAction={<AppButton variant="quiet">Apply languages</AppButton>} />, { wrapper })
    // Queries return matches in tree order, which is the visual leading-to-trailing order.
    expect(screen.getAllByText(/^(Cancel|Choose languages|Apply languages)$/).map(node => node.props.children))
      .toEqual(['Cancel', 'Choose languages', 'Apply languages'])
  })
  it('keeps a lone Done trailing the title', async () => {
    await render(<AppModal visible title="Reading preferences" onDismiss={() => {}} />, { wrapper })
    expect(screen.getAllByText(/^(Done|Reading preferences)$/).map(node => node.props.children)).toEqual(['Reading preferences', 'Done'])
  })
  it('hides the dismissed sheet', async () => {
    await render(<AppModal visible={false} title="Hidden reading" onDismiss={() => {}} />, { wrapper })
    expect(screen.queryByText('Hidden reading')).toBeNull()
  })
})

it('keeps every semantic text/background pairing at WCAG AA contrast', () => {
  function luminance(hex: string) {
    const channels = hex.slice(1).match(/../g)!.map(value => {
      const s = parseInt(value, 16) / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  for (const palette of Object.values(colors)) {
    for (const [text, background] of [
      [palette.foreground, palette.background], [palette.foreground, palette.surface],
      [palette.muted, palette.background], [palette.muted, palette.surface],
      [palette.primary, palette.surface], [palette.destructive, palette.surface],
      [palette.onPrimary, palette.primary], [palette.onSecondary, palette.secondary],
      [palette.onDestructive, palette.destructive], [palette.foreground, palette.pressedSubtle],
    ]) {
      const values = [luminance(text), luminance(background)].sort((a, b) => b - a)
      expect((values[0] + 0.05) / (values[1] + 0.05)).toBeGreaterThanOrEqual(4.5)
    }
  }
})

it.each([0, 1, 9, 10])('renders decorative count %s without adding selection or another tap target', async count => {
  await render(<AppButton testID="explain" highlighted badgeCount={count} accessibilityLabel={`Explain, ${count} new explanations`}>Explain</AppButton>, { wrapper })
  expect(screen.getAllByRole('button')).toHaveLength(1)
  expect(screen.getByRole('button').props.accessibilityState.selected).not.toBe(true)
  const badge = screen.queryByTestId('explain-badge', { includeHiddenElements: true })
  if (count === 0) expect(badge).toBeNull()
  else { expect(badge).toHaveProp('pointerEvents', 'none'); expect(badge).toHaveTextContent(count > 9 ? '9+' : String(count)) }
})
it('composes the modal presentation callback with ordinary dismissal', async () => {
  const shown = jest.fn(), dismiss = jest.fn(), after = jest.fn()
  await render(<AppModal visible title="Explanation" onAfterShow={shown} onDismiss={dismiss} onAfterDismiss={after} />, { wrapper })
  expect(shown).not.toHaveBeenCalled()
  await fireEvent(screen.getByTestId('app-modal'), 'show'); expect(shown).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByRole('button', { name: 'Close Explanation' })); expect(dismiss).toHaveBeenCalledTimes(1)
  await fireEvent(screen.getByTestId('app-modal'), 'dismiss'); expect(after).toHaveBeenCalledTimes(1)
})
