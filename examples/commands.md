# Example Commands

```bash
morphase
morphase convert slides.pptx slides.pdf
morphase fetch https://example.com/post --to markdown
morphase pdf merge a.pdf b.pdf -o merged.pdf
morphase backend verify libreoffice

# YouTube and media URLs
morphase fetch "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --to transcript
morphase fetch "https://youtu.be/dQw4w9WgXcQ" --to mp4
morphase fetch "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --to mp3 -o podcast.mp3
morphase explain "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --to transcript
morphase doctor
morphase backend verify summarize
morphase backend verify ytdlp
morphase backend verify ffmpeg
```
