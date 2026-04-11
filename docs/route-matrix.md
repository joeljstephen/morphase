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
| `pdf -> markdown` | `markitdown`, `docling` | medium/high | yes | yes |
| `pdf -> txt` | `markitdown` -> `pandoc` pipeline | medium | yes | no |
| `url -> markdown` | `trafilatura`, `jina` | high/medium | no | `jina` optional |
| `jpg -> png` | `imagemagick` | high | yes | no |
| `mp4 -> mp3` | `ffmpeg` | medium | yes | no |
| `pdf merge` | `qpdf` | high | yes | no |
| `pdf split` | `qpdf` | high | yes | no |
