import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const sourceRoot = path.join(root, 'src')
const forbiddenGlobals = new Set(['window', 'document', 'localStorage', 'sessionStorage', 'process', 'globalThis', 'global', 'self', 'navigator', 'fetch', 'WebSocket', 'XMLHttpRequest', 'require', 'eval', 'Function'])

export function inspectSource(source, filename = path.join(sourceRoot, 'probe.ts')) {
  const errors = []
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true)
  function checkModule(node) {
    if (!node || !ts.isStringLiteral(node)) {
      errors.push('Nonliteral module reference')
      return
    }
    const resolved = path.resolve(path.dirname(filename), node.text)
    if (!node.text.startsWith('./') && !node.text.startsWith('../') ||
        !resolved.startsWith(sourceRoot + path.sep)) {
      errors.push(`Non-core import: ${node.text}`)
    }
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) && node.moduleSpecifier) {
      checkModule(node.moduleSpecifier)
    }
    if (ts.isImportEqualsDeclaration(node)) { errors.push('Import assignment is forbidden') }
    if (ts.isImportTypeNode(node)) { checkModule(node.argument.literal) }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      checkModule(node.arguments[0])
    }
    if (ts.isIdentifier(node) && forbiddenGlobals.has(node.text)) {
      errors.push(`Platform identifier: ${node.text}`)
    }
    if (ts.isMetaProperty(node)) { errors.push('Runtime metadata is forbidden') }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  if (tree.referencedFiles.length || tree.typeReferenceDirectives.length || tree.libReferenceDirectives.length) {
    errors.push('Triple-slash references are forbidden')
  }
  return errors
}

export function checkBoundary() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    if (Object.keys(manifest[field] ?? {}).length) { throw new Error(`Core must have no ${field}`) }
  }
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) { throw new Error(`Symlink forbidden: ${filename}`) }
      if (entry.isDirectory()) { walk(filename); continue }
      if (!filename.endsWith('.ts') || filename.endsWith('.d.ts')) { throw new Error(`Unexpected source: ${filename}`) }
      const errors = inspectSource(fs.readFileSync(filename, 'utf8'), filename)
      if (errors.length) { throw new Error(`${filename}: ${errors.join(', ')}`) }
    }
  }
  walk(sourceRoot)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkBoundary()
  console.log('Core boundary passed: local imports only, no platform globals or runtime dependencies')
}
