/** Mobile-only utilities. Runtime color roles live in design/tokens.ts. */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './design/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: {
    spacing: { control: '44px', page: '24px', section: '32px' },
    borderRadius: { card: '16px', control: '8px' },
  } },
  plugins: [],
}
