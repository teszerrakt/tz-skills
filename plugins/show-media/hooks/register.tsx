import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register } from 'claude-code'

import type { Media } from '../types'

const PANE = 'media'
const TOOL = 'show_media'
const items = atom({ plugin: 'show-media', key: 'items' } as const, [], { shape: 'media-1' })
const index = atom({ plugin: 'show-media', key: 'index' } as const, 0)
const isPlaying = atom({ plugin: 'show-media', key: 'isPlaying' } as const, false)

const VIDEO = /\.(mp4|m4v|mkv|webm|mov|avi|gif)$/i
const IMAGE = /\.(png|jpe?g)$/i
const MAX_WIDTH = 640
const MAX_FPS = 24
// Per-session prefix for decoded frames; on Linux /dev/shm is memory.
const FRAMES = `/dev/shm/show-media-${Math.random().toString(36).slice(2, 10)}`

// Decodes a video with ffmpeg and swaps each raw RGB frame into one file by
// rename, so the terminal never reads half a frame; prints the frame count.
const DECODER = `
import os, signal, subprocess, sys
src, start, fps, w, h, out = sys.argv[1:7]
size = int(w) * int(h) * 3
signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
p = subprocess.Popen(['ffmpeg', '-nostdin', '-v', 'error', '-re', '-ss', start, '-i', src, '-an',
    '-vf', f'fps={fps},scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
n = 0
try:
    while True:
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        with open(out + '.tmp', 'wb') as f:
            f.write(buf)
        os.replace(out + '.tmp', out)
        n += 1
        print(n, flush=True)
finally:
    p.kill()
`

type Request = { path: string; caption?: string }

// Splits on spaces, keeping "quoted paths" whole.
function splitArgs(args: string) {
  return [...args.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3] ?? '')
}

// The terminal reads the file itself and takes absolute paths only.
async function absolute($: Engine, path: string) {
  const home = (await $.env.get('HOME')) ?? ''
  const expanded = path === '~' || path.startsWith('~/') ? home + path.slice(1) : path
  const stat = await $.fs.stat(expanded, { resolve: true })

  return { path: stat.realPath ?? expanded, kind: stat.kind }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Decodes whole base64 quads into bytes.
function decode(base64: string) {
  const out: number[] = []
  for (let i = 0; i + 4 <= base64.length; i += 4) {
    const n = [0, 1, 2, 3].reduce((acc, k) => (acc << 6) | B64.indexOf(base64.charAt(i + k)), 0)
    out.push((n >> 16) & 255, (n >> 8) & 255, n & 255)
  }
  return out
}

// A PNG starts with 0x89 'PNG'; its IHDR keeps width and height as big-endian u32s at bytes 16 and 20.
async function measureImage($: Engine, path: string) {
  const { base64 } = await $.fs.read(path, { as: 'bytes' })
  const b = decode(base64.slice(0, 32))
  const u32 = (at: number) => ((b[at] ?? 0) * 2 ** 24) + ((b[at + 1] ?? 0) << 16) + ((b[at + 2] ?? 0) << 8) + (b[at + 3] ?? 0)
  if (b.length < 24 || u32(0) !== 0x89504e47) return undefined

  return { width: u32(16), height: u32(20) }
}

async function measureVideo($: Engine, path: string) {
  const probe = await $.process.run([
    'ffprobe', '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,avg_frame_rate', '-of', 'json', path,
  ])
  const stream = (JSON.parse(probe.stdout) as { streams?: { width: number; height: number; avg_frame_rate: string }[] })
    .streams?.[0]
  if (probe.exitCode !== 0 || stream === undefined) return undefined

  const [num, den] = stream.avg_frame_rate.split('/').map(Number)
  const rate = num && den ? num / den : 15
  // Even sizes: ffmpeg's scaler and most codecs want them.
  const width = Math.min(MAX_WIDTH, stream.width) & ~1
  const height = Math.max(2, Math.round((width * stream.height) / stream.width / 2) * 2)

  return { width, height, fps: Math.min(MAX_FPS, Math.round(rate)) || 15 }
}

async function collect($: Engine, requests: Request[]) {
  const list: Media[] = []
  const skipped: string[] = []
  const add = async (path: string, caption?: string) => {
    const name = caption ?? path.split('/').pop() ?? path
    if (VIDEO.test(path)) {
      const size = await measureVideo($, path).catch(() => undefined)
      if (size === undefined) return skipped.push(`${path} (not a video ffmpeg can read)`)
      list.push({ path, caption: name, kind: 'video', isLooped: /\.gif$/i.test(path), ...size })
    } else {
      const size = await measureImage($, path).catch(() => undefined)
      if (size === undefined) return skipped.push(`${path} (not a PNG)`)
      list.push({ path, caption: name, kind: 'image', fps: 0, isLooped: false, ...size })
    }
  }

  for (const request of requests) {
    const found = await absolute($, request.path).catch(() => undefined)
    if (found === undefined) {
      skipped.push(`${request.path} (not found)`)
    } else if (found.kind === 'dir') {
      const entries = await $.fs.list(found.path)
      const files = entries.filter((one: { kind: string }) => one.kind === 'file').map((one: { name: string }) => one.name).sort()
      for (const name of files) {
        if (IMAGE.test(name) || VIDEO.test(name)) await add(`${found.path}/${name}`)
      }
    } else {
      await add(found.path, request.caption)
    }
  }

  return { list, skipped }
}

// Playback lives in the module: a reload stops it, which the decoder survives
// only until its next write to the closed pipe.
let stopPlayer: (() => void) | undefined
let position = 0
let generation = 0
let mounted = { columns: 0, rows: 0 }

function framePath(at: number) {
  return `${FRAMES}-${at}.rgb`
}

function stop() {
  stopPlayer?.()
  stopPlayer = undefined
}

async function play($: Engine, at: number, item: Media, from: number) {
  stop()
  let isStopped = false
  const stream = $.process.spawn({
    argv: ['python3', '-c', DECODER, item.path, String(from), String(item.fps), String(item.width), String(item.height), framePath(at)],
  })
  stopPlayer = () => {
    isStopped = true
    void stream.return({ code: null, signal: null } as never)
  }
  await update($, isPlaying, () => true)

  void (async () => {
    let frames = 0
    try {
      for await (const chunk of stream) {
        if (chunk.stream !== 'stdout') continue
        const n = Number(chunk.text.trim().split('\n').pop())
        if (!Number.isFinite(n)) continue
        frames = n
        position = from + n / item.fps
        generation += 1
        void $.ui.blit({
          requestId: PANE,
          key: 'frame',
          source: { file: framePath(at), format: 'rgb', width: item.width, height: item.height, generation },
          columns: mounted.columns,
          rows: mounted.rows,
        })
      }
    } catch {
      // A decoder that fails to start ends playback like one that finished.
    }
    if (isStopped) return
    stopPlayer = undefined
    position = 0
    if (item.isLooped && frames > 0) return play($, at, item, 0)
    await update($, isPlaying, () => false)
  })()
}

// Shows the item at `at`, starting a video from its beginning.
async function select($: Engine, at: number) {
  stop()
  position = 0
  await update($, index, () => at)
  await update($, isPlaying, () => false)
  const item = (await read($, items))[at]
  if (item?.kind === 'video') await play($, at, item, 0)
}

async function show($: Engine, requests: Request[], focus: boolean) {
  const { list, skipped } = await collect($, requests)
  const note = skipped.length > 0 ? ` Skipped: ${skipped.join(', ')}.` : ''
  if (list.length === 0) return `Nothing to show.${note}`

  await update($, items, () => list)
  const opened = await $.ui.open(focus ? { id: PANE, title: 'Media', focus: true } : { id: PANE, title: 'Media' })
  await select($, 0)

  return opened.isPlaced
    ? `Showing ${list.length} item(s).${note}`
    : `Media pane is waiting, not drawn: ${opened.reason}.${note}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'show-media',
      description: 'Show images, videos and GIFs (or a folder of them) in a pane; no path reopens the last ones',
      argumentHint: '<path|folder> [...]',
    })
    await $.tool.register({
      name: TOOL,
      description:
        'Show the person PNG images, videos or GIFs in a side pane of their terminal (kitty graphics; video plays silently). Each path is a file or a folder of them; ~ is expanded.',
      inputSchema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: { path: { type: 'string' }, caption: { type: 'string' } },
              required: ['path'],
            },
          },
        },
        required: ['items'],
      },
      isDeferred: false,
    })

    return next(e)
  })

  on('command.run', { command: 'show-media' }, async ($, e) => {
    const paths = splitArgs(e.args)
    // No paths reopens the last set: a pasted media path arrives as an attachment, not as text.
    if (paths.length === 0) {
      if ((await read($, items)).length === 0) return { text: 'Usage: /show-media <path|folder> [...]' }
      const opened = await $.ui.open({ id: PANE, title: 'Media', focus: true })

      return { text: opened.isPlaced ? 'Showing the last media.' : `Media pane not shown: ${opened.reason}` }
    }

    return { text: await show($, paths.map(path => ({ path })), true) }
  })

  on('tool.call', { tool: `mcp__show-media__${TOOL}` }, async ($, e) => {
    // A mod tool's input fields arrive on the event itself.
    const requests = (e as unknown as { items: Request[] }).items

    return { result: await show($, requests, false) }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      stop()
      await update($, isPlaying, () => false)
      void $.process.run(['sh', '-c', `rm -f ${FRAMES}-*`])
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    // Only the terminal surface has an Image element.
    if (e.surface !== 'terminal') return next(e)
    const { Box, Text, Button, Image } = $.ui.resolve(e)
    const list = await read($, items)
    const at = Math.min(await read($, index), list.length - 1)
    const item = list[at]
    if (item === undefined) return <Text dimColor>Nothing to show. Run /show-media &lt;path&gt;.</Text>

    // Fit the body below the title row and the controls row.
    // Terminal cells are about twice as tall as they are wide.
    const maxColumns = Math.max(10, Math.min(255, e.props.bodyColumns))
    const maxRows = Math.max(4, Math.min(255, e.props.scroll.bodyRows - 2))
    const ratio = item.height / item.width / 2
    const columns = Math.max(1, Math.min(maxColumns, Math.floor(maxRows / ratio)))
    const rows = Math.max(1, Math.min(maxRows, Math.round(columns * ratio)))
    mounted = { columns, rows }

    const playing = await read($, isPlaying)
    const go = (step: number) => select($, (at + step + list.length) % list.length)
    const toggle = () => {
      if (!playing) return play($, at, item, position)
      stop()
      return update($, isPlaying, () => false)
    }
    const source =
      item.kind === 'video'
        ? { file: framePath(at), format: 'rgb' as const, width: item.width, height: item.height, generation }
        : { file: item.path, format: 'png' as const }

    // Title, then controls, then the picture, so the buttons stay put while sizes change.
    return (
      <Box flexDirection="column">
        <Text bold wrap="truncate-end">
          {at + 1}/{list.length} {item.caption}
        </Text>
        <Box>
          {list.length > 1 && <Button key="prev" label="Prev (p)" hotkey="p" onPress={() => go(-1)} />}
          {list.length > 1 && <Text> </Text>}
          {list.length > 1 && <Button key="next" label="Next (n)" hotkey="n" onPress={() => go(1)} />}
          {item.kind === 'video' && <Text> </Text>}
          {item.kind === 'video' && <Button key="play" label={playing ? 'Pause (k)' : 'Play (k)'} hotkey="k" onPress={toggle} />}
          <Text> </Text>
          <Button key="close" label="Close (q)" hotkey="q" onPress={() => $.ui.close({ id: PANE })} />
        </Box>
        <Image key="frame" source={source} columns={columns} rows={rows} alt={item.caption} />
      </Box>
    )
  })
}
