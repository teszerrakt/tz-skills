export type Media = {
  path: string
  caption: string
  kind: 'image' | 'video'
  // Pixels: the image's own size, or the frame size a video is decoded to.
  width: number
  height: number
  fps: number
  isLooped: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'show-media': { items: Shaped<Media[]>; index: number; isPlaying: boolean }
  }
}
