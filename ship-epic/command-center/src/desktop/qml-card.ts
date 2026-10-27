// Whether this Linux desktop can show the QML card. It needs Qt's QML runtime, the layer-shell-qt module,
// and a Wayland compositor that speaks layer shell, which GNOME's does not.
import fs from 'node:fs'
import path from 'node:path'
import { commandExists } from './process.ts'

export const CARD_ANSWER_MARKER = 'ship-ui-answer: '

// The `qml` runtime, not `qmlscene`: qmlscene reads every argument as another file to open, the spec included.
const QML_RUNTIMES = ['qml6', '/usr/lib/qt6/bin/qml', '/usr/lib64/qt6/bin/qml']
const QML_MODULE_DIRS = [
  '/usr/lib/qt6/qml',
  '/usr/lib64/qt6/qml',
  '/usr/lib/x86_64-linux-gnu/qt6/qml',
  '/usr/lib/aarch64-linux-gnu/qt6/qml',
]

export function qmlRuntime(): string | null {
  return QML_RUNTIMES.find((runtime) => (runtime.startsWith('/') ? fs.existsSync(runtime) : commandExists(runtime))) ?? null
}

export function canShowCard(env: Record<string, string | undefined> = process.env): boolean {
  if (!env.WAYLAND_DISPLAY) return false
  if (/gnome/i.test(env.XDG_CURRENT_DESKTOP || '')) return false
  if (!qmlRuntime()) return false
  return QML_MODULE_DIRS.some((dir) => fs.existsSync(path.join(dir, 'org', 'kde', 'layershell', 'qmldir')))
}
