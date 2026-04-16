# morphase

`morphase` is a CLI-first, local-first conversion router for files, media, PDFs, and web content.

It stays small and delegates the heavy lifting to tools already on your machine such as FFmpeg, Pandoc, LibreOffice, qpdf, and ImageMagick.

## Install

From a release tarball or local package:

```bash
npm install -g /path/to/morphase-<version>.tgz
```

From the npm registry after public release:

```bash
npm install -g morphase
```

## Quick start

```bash
morphase --help
morphase doctor
morphase convert notes.md notes.docx
morphase fetch https://example.com/article --to markdown
```

## More information

- Repository: [github.com/joeljstephen/morphase](https://github.com/joeljstephen/morphase)
- Architecture: [docs/architecture.md](https://github.com/joeljstephen/morphase/blob/main/docs/architecture.md)
- Route matrix: [docs/route-matrix.md](https://github.com/joeljstephen/morphase/blob/main/docs/route-matrix.md)
- Plugin authoring: [docs/plugin-authoring.md](https://github.com/joeljstephen/morphase/blob/main/docs/plugin-authoring.md)
