# Security Policy

## Reporting a vulnerability

**Please do not file public GitHub issues for security vulnerabilities.**

To report a vulnerability, use one of these channels, in order of preference:

1. **GitHub private vulnerability reporting** on this repository, if enabled. This is the preferred channel.
2. **Contact the maintainers privately** through the channel documented on the repository (for example, a private security contact listed in the repo's README or GitHub profile).

Please include enough detail for us to reproduce the issue, along with any impact assessment you've done.

## Scope

Morphase is a CLI that shells out to external tools (FFmpeg, Pandoc, yt-dlp, LibreOffice, etc.). Vulnerabilities in those tools should be reported upstream to the respective projects.

In-scope for Morphase:

- Command injection through user-supplied input (file paths, URLs, CLI flags).
- Path traversal in output path handling.
- Arbitrary code execution through malicious config files.
- Unsafe defaults that cause Morphase to run untrusted code without user consent.

Out of scope:

- Bugs in third-party binaries Morphase invokes.
- Denial-of-service caused by very large or adversarial inputs to those external tools.

## Supported versions

Only the latest release is supported. Please upgrade before reporting issues where possible.
