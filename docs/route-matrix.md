# Route Matrix

This is the reference for the built-in routes Morphase can plan today. It focuses on the backend Morphase prefers for each route, along with the caveats that matter in practice.

For architecture and planning details, see [architecture.md](architecture.md). For platform-aware install guidance, see [platform-and-package-manager-handling.md](platform-and-package-manager-handling.md).

Conventions used here:

- `Quality`: the plugin author's quality assessment
- `Offline`: whether the route can run without network access
- `Preferred backend`: what the planner will try first when that backend is installed and healthy

## Direct Routes

| Route | Preferred backend | Quality | Offline | Notes |
| --- | --- | --- | --- | --- |
| `markdown -> pdf` | `pandoc` | high | yes | Requires an external PDF engine such as Typst, WeasyPrint, wkhtmltopdf, or LaTeX |
| `markdown -> docx` | `pandoc` | high | yes |  |
| `markdown -> txt` | `pandoc` | high | yes |  |
| `html -> pdf` | `pandoc` | medium | yes | Requires an external PDF engine |
| `html -> markdown` | `pandoc` | high | yes | `markitdown` can also extract markdown when installed |
| `html -> docx` | `pandoc` | medium | yes |  |
| `docx -> pdf` | `libreoffice` | high | yes |  |
| `pptx -> pdf` | `libreoffice` | high | yes |  |
| `xlsx -> pdf` | `libreoffice` | high | yes |  |
| `odt -> pdf` | `libreoffice` | high | yes |  |
| `ods -> pdf` | `libreoffice` | high | yes |  |
| `odp -> pdf` | `libreoffice` | high | yes |  |
| `pdf -> docx` | `libreoffice` | medium | yes | Complex layouts may change |
| `jpg -> png` | `imagemagick` | high | yes |  |
| `png -> jpg` | `imagemagick` | high | yes |  |
| `webp -> png` | `imagemagick` | high | yes |  |
| `webp -> jpg` | `imagemagick` | high | yes |  |
| `heic -> jpg` | `imagemagick` | best_effort | yes | Requires HEIC delegate support in ImageMagick |
| `heic -> png` | `imagemagick` | best_effort | yes | Requires HEIC delegate support in ImageMagick |
| `jpg -> pdf` | `img2pdf` | high | yes | Lossless; supports multiple input images |
| `png -> pdf` | `img2pdf` | high | yes | Lossless; supports multiple input images |
| `pdf -> png` | `poppler` | high | yes | Renders the first PDF page to a PNG image |
| `pdf -> jpg` | `poppler` | high | yes | Renders the first PDF page to a JPEG image |
| `mp4 -> mp3` | `ffmpeg` | medium | yes | Lossy |
| `mov -> mp4` | `ffmpeg` | medium | yes |  |
| `mkv -> mp4` | `ffmpeg` | medium | yes |  |
| `wav -> mp3` | `ffmpeg` | medium | yes | Lossy |
| `mp3 -> wav` | `ffmpeg` | high | yes |  |
| `url -> markdown` | `trafilatura` | high | no | `summarize` is an optional alternative for markdown extraction |
| `url -> txt` | `trafilatura` | high | no |  |
| `youtube-url -> transcript` | `summarize` | high | no | Requires `summarize`; Morphase falls back to `ytdlp` when needed |
| `youtube-url -> mp4` | `ytdlp` | medium | no | Network required |
| `youtube-url -> mp3` | `ytdlp` | medium | no | Requires `ffmpeg` for MP3 extraction |
| `youtube-url -> subtitle` | `ytdlp` | medium | no | Downloads available subtitles |
| `media-url -> mp4` | `ytdlp` | medium | no | Covers YouTube and many other supported sites |
| `media-url -> mp3` | `ytdlp` | medium | no | Requires `ffmpeg` |
| `media-url -> transcript` | `ytdlp` | medium | no | Uses subtitle data when the source provides it |
| `mp3 -> transcript` | `whisper` | medium | yes | Local transcription |
| `wav -> transcript` | `whisper` | medium | yes | Local transcription |
| `mp4 -> transcript` | `whisper` | medium | yes | Local transcription |
| `mov -> transcript` | `whisper` | medium | yes | Local transcription |
| `mkv -> transcript` | `whisper` | medium | yes | Local transcription |

## Operations

| Operation | Backend | Quality | Offline | Notes |
| --- | --- | --- | --- | --- |
| `pdf merge` | `qpdf` | high | yes |  |
| `pdf split` | `qpdf` | high | yes |  |
| `pdf optimize` | `qpdf` | high | yes |  |
| `pdf extract-images` | `poppler` | medium | yes | Extracts embedded images with `pdfimages`; this is different from rendering pages |
| `jpg compress` | `jpegoptim` | high | yes |  |
| `png compress` | `optipng` | high | yes |  |
| `mp4 compress` | `ffmpeg` | medium | yes |  |
| `mov compress` | `ffmpeg` | medium | yes |  |
| `mkv compress` | `ffmpeg` | medium | yes |  |

## Curated Pipelines

When no direct backend can satisfy a route, Morphase can chain built-in backends through a temp workspace.

| Pipeline ID | Steps | Quality |
| --- | --- | --- |
| `markdown-to-pdf-via-docx` | `pandoc` (`markdown -> docx`) -> `libreoffice` (`docx -> pdf`) | medium |
| `html-to-pdf-via-docx` | `pandoc` (`html -> docx`) -> `libreoffice` (`docx -> pdf`) | medium |
| `docx-to-markdown-via-pdf` | `libreoffice` (`docx -> pdf`) -> `markitdown` (`pdf -> markdown`) | medium |
| `pdf-to-txt-via-markdown` | `markitdown` (`pdf -> markdown`) -> `pandoc` (`markdown -> txt`) | medium |

## Backend Selection Notes

- `youtube-url -> transcript`: `summarize` is preferred when installed and healthy; otherwise Morphase falls back to `ytdlp` subtitle extraction.
- `url -> markdown`: `trafilatura` is preferred; `summarize` is an optional alternative backend.
- `html -> markdown`: `pandoc` is preferred; `markitdown` can still serve as a lighter extraction backend.
- `pdf -> png` and `pdf -> jpg`: the direct route renders one page, not an entire image sequence.

## Inspecting Support On Your Machine

Morphase does not bundle these tools. Use the CLI to inspect what is installed and which hint applies to the current environment:

```bash
morphase backend list
morphase backend verify pandoc
morphase backend install poppler
morphase backend update pandoc
```

Useful backend IDs include:

- `pandoc`
- `libreoffice`
- `ffmpeg`
- `imagemagick`
- `qpdf`
- `poppler`
- `trafilatura`
- `ytdlp`
- `img2pdf`
- `markitdown`
- `whisper`
- `summarize`
- `jpegoptim`
- `optipng`
