#!/usr/bin/env bun
// Shows toast-card.qml with the same contract as toast.ps1.
//   bun toast-card.ts --spec <file>
// Prints "choice: <label>" and/or "text: <words>", or "open", "later" or "timeout".
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { CARD_ANSWER_MARKER, qmlRuntime } from './src/desktop/qml-card.ts'
import type { ToastSpec } from './src/desktop/toast.ts'

const specFile = process.argv[process.argv.indexOf('--spec') + 1]
const spec: ToastSpec = JSON.parse(fs.readFileSync(specFile, 'utf8'))
const cardFile = path.join(import.meta.dir, 'toast-card.qml')

const card = spawn(qmlRuntime() ?? 'qml6', [cardFile, '--', JSON.stringify(spec)], {
  env: {
    ...process.env,
    // Makes the card a layer-shell surface, which is what lets it sit in the screen corner.
    QT_QPA_PLATFORM: 'wayland',
    QT_WAYLAND_SHELL_INTEGRATION: 'layer-shell',
    // Without a terminal on stderr, Qt logs to the journal instead, and the answer never reaches this script.
    QT_FORCE_STDERR_LOGGING: '1',
  },
  stdio: ['ignore', 'ignore', 'pipe'],
})

const passing = spec.kind === 'good' || spec.kind === 'waiting'
if (!passing) playSound()

// The card logs each answer line behind a marker; everything else in the log is Qt's own noise.
let log = ''
card.stderr.on('data', (chunk) => (log += chunk))
card.on('close', () => {
  const answerLines = log
    .split('\n')
    .map((line) => line.match(new RegExp(`${CARD_ANSWER_MARKER}(.*)$`))?.[1]?.trim())
    .filter(Boolean)
  console.log(answerLines.length ? answerLines.join('\n') : 'timeout')
})

// The server stops this script when the question is answered somewhere else.
process.on('SIGTERM', () => card.kill())

function playSound(): void {
  const player = spawn('canberra-gtk-play', ['-i', 'message-new-instant'], { stdio: 'ignore' })
  player.on('error', () => {})
}
