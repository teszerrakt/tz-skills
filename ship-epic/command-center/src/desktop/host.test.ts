import { describe, expect, test } from 'bun:test'
import { detectHost } from './host.ts'

const linuxKernel = '7.3.0-4-cachyos'
const wslKernel = '6.6.87.2-microsoft-standard-WSL2'

describe('detectHost', () => {
  test('names Windows and macOS by platform', () => {
    expect(detectHost({ platform: 'win32', kernelRelease: '10.0.26100', env: {} })).toBe('windows')
    expect(detectHost({ platform: 'darwin', kernelRelease: '25.0.0', env: {} })).toBe('mac')
  })

  test('WSL is its own host, display or not', () => {
    expect(detectHost({ platform: 'linux', kernelRelease: wslKernel, env: { DISPLAY: ':0' } })).toBe('wsl')
  })

  test('Linux with a Wayland or X display is a desktop', () => {
    expect(detectHost({ platform: 'linux', kernelRelease: linuxKernel, env: { WAYLAND_DISPLAY: 'wayland-1' } })).toBe('linux-desktop')
    expect(detectHost({ platform: 'linux', kernelRelease: linuxKernel, env: { DISPLAY: ':0' } })).toBe('linux-desktop')
  })

  test('Linux without one, such as over SSH, is headless', () => {
    expect(detectHost({ platform: 'linux', kernelRelease: linuxKernel, env: {} })).toBe('linux-headless')
  })

  test('SHIP_UI_HOST overrides detection', () => {
    expect(detectHost({ platform: 'linux', kernelRelease: linuxKernel, env: { SHIP_UI_HOST: 'linux-headless', DISPLAY: ':0' } })).toBe(
      'linux-headless',
    )
  })

  test('a SHIP_UI_HOST that names no host is refused', () => {
    expect(() => detectHost({ platform: 'linux', kernelRelease: linuxKernel, env: { SHIP_UI_HOST: 'hyprland' } })).toThrow(/must be one of/)
  })
})
