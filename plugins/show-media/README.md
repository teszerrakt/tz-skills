# show-media

A Claude Code mod that shows images, videos and GIFs in a pane beside the chat. Pictures are drawn with the kitty graphics protocol, so they are real pixels, not text art.

## Install

At the prompt of a Claude Code session:

```
/plugin install show-media --marketplace teszerrakt/tz-skills
```

Answer `y` to add the marketplace, then pick a scope.

## Requirements

- A terminal with the kitty graphics protocol: kitty or Ghostty. Not inside tmux, which does not pass images through.
- `ffmpeg`, `ffprobe` and `python3` on `PATH`, for video and GIF playback. Images need neither.
- Linux for video: decoded frames go through `/dev/shm`.

## Use

```
/show-media ~/Pictures/photo.png
/show-media ~/Downloads/clips              # every PNG, video and GIF in the folder
/show-media "~/My Pictures/a.png"          # quote paths with spaces
/show-media                                # reopen the last set
```

Type paths rather than pasting them: Claude Code turns a pasted image path into an attachment before the command sees it.

Claude can open the pane too, through the mod's `show_media` tool. A pane Claude opens shows only when the terminal is at least 144 columns wide; one you open with `/show-media` shows at any width.

## Keys

While the pane has the keyboard (`/show-media` gives it; otherwise click the pane or press `ctrl+x tab`):

| Key | Does |
| --- | --- |
| `p` | Previous item |
| `n` | Next item |
| `k` | Play or pause a video |
| `q` | Close the pane and stop playback |

## Formats

- Images: PNG only. A JPEG named `.jpg` will not draw; a PNG named `.jpg` will.
- Video: `.mp4`, `.m4v`, `.mkv`, `.webm`, `.mov`, `.avi` and `.gif`. Silent, scaled to at most 640 pixels wide and 24 frames a second. GIFs loop.
