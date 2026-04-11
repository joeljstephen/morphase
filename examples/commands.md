# Example Commands

```bash
muxory
muxory convert slides.pptx slides.pdf
muxory fetch https://example.com/post --to markdown
muxory pdf merge a.pdf b.pdf -o merged.pdf
muxory backend verify libreoffice

# YouTube and media URLs
muxory fetch "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --to transcript
muxory fetch "https://youtu.be/dQw4w9WgXcQ" --to mp4
muxory fetch "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --to mp3 -o podcast.mp3
muxory explain "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --to transcript
muxory doctor
muxory backend verify summarize
muxory backend verify ytdlp
muxory backend verify ffmpeg
```
