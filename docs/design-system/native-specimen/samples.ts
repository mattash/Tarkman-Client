export type Language = 'en' | 'ru' | 'grabar' | 'translit'

// Gallery-only labels keep this static preview independent of core runtime resolution.
export const sampleLanguages = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'grabar', label: 'Գրաբար' },
  { value: 'translit', label: 'Translit' },
] as const satisfies readonly { value: Language; label: string }[]

// Public-domain Lord's Prayer excerpt; static representative content, not a service response.
export const prayer: Record<Language, string> = {
  grabar: 'Հայր մեր, որ յերկինս ես,\nսուրբ եղիցի անուն քո։\n\nԵկեսցէ արքայութիւն քո,\nեղիցին կամք քո որպէս յերկինս եւ յերկրի։',
  en: 'Our Father, who art in heaven,\nhallowed be thy name.\n\nThy kingdom come. Thy will be done,\non earth as it is in heaven.',
  ru: 'Отче наш, сущий на небесах!\nДа святится имя Твоё.\n\nДа приидет Царствие Твоё;\nда будет воля Твоя и на земле, как на небе.',
  translit: 'Hayr mer, vor hergins yes,\nsurp yeghitsi anun ko.\n\nYegestse arkayutyun ko,\nyeghitsin gamk ko vorbes hergins yev hergri.',
}
// Deliberate decomposed combining-mark stress string; not a normalized liturgical edition.
export const marksSample = 'Հա\u0301յր մեր։ Տէ՛ր, ողորմեա՜։ Ինչո՞ւ։ Ա\u0304 ա\u0301'
