# Route Matrix

| Route | Preferred backend | Quality | Local-only | Optional |
| --- | --- | --- | --- | --- |
| `markdown -> pdf` | `pandoc` | high | yes | no |
| `markdown -> docx` | `pandoc` | high | yes | no |
| `html -> pdf` | `pandoc` | medium | yes | no |
| `html -> markdown` | `pandoc` | high | yes | no |
| `docx -> pdf` | `libreoffice` | high | yes | no |
| `pptx -> pdf` | `libreoffice` | high | yes | no |
| `xlsx -> pdf` | `libreoffice` | high | yes | no |
| `pdf -> markdown` | `markitdown` | medium | yes | yes |
| `pdf -> txt` | `markitdown` -> `pandoc` pipeline | medium | yes | no |
| `url -> markdown` | `trafilatura` | high | no | no |
| `jpg -> png` | `imagemagick` | high | yes | no |
| `mp4 -> mp3` | `ffmpeg` | medium | yes | no |
| `pdf merge` | `qpdf` | high | yes | no |
| `pdf split` | `qpdf` | high | yes | no |
| `youtube-url -> transcript` | `summarize`, `ytdlp` fallback | high/medium | no | both optional |
| `youtube-url -> mp4` | `ytdlp` | medium | no | yes |
| `youtube-url -> mp3` | `ytdlp` (requires `ffmpeg`) | medium | no | both optional |
| `youtube-url -> subtitle` | `ytdlp` | medium | no | yes |

## YouTube Route Backend Selection

For `youtube-url -> transcript`:
1. **summarize** (preferred) — if installed and healthy, provides high-quality transcript extraction
2. **yt-dlp** (fallback) — downloads auto-generated subtitles as a transcript approximation

For `youtube-url -> mp4`:
- **yt-dlp** — downloads and remuxes video to MP4

For `youtube-url -> mp3`:
- **yt-dlp** — extracts audio; requires ffmpeg for MP3 conversion

## Install Requirements

| Backend | macOS | Windows | Linux |
| --- | --- | --- | --- |
| summarize | `npm i -g @steipete/summarize` or `brew install summarize` | `npm i -g @steipete/summarize` | `npm i -g @steipete/summarize` |
| yt-dlp | `brew install yt-dlp` | `winget install yt-dlp.yt-dlp` | `sudo apt-get install yt-dlp` |
| ffmpeg | `brew install ffmpeg` | `winget install Gyan.FFmpeg` | `sudo apt-get install ffmpeg` |

summarize requires Node 22+.
