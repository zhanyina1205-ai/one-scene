import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFile(resolve(root, path), 'utf8')
const picture = async path => `data:image/jpeg;base64,${(await readFile(resolve(root, path))).toString('base64')}`
const model = (await read('source/demo-model.mjs')).replace(/^export /gm, '')
const replacements = {
  '{{STYLES}}': await read('source/styles.css'),
  '{{SCRIPT}}': `${model}\n${await read('source/app.js')}`.replace(/<\/script/gi, '<\\/script'),
  '{{HERO_IMAGE}}': await picture('assets/backstage.jpg'),
  '{{NIGHT_IMAGE}}': await picture('assets/after-wrap.jpg'),
}
let html = await read('source/index.html')
for (const [marker, value] of Object.entries(replacements)) html = html.replaceAll(marker, () => value)
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved template marker')
await mkdir(resolve(root, 'dist'), { recursive: true })
await writeFile(resolve(root, 'dist/index.html'), html)
console.log(`Built self-contained HTML: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`)
