# Route Matrix

## Stable Routes

| Route | Backend | Quality | Offline | Notes |
| --- | --- | --- | --- | --- |
| `markdown -> pdf` | `pandoc` | high | yes | Requires a PDF engine |
| `markdown -> docx` | `pandoc` | high | yes | |
| `html -> pdf` | `pandoc` | medium | yes | Requires a PDF engine |
| `html -> markdown` | `pandoc` | high | yes | |
| `docx -> pdf` | `libreoffice` | high | yes | |
| `pptx -> pdf` | `libreoffice` | high | yes | |
| `xlsx -> pdf` | `libreoffice` | high | yes | |
| `jpg -> png` | `imagemagick` | high | yes | |
| `png -> jpg` | `imagemagick` | high | yes | |
| `webp -> png` | `imagemagick` | high | yes | |
| `webp -> jpg` | `imagemagick` | high | yes | |
| `mp4 -> mp3` | `ffmpeg` | medium | yes | Lossy |
| `mov -> mp4` | `ffmpeg` | medium | yes | |
| `mkv -> mp4` | `ffmpeg` | medium | yes | |
| `wav -> mp3` | `ffmpeg` | medium | yes | Lossy |
| `mp3 -> wav` | `ffmpeg` | high | yes | |
| `url -> markdown` | `trafilatura` | high | no | Network required |
| `url -> txt` | `trafilatura` | high | no | Network required |
| `youtube-url -> mp4` | `ytdlp` | medium | no | Network required |
| `youtube-url -> mp3` | `ytdlp` | medium | no | Requires ffmpeg |
| `media-url -> mp4` | `ytdlp` | medium | no | 1800+ sites |
| `media-url -> mp3` | `ytdlp` | medium | no | Requires ffmpeg |
| `pdf merge` | `qpdf` | high | yes | |
| `pdf split` | `qpdf` | high | yes | |
| `pdf optimize` | `qpdf` | high | yes | |

## Experimental Routes

| Route | Backend | Quality | Offline | Notes |
| --- | --- | --- | --- | --- |
| `pdf -> markdown` | `markitdown` | medium | yes | Experimental plugin |
| `pdf -> txt` | `markitdown` -> `pandoc` pipeline | medium | yes | Two-step pipeline |
| `youtube-url -> transcript` | `summarize` / `ytdlp` | high/medium | no | summarize preferred, ytdlp fallback |
| `media-url -> transcript` | `ytdlp` | medium | no | Not all platforms provide subtitles |
| `youtube-url -> subtitle` | `ytdlp` | medium | no | |
| `jpg compress` | `jpegoptim` | high | yes | Experimental plugin |
| `png compress` | `optipng` | high | yes | Experimental plugin |
| `heic -> jpg` | `imagemagick` | best_effort | yes | Requires delegate support |
| `heic -> png` | `imagemagick` | best_effort | yes | Requires delegate support |
| `pdf -> docx` | `libreoffice` | medium | yes | Complex formatting may differ |

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
| pandoc | `brew install pandoc` | `winget install JohnMacFarlane.Pandoc` | `sudo apt-get install pandoc` |
| libreoffice | `brew install --cask libreoffice` | `winget install TheDocumentFoundation.LibreOffice` | `sudo apt-get install libreoffice` |
| ffmpeg | `brew install ffmpeg` | `winget install Gyan.FFmpeg` | `sudo apt-get install ffmpeg` |
| imagemagick | `brew install imagemagick` | `winget install ImageMagick.ImageMagick` | `sudo apt-get install imagemagick` |
| qpdf | `brew install qpdf` | `winget install QPDF.QPDF` | `sudo apt-get install qpdf` |
| trafilatura | `pip install trafilatura` | `py -m pip install trafilatura` | `pip install trafilatura` |
| yt-dlp | `brew install yt-dlp` | `winget install yt-dlp.yt-dlp` | `sudo apt-get install yt-dlp` |
| summarize | `npm i -g @steipete/summarize` | `npm i -g @steipete/summarize` | `npm i -g @steipete/summarize` |
| markitdown | `pip install 'markitdown[all]'` | `py -m pip install markitdown[all]` | `pip install 'markitdown[all]'` |
| jpegoptim | `brew install jpegoptim` | manual / WSL | `sudo apt-get install jpegoptim` |
| optipng | `brew install optipng` | manual / WSL | `sudo apt-get install optipng` |
| whisper | `pip install openai-whisper` | `py -m pip install openai-whisper` | `pip install openai-whisper` |

summarize requires Node 22+.
