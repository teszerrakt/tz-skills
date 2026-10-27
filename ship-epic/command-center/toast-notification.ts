#!/usr/bin/env bun
// The fallback toast where the QML card cannot show: one desktop notification, through notify-send.
//   bun toast-notification.ts --spec <file>
// Prints "choice: <label>", "open", "later" or "timeout". Never "text:": a notification has no text field.
import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import { answerLine, notificationFor, notifySendArgs } from './src/desktop/notification.ts'
import type { ToastSpec } from './src/desktop/toast.ts'

const specFile = process.argv[process.argv.indexOf('--spec') + 1]
const spec: ToastSpec = JSON.parse(fs.readFileSync(specFile, 'utf8'))
const notification = notificationFor(spec)

const notifySend = spawn('notify-send', notifySendArgs(notification), { stdio: ['ignore', 'pipe', 'ignore'] })

// --print-id puts the notification's id on the first line; the clicked action, if any, follows.
let printed = ''
notifySend.stdout.on('data', (chunk) => (printed += chunk))
const printedLines = () => printed.split('\n').map((line) => line.trim())
const notificationId = () => printedLines()[0] || ''

let timedOut = false
// A critical notification never expires on most daemons, so the timeout is kept here.
const expiry = setTimeout(() => {
  timedOut = true
  closeNotification()
}, notification.seconds * 1000)

// The server stops this script when the question is answered somewhere else.
process.on('SIGTERM', () => {
  closeNotification()
  setTimeout(() => process.exit(0), 300)
})

notifySend.on('close', () => {
  clearTimeout(expiry)
  const clicked = printedLines().slice(1).find(Boolean) || ''
  console.log(answerLine(spec, clicked, timedOut))
})
notifySend.on('error', () => console.log('timeout'))

function closeNotification(): void {
  const id = notificationId()
  if (!id) return
  execFile(
    'gdbus',
    [
      'call',
      '--session',
      '--dest',
      'org.freedesktop.Notifications',
      '--object-path',
      '/org/freedesktop/Notifications',
      '--method',
      'org.freedesktop.Notifications.CloseNotification',
      id,
    ],
    () => {},
  )
}
