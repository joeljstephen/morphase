# Security Policy

## Reporting a Vulnerability

Do not file public issues for security vulnerabilities.

Email security concerns to the project maintainers directly or use GitHub's
private vulnerability reporting feature if enabled on the repository.

## Scope

Morphase shells out to external tools (FFmpeg, yt-dlp, Pandoc, etc.).
Vulnerabilities in those tools should be reported to their respective projects.

Morphase-specific concerns include:
- Command injection through user input
- Path traversal in output path handling
- Arbitrary code execution through malicious config files

## Supported Versions

Only the latest release is supported.
