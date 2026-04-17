# morphase

`morphase` is a local-first CLI for converting files, extracting content, downloading supported media, and running PDF or media operations through tools already installed on your machine.

## Install

```bash
npm install -g morphase
```

Morphase does not bundle backend binaries. After installing the CLI, run:

```bash
morphase doctor
```

That reports which backends are already available and which ones need an install.

## Quick Start

```bash
morphase --help
morphase convert notes.md notes.docx
morphase extract paper.pdf --to markdown
morphase fetch 'https://example.com/article' --to markdown
morphase backend install ffmpeg
```

## Docs

- Repository: [github.com/joeljstephen/morphase](https://github.com/joeljstephen/morphase)
- Architecture: [docs/architecture.md](https://github.com/joeljstephen/morphase/blob/main/docs/architecture.md)
- Route matrix: [docs/route-matrix.md](https://github.com/joeljstephen/morphase/blob/main/docs/route-matrix.md)
- Platform and package-manager handling: [docs/platform-and-package-manager-handling.md](https://github.com/joeljstephen/morphase/blob/main/docs/platform-and-package-manager-handling.md)
- Plugin authoring: [docs/plugin-authoring.md](https://github.com/joeljstephen/morphase/blob/main/docs/plugin-authoring.md)
