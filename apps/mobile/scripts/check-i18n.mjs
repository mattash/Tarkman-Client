import { readFileSync, readdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Interface copy lives in features/i18n/catalogs. This guard fails when reader-facing English is written inline again.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// The gallery and preview-only error controls are developer tools, never shown to readers of a production build.
const skipped = [/^features\/i18n\//, /^app\/gallery\.tsx$/, /^features\/observability\/TestErrorControls\.tsx$/, /\.test\.tsx?$/]
const copyProps = new Set(['label', 'accessibilityLabel', 'accessibilityHint', 'title', 'subtitle', 'message', 'placeholder', 'dismissLabel', 'error', 'hint', 'description', 'eyebrow', 'emptyLabel'])
// Sentence-like English: a capitalised word followed by more words or closing punctuation.
const sentence = /^[A-Z][a-z’']+(?:[ ,.!?…:—-]|$)[\s\S]*[a-z.!?…]/
// A catalog key such as `languageNames.en` is a reference to copy, not copy.
const catalogKey = /^[a-z][A-Za-z]*(?:\.[A-Za-z_]+)+$/
const listed = process.argv.includes('--list')
const findings = []

function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) { scan(path); continue }
    const file = relative(root, path)
    if (!/\.tsx?$/.test(file) || skipped.some(pattern => pattern.test(file))) continue
    const text = readFileSync(path, 'utf8')
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const report = (node, value) => {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line
      if (/i18n-ignore/.test(text.split('\n')[line] ?? '')) return
      findings.push(`${file}:${line + 1}: ${value.trim().replace(/\s+/g, ' ').slice(0, 100)}`)
    }
    const visit = node => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return
      if (ts.isJsxText(node) && /[A-Za-z]{2,}/.test(node.text)) report(node, node.text)
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        const parent = node.parent
        const attribute = ts.isJsxAttribute(parent) ? parent : ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent) ? parent.parent : undefined
        const name = attribute?.name.getText(source)
        const property = ts.isPropertyAssignment(parent) && parent.initializer === node ? parent.name.getText(source) : undefined
        const parameter = ts.isParameter(parent) || ts.isBindingElement(parent) ? parent.name.getText(source) : undefined
        // A single word still counts where it is shown: copy props, and conditional text rendered as a JSX child.
        const jsxChild = !!ts.findAncestor(parent, ancestor => ts.isJsxAttribute(ancestor) ? 'quit' : ts.isJsxExpression(ancestor) && (ts.isJsxElement(ancestor.parent) || ts.isJsxFragment(ancestor.parent)))
        const isCopyProp = ([name, property, parameter].some(value => value !== undefined && copyProps.has(value)) && /[A-Z\s]/.test(node.text)) || (jsxChild && /^[A-Z]/.test(node.text))
        const isKey = ts.isPropertyAssignment(parent) && parent.name === node
        const isThrown = !!ts.findAncestor(node, ancestor => ts.isNewExpression(ancestor) && ancestor.expression.getText(source) === 'Error' && /\b(console|assert)\b/.test(ancestor.getText(source)))
        if (!isKey && !isThrown && !catalogKey.test(node.text) && (sentence.test(node.text) || (isCopyProp && /[A-Za-z]{2,}/.test(node.text)))) report(node, node.text)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
}

for (const directory of ['app', 'components', 'features']) scan(resolve(root, directory))
if (listed) { console.log(findings.join('\n')); console.log(`${findings.length} candidate strings`) }
else if (findings.length > 0) {
  console.error(`Interface copy must come from the i18n catalog (features/i18n). Move these strings, or mark a line // i18n-ignore:\n${findings.join('\n')}`)
  process.exit(1)
} else console.log('i18n guard passed: no inline interface copy outside the catalogs.')
