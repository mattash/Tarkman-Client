import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, findNodeHandle, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text as NativeText, TextInput, View, useColorScheme, useWindowDimensions, type TextProps } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import tokens from './tokens.json';
import { prayer, marksSample, sampleLanguages, type Language } from './samples';

type Sheet = 'languages' | 'explanation' | 'preferences' | null;
type Appearance = 'system' | 'light' | 'dark';
type Colors = typeof tokens.themes.light;

function Text(props: TextProps) {
  const { fontScale } = useWindowDimensions();
  // The iOS lab runtime retained stale text measurements after a live size change.
  // Refresh text leaves only; keep screen state, inputs and scroll containers alive.
  return <NativeText key={Platform.OS === 'ios' ? fontScale : 'native'} {...props} />;
}

export default function App() {
  const [loaded, error] = useFonts({
    SourceRegular: require('./assets/SourceSerif4-Regular.ttf'),
    SourceSemibold: require('./assets/SourceSerif4-Semibold.ttf'),
    ArmenianRegular: require('./assets/NotoSerifArmenian-Regular.ttf'),
    ArmenianBold: require('./assets/NotoSerifArmenian-Bold.ttf'),
  });
  return <SafeAreaProvider><Specimen fontsReady={loaded} fontError={error?.message} /></SafeAreaProvider>;
}

function focus(ref: View | null) {
  if (!ref) return;
  const handle = findNodeHandle(ref);
  if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
}

function Specimen({ fontsReady, fontError }: { fontsReady: boolean; fontError?: string }) {
  const os = useColorScheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [appearance, setAppearance] = useState<Appearance>('system');
  const theme = appearance === 'system' ? (os === 'dark' ? 'dark' : 'light') : appearance;
  const c = tokens.themes[theme];
  const [sheet, setSheet] = useState<Sheet>(null);
  const [languages, setLanguages] = useState<Language[]>(['en', 'ru', 'grabar']);
  const [draft, setDraft] = useState<Language[]>([]);
  const [validation, setValidation] = useState('');
  const [position, setPosition] = useState(0);
  const [following, setFollowing] = useState(true);
  const [readingSize, setReadingSize] = useState(24);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [tools, setTools] = useState(false);
  const [marks, setMarks] = useState(false);
  const [note, setNote] = useState('');
  const opener = useRef<View>(null);
  const languageRef = useRef<View>(null);
  const explainRef = useRef<View>(null);
  const preferenceRef = useRef<View>(null);
  const closeRef = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (wasOpen.current && !sheet && Platform.OS === 'android') requestAnimationFrame(() => focus(opener.current));
    wasOpen.current = !!sheet;
  }, [sheet]);
  function open(next: Exclude<Sheet, null>) {
    opener.current = next === 'languages' ? languageRef.current : next === 'explanation' ? explainRef.current : preferenceRef.current;
    setDraft([...languages]); setValidation(''); setSheet(next);
  }
  function dismiss() { setSheet(null); }
  const ui = { color: c.text, fontSize: 17, lineHeight: 27 };
  const meta = { color: c.muted, fontSize: 14, lineHeight: 22 };
  const title = { color: c.text, fontFamily: fontsReady ? 'SourceSemibold' : undefined, fontSize: 34, lineHeight: 44 };
  function passages() {
    return languages.map(language => <View key={language} style={{ gap: 8, borderTopWidth: 1, borderTopColor: c.divider, paddingTop: 16 }}>
      <Text style={meta}>{sampleLanguages.find(l => l.value === language)?.label}</Text>
      <Text selectable accessibilityLanguage={language === 'grabar' ? 'hy' : language === 'translit' ? 'hy-Latn' : language}
        style={{ color: c.text, fontFamily: fontsReady ? language === 'grabar' ? 'ArmenianRegular' : 'SourceRegular' : undefined,
          fontSize: readingSize, lineHeight: readingSize * 38 / 24 }}>
        {prayer[language].split('\n\n')[position]}
      </Text>
    </View>);
  }
  const sheetTitle = sheet === 'languages' ? 'Reading languages' : sheet === 'explanation' ? 'About this passage' : 'Reading preferences';
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    <View style={{ flex: 1, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}
      accessibilityElementsHidden={!!sheet} importantForAccessibility={sheet ? 'no-hide-descendants' : 'auto'}>
      <View style={{ paddingHorizontal: 24, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.divider, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ ...ui, fontFamily: fontsReady ? 'SourceSemibold' : undefined, color: c.primary }}>Tarkman</Text>
        <Action ref={preferenceRef} colors={c} icon="options-outline" onPress={() => open('preferences')}>Preferences</Action>
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 24, paddingBottom: Math.max(insets.bottom, 24), gap: 24 }}>
        <View style={{ gap: 8 }}><Text accessibilityRole="header" style={title}>The Lord’s Prayer</Text>
          <Text style={meta}>Sample service · Passage {position + 1} of 2</Text>
          <Text accessibilityLiveRegion="polite" style={{ ...meta, color: following ? c.success : c.muted }}>{following ? 'Following live' : 'Reading at your own pace'}</Text></View>
        {!fontsReady && <Text accessibilityRole="alert" style={{ ...ui, color: c.danger }}>{fontError ? 'Reading fonts failed to load. Font review is blocked.' : 'Loading reading fonts…'}</Text>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <Action ref={languageRef} colors={c} icon="language-outline" onPress={() => open('languages')}>Languages</Action>
          <Action ref={explainRef} colors={c} icon="book-outline" onPress={() => open('explanation')}>Explanation</Action>
          {!following && <Action colors={c} primary onPress={() => { setPosition(0); setFollowing(true); scroll.current?.scrollTo({ y: 0, animated: !reduceMotion }); }}>Return to live</Action>}
        </View>
        {passages()}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
          <Action colors={c} disabled={position === 0} onPress={() => { setPosition(0); setFollowing(false); }}>Previous passage</Action>
          <Action colors={c} disabled={position === 1} onPress={() => { setPosition(1); setFollowing(false); }}>Next passage</Action>
        </View>
        <Action colors={c} onPress={() => setTools(!tools)}>{tools ? 'Hide review tools' : 'Review tools'}</Action>
        {tools && <View style={{ gap: 16 }}>
          <Text style={meta}>Provisional design lab · {Platform.OS} · {theme} · OS font scale {fontScale.toFixed(2)} · Fonts {fontsReady ? 'loaded' : 'pending'}</Text>
          <Text style={meta}>Insets: top {insets.top}, bottom {insets.bottom}. Reduce motion: {reduceMotion ? 'on' : 'off'}.</Text>
          <Action colors={c} onPress={() => setMarks(!marks)}>{marks ? 'Hide Armenian marks' : 'Show Armenian marks'}</Action>
          {marks && <Text selectable accessibilityLanguage="hy" style={{ ...ui, fontFamily: fontsReady ? 'ArmenianRegular' : undefined, fontSize: 24, lineHeight: 38 }}>{marksSample}</Text>}
        </View>}
      </ScrollView>
    </View>
    <Modal visible={!!sheet} transparent={Platform.OS !== 'ios'} presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
      animationType={reduceMotion ? 'none' : 'slide'} allowSwipeDismissal onRequestClose={dismiss}
      onShow={() => focus(closeRef.current)} onDismiss={() => focus(opener.current)}>
      <SafeAreaProvider><SheetSurface colors={c} theme={theme}>
        <View accessibilityViewIsModal onAccessibilityEscape={dismiss} style={{ flex: 1, gap: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            {fontScale <= 1.5 && <Text accessibilityRole="header" style={{ ...title, fontSize: 28, lineHeight: 38, flexShrink: 1 }}>{sheetTitle}</Text>}
            <Action ref={closeRef} colors={c} onPress={dismiss}>{sheet === 'languages' ? 'Cancel' : 'Close'}</Action>
          </View>
          <ScrollView style={{ flex: 1 }} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ gap: 20, paddingBottom: 8 }}>
            {fontScale > 1.5 && <Text accessibilityRole="header" style={{ ...title, fontSize: 28, lineHeight: 38 }}>{sheetTitle}</Text>}
            {sheet === 'languages' && <>
              <Text style={ui}>Choose one or more languages to read together.</Text>
              {sampleLanguages.map(l => { const checked = draft.includes(l.value); return <Pressable key={l.value} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={l.label}
                onPress={() => { setDraft(checked ? draft.filter(v => v !== l.value) : [...draft, l.value]); setValidation(''); }}
                style={({ pressed }) => ({ minHeight: 56, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderRadius: tokens.radius.control,
                  borderColor: checked ? c.primary : c.control, backgroundColor: checked || pressed ? c.selection : c.surface })}>
                <Ionicons name={checked ? 'checkbox-outline' : 'square-outline'} size={24} color={checked ? c.onSelection : c.text} accessible={false} />
                <Text style={{ ...ui, flexShrink: 1, color: checked ? c.onSelection : c.text }}>{l.label}</Text>
              </Pressable>; })}
              {!!validation && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{ ...ui, color: c.danger }}>{validation}</Text>}
              <Action colors={c} primary onPress={() => { if (!draft.length) { setValidation('Choose at least one reading language.'); AccessibilityInfo.announceForAccessibility('Choose at least one reading language.'); return; } setLanguages(sampleLanguages.filter(l => draft.includes(l.value)).map(l => l.value)); dismiss(); }}>Apply languages</Action>
            </>}
            {sheet === 'explanation' && <>
              <Text style={meta}>Passage {position + 1} of 2 · Sample explanation</Text>
              <Text style={ui}>Read the passage alongside its translations. Return to continue from the same place.</Text>
              {passages()}
              <Action colors={c} primary onPress={dismiss}>Back to reading</Action>
            </>}
            {sheet === 'preferences' && <>
              <Text accessibilityRole="header" style={ui}>Appearance</Text>
              {(['system', 'light', 'dark'] as const).map(value => <Action key={value} colors={c} primary={appearance === value} selected={appearance === value} onPress={() => setAppearance(value)}>{value[0].toUpperCase() + value.slice(1)}</Action>)}
              <Text accessibilityRole="header" style={ui}>Reading size</Text>
              {([{size:24,label:'Standard'}, {size:30,label:'Larger'}, {size:36,label:'Extra large'}]).map(value => <Action key={value.size} colors={c} primary={readingSize === value.size} selected={readingSize === value.size} onPress={() => setReadingSize(value.size)}>{value.label}</Action>)}
              <Text style={meta}>This preview keeps preferences only while open.</Text>
              <Text style={ui}>Keyboard test note</Text>
              <TextInput accessibilityLabel="Keyboard test note" multiline value={note} onChangeText={setNote} placeholder="Review-only field" placeholderTextColor={c.muted}
                keyboardAppearance={theme} selectionColor={c.primary} style={{ ...ui, minHeight: 96, padding: 16, borderWidth: 1, borderColor: c.control, borderRadius: 8, backgroundColor: c.surface, textAlignVertical: 'top' }} />
              <Action colors={c} primary onPress={dismiss}>Done</Action>
            </>}
          </ScrollView>
        </View>
      </SheetSurface></SafeAreaProvider>
    </Modal>
  </View>;
}

function SheetSurface({ colors: c, theme, children }: { colors: Colors; theme: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const ios = Platform.OS === 'ios';
  return <KeyboardAvoidingView behavior={ios ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: ios ? c.overlay : 'rgba(0,0,0,0.4)' }}>
    <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    <View style={{ ...(ios ? { flex: 1 } : { height: '92%' as const }), backgroundColor: c.overlay, borderTopLeftRadius: tokens.radius.sheet, borderTopRightRadius: tokens.radius.sheet,
      paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24), paddingLeft: Math.max(insets.left, 24), paddingRight: Math.max(insets.right, 24) }}>
      {children}
    </View>
  </KeyboardAvoidingView>;
}

const Action = React.forwardRef<View, { colors: Colors; children: string; onPress: () => void; primary?: boolean; disabled?: boolean; selected?: boolean; icon?: React.ComponentProps<typeof Ionicons>['name'] }>(
  function Action({ colors: c, children, onPress, primary, disabled, selected, icon }, ref) {
    return <Pressable ref={ref} accessibilityRole="button" accessibilityLabel={children} accessibilityState={{ disabled: !!disabled, ...(selected === undefined ? {} : { selected }) }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ minHeight: 48, maxWidth: '100%', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1,
        borderColor: primary || disabled ? 'transparent' : c.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: disabled ? c.disabled : primary ? pressed ? c.pressed : c.primary : pressed ? c.selection : c.surface })}>
      {icon && <Ionicons name={icon} size={20} color={primary ? c.onPrimary : c.text} accessible={false} />}
      <Text style={{ fontSize: 15, lineHeight: 23, fontWeight: '600', flexShrink: 1, color: disabled ? c.onDisabled : primary ? c.onPrimary : c.text }}>{children}</Text>
    </Pressable>;
  }
);
