# Security Policy

## Reporting A Vulnerability

Do not file public GitHub issues for security vulnerabilities.

Please report them through one of these private channels:

1. GitHub private vulnerability reporting for this repository, if enabled
2. A private maintainer contact listed on the repository or maintainer profile

Include enough detail to reproduce the issue and describe the expected impact.

## Scope

Morphase is a local CLI that plans work and shells out to external tools such as FFmpeg, Pandoc, LibreOffice, Poppler, yt-dlp, and ImageMagick. Vulnerabilities in those tools should usually be reported upstream to their own maintainers.

Issues that are in scope for Morphase include:

- command injection through user-controlled inputs
- unsafe path handling or path traversal in output and temp-file flows
- execution of unintended commands through install or update delegation
- unsafe config handling
- user-facing defaults that run system-changing commands without clear consent

The codebase already tries to reduce those risks by:

- using structured commands instead of shell strings for delegated install or update actions
- keeping package-manager delegation opt-in through `allowPackageManagerDelegation`
- requiring an interactive terminal before delegated installs or updates can run

Examples that are usually out of scope for Morphase itself:

- vulnerabilities in third-party backends that Morphase invokes
- unsupported input files that crash an external backend
- content or download restrictions enforced by remote platforms

## Supported Versions

Please report issues against the latest release or current `main` when possible.
