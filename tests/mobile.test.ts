import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'public/manifest.webmanifest'), 'utf8'))

describe('手机网页与子路径部署', () => {
  it('主屏启动地址保留在部署目录内', () => {
    for (const base of ['https://example.test/', 'https://example.test/one-scene/']) {
      const manifestUrl = new URL('manifest.webmanifest', base)
      expect(new URL(manifest.start_url, manifestUrl).href).toBe(base)
      expect(new URL(manifest.scope, manifestUrl).href).toBe(base)
      for (const icon of manifest.icons) expect(new URL(icon.src, manifestUrl).href.startsWith(base)).toBe(true)
    }
  })
  it('所有主屏图标存在且PNG尺寸与声明一致', () => {
    for (const icon of manifest.icons) {
      const path = resolve(root, 'public', icon.src)
      expect(existsSync(path)).toBe(true)
      if (icon.type === 'image/png') {
        const buffer = readFileSync(path)
        const size = Number(icon.sizes.split('x')[0])
        expect(buffer.subarray(1, 4).toString()).toBe('PNG')
        expect(buffer.readUInt32BE(16)).toBe(size)
        expect(buffer.readUInt32BE(20)).toBe(size)
      }
    }
  })
  it('手机入口配置视口和iPhone主屏图标', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8')
    expect(html).toContain('width=device-width, initial-scale=1, viewport-fit=cover')
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"')
    expect(html).toContain('href="./icons/icon-180.png"')
    expect(html).toContain('href="./manifest.webmanifest"')
  })
  it('提案入口在根目录和GitHub Pages子路径都指向独立页面', () => {
    const source = readFileSync(resolve(root, 'src/App.tsx'), 'utf8')
    expect(source).toContain('href="./proposal/" target="_blank" rel="noopener noreferrer"')
    for (const base of ['https://example.test/', 'https://example.test/one-scene/']) {
      expect(new URL('./proposal/', base).href).toBe(`${base}proposal/`)
    }
  })
})
