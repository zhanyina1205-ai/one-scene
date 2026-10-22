import { copyFile, mkdir } from 'node:fs/promises'
import '../proposal/scripts/build.mjs'

await mkdir(new URL('../dist/proposal/', import.meta.url), { recursive: true })
await copyFile(new URL('../proposal/dist/index.html', import.meta.url), new URL('../dist/proposal/index.html', import.meta.url))
console.log('Proposal included at dist/proposal/index.html')
