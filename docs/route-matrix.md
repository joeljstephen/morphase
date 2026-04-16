# Route Matrix

This is the reference doc for every route Morphase knows about. It lists both stable and experimental routes, the backend that handles each, and a summary of install commands.

For the high-level pitch and quick examples, see the [README](../README.md). For how routes are resolved, see [architecture.md](architecture.md).

A few conventions:

- **Quality**: the plugin author's honest assessment of output fidelity. `high` ≈ production-ready, `medium` ≈ good enough for most cases, `best_effort` ≈ may degrade on tricky inputs.
- **Offline**: `yes` means the route works without network access. `no` means it fetches content from the internet.
- **Notes**: any extra dependencies or caveats.

## Stable routes

| Route                 | Backend        | Quality | Offline | Notes                                                                          |
| --------------------- | -------------- | ------- | ------- | ------------------------------------------------------------------------------ |
| `markdown -> pdf`     | `pandoc`       | high    | yes     | Requires a PDF engine (typst, wkhtmltopdf, weasyprint, or LaTeX)               |
| `markdown -> docx`    | `pandoc`       | high    | yes     |                                                                                |
| `markdown -> txt`     | `pandoc`       | high    | yes     |                                                                                |
| `html -> pdf`         | `pandoc`       | medium  | yes     | Requires a PDF engine                                                          |
| `html -> markdown`    | `pandoc`       | high    | yes     |                                                                                |
| `html -> docx`        | `pandoc`       | medium  | yes     |                                                                                |
| `docx -> pdf`         | `libreoffice`  | high    | yes     |                                                                                |
| `pptx -> pdf`         | `libreoffice`  | high    | yes     |                                                                                |
| `xlsx -> pdf`         | `libreoffice`  | high    | yes     |                                                                                |
| `odt -> pdf`          | `libreoffice`  | high    | yes     |                                                                                |
| `ods -> pdf`          | `libreoffice`  | high    | yes     |                                                                                |
| `odp -> pdf`          | `libreoffice`  | high    | yes     |                                                                                |
| `jpg -> png`          | `imagemagick`  | high    | yes     |                                                                                |
| `png -> jpg`          | `imagemagick`  | high    | yes     |                                                                                |
| `webp -> png`         | `imagemagick`  | high    | yes     |                                                                                |
| `webp -> jpg`         | `imagemagick`  | high    | yes     |                                                                                |
| `jpg -> pdf`          | `img2pdf`      | high    | yes     | Lossless; supports multiple images in one command                              |
| `png -> pdf`          | `img2pdf`      | high    | yes     | Lossless; supports multiple images in one command                              |
| `pdf -> png`          | `poppler`      | high    | yes     | Renders each page as a separate PNG                                            |
| `pdf -> jpg`          | `poppler`      | high    | yes     | Renders each page as a separate JPEG                                           |
| `mp4 -> mp3`          | `ffmpeg`       | medium  | yes     | Lossy                                                                          |
| `mov -> mp4`          | `ffmpeg`       | medium  | yes     |                                                                                |
| `mkv -> mp4`          | `ffmpeg`       | medium  | yes     |                                                                                |
| `wav -> mp3`          | `ffmpeg`       | medium  | yes     | Lossy                                                                          |
| `mp3 -> wav`          | `ffmpeg`       | high    | yes     |                                                                                |
| `pdf merge`           | `qpdf`         | high    | yes     |                                                                                |
| `pdf split`           | `qpdf`         | high    | yes     |                                                                                |
| `pdf optimize`        | `qpdf`         | high    | yes     |                                                                                |
| `url -> markdown`     | `trafilatura`  | high    | no      | Network required                                                               |
| `url -> txt`          | `trafilatura`  | high    | no      | Network required                                                               |
| `youtube-url -> mp4`  | `ytdlp`        | medium  | no      | Network required                                                               |
| `youtube-url -> mp3`  | `ytdlp`        | medium  | no      | Requires ffmpeg                                                                |
| `media-url -> mp4`    | `ytdlp`        | medium  | no      | 1800+ sites                                                                    |
| `media-url -> mp3`    | `ytdlp`        | medium  | no      | Requires ffmpeg                                                                |

## Experimental routes

These work but may have rough edges, narrower platform support, or backends that aren't installed by default.

| Route                         | Backend                         | Quality       | Offline | Notes                                                 |
| ----------------------------- | ------------------------------- | ------------- | ------- | ----------------------------------------------------- |
| `pdf extract-images`          | `poppler`                       | medium        | yes     | Extracts embedded images from a PDF                   |
| `pdf -> markdown`             | `markitdown`                    | medium        | yes     | Also handles docx, pptx, xlsx, html                   |
| `docx -> markdown`            | `markitdown`                    | medium        | yes     |                                                       |
| `pptx -> markdown`            | `markitdown`                    | medium        | yes     |                                                       |
| `xlsx -> markdown`            | `markitdown`                    | medium        | yes     |                                                       |
| `html -> markdown`            | `markitdown`                    | medium        | yes     | Fallback if pandoc is not installed                   |
| `pdf -> txt`                  | `markitdown` → `pandoc`         | medium        | yes     | Two-step pipeline                                     |
| `pdf -> docx`                 | `libreoffice`                   | medium        | yes     | Complex formatting may differ                         |
| `youtube-url -> transcript`   | `summarize` / `ytdlp`           | high / medium | no      | `summarize` preferred, `ytdlp` fallback               |
| `media-url -> transcript`     | `ytdlp`                         | medium        | no      | Not all platforms provide subtitles                   |
| `youtube-url -> subtitle`     | `ytdlp`                         | medium        | no      |                                                       |
| `mp3 -> transcript`           | `whisper`                       | medium        | yes     | Local transcription                                   |
| `wav -> transcript`           | `whisper`                       | medium        | yes     | Local transcription                                   |
| `mp4 -> transcript`           | `whisper`                       | medium        | yes     | Local transcription                                   |
| `mov -> transcript`           | `whisper`                       | medium        | yes     | Local transcription                                   |
| `mkv -> transcript`           | `whisper`                       | medium        | yes     | Local transcription                                   |
| `url -> markdown`             | `summarize`                     | high          | no      | Alternative to `trafilatura`                          |
| `jpg compress`                | `jpegoptim`                     | high          | yes     |                                                       |
| `png compress`                | `optipng`                       | high          | yes     |                                                       |
| `heic -> jpg`                 | `imagemagick`                   | best_effort   | yes     | Requires HEIC delegate support                        |
| `heic -> png`                 | `imagemagick`                   | best_effort   | yes     | Requires HEIC delegate support                        |

## Multi-step pipelines

When no single plugin handles a route directly, Morphase chains plugins. Each step runs in a shared temp dir; the intermediate output becomes the input to the next step.

| Pipeline ID                 | Steps                                               | Quality |
| --------------------------- | --------------------------------------------------- | ------- |
| `markdown-to-pdf-via-docx`  | pandoc (md→docx) → libreoffice (docx→pdf)           | medium  |
| `html-to-pdf-via-docx`      | pandoc (html→docx) → libreoffice (docx→pdf)         | medium  |
| `docx-to-markdown-via-pdf`  | libreoffice (docx→pdf) → markitdown (pdf→md)        | medium  |
| `pdf-to-txt-via-markdown`   | markitdown (pdf→md) → pandoc (md→txt)               | medium  |

## YouTube backend selection

For `youtube-url -> transcript`:

1. **`summarize`** (preferred) — high-quality transcript extraction when installed and healthy.
2. **`yt-dlp`** (fallback) — downloads auto-generated subtitles as a transcript approximation.

For `youtube-url -> mp4`:

- **`yt-dlp`** — downloads and remuxes video to MP4.

For `youtube-url -> mp3`:

- **`yt-dlp`** — extracts audio (requires ffmpeg for MP3 conversion).

## Install commands by backend

Morphase doesn't bundle any of these tools. Install the ones you need through your system package manager. `morphase doctor` will tell you what's missing and give you the right command for your OS.

| Backend       | macOS                                         | Windows                                               | Linux (Ubuntu / Debian)                           |
| ------------- | --------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| `pandoc`      | `brew install pandoc`                         | `winget install JohnMacFarlane.Pandoc`                | `sudo apt-get install pandoc`                     |
| `libreoffice` | `brew install --cask libreoffice`             | `winget install TheDocumentFoundation.LibreOffice`    | `sudo apt-get install libreoffice`                |
| `ffmpeg`      | `brew install ffmpeg`                         | `winget install Gyan.FFmpeg`                          | `sudo apt-get install ffmpeg`                     |
| `imagemagick` | `brew install imagemagick`                    | `winget install ImageMagick.ImageMagick`              | `sudo apt-get install imagemagick`                |
| `qpdf`        | `brew install qpdf`                           | `winget install QPDF.QPDF`                            | `sudo apt-get install qpdf`                       |
| `poppler`     | `brew install poppler`                        | `winget install poppler`                              | `sudo apt-get install poppler-utils`              |
| `trafilatura` | `pip install trafilatura`                     | `py -m pip install trafilatura`                       | `pip install trafilatura`                         |
| `yt-dlp`      | `brew install yt-dlp`                         | `winget install yt-dlp.yt-dlp`                        | `sudo apt-get install yt-dlp`                     |
| `img2pdf`     | `pip install img2pdf`                         | `py -m pip install img2pdf`                           | `pip install img2pdf`                             |
| `markitdown`  | `pip install 'markitdown[all]'`               | `py -m pip install markitdown[all]`                   | `pip install 'markitdown[all]'`                   |
| `whisper`     | `pip install openai-whisper`                  | `py -m pip install openai-whisper`                    | `pip install openai-whisper`                      |
| `jpegoptim`   | `brew install jpegoptim`                      | manual / WSL                                          | `sudo apt-get install jpegoptim`                  |
| `optipng`     | `brew install optipng`                        | manual / WSL                                          | `sudo apt-get install optipng`                    |
| `summarize`   | `npm i -g @steipete/summarize`                | `npm i -g @steipete/summarize`                        | `npm i -g @steipete/summarize`                    |

`summarize` requires Node 22+.
