# Legal Notes

morphase is a local conversion router. It is not a DRM bypass tool, a rights-granting tool, or a downloader-first product.

Important boundaries:

- file conversion is local-first by default
- network-backed plugins must be explicit
- yt-dlp style fetch routes are optional and user-responsibility
- morphase does not silently upload files

## YouTube and media downloads

YouTube download routes (`youtube-url -> mp4`, `youtube-url -> mp3`, `youtube-url -> transcript`) are powered by optional plugins (yt-dlp, summarize). These routes:

- are opt-in and require explicit backend installation
- do not grant rights to content you do not own or have license to use
- are intended for personal use with content you have legitimate access to
- may be affected by platform terms of service changes

Users are solely responsible for ensuring their use of these routes complies with applicable laws and the terms of service of the platforms involved.
