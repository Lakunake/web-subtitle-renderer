npm page: https://www.npmjs.com/package/web-subtitle-renderer
# Web Subtitle Renderer

A lightweight, zero-dependency VTT and ASS (Advanced Substation Alpha) subtitle renderer for standard HTML5 `<video>` elements. Made to be used in [Sync-Player](https://github.com/Lakunake/Minecraft-WebDisplays-Sync-Player/) originally.

## Features

- **Format Support**: Handles both standard WebVTT and complex ASS/SSA formats.
- **Styling**: Supports ASS styles including fonts, colors (with alpha), outlines, shadows, and margins.
- **Positioning**: Supports ASS alignment (numpad mapping 1-9) and absolute positioning (`\pos` overrides).
- **Zero Dependencies**: Pure vanilla JavaScript.
- **Responsive**: Automatically scales subtitles based on video container resolution.

## Installation

```bash
npm install web-subtitle-renderer
```

## Usage

### 1. Requirements

You need a video element and an overlay container (usually a `div` positioned over the video).

```html
<div id="video-container" style="position: relative;">
    <video id="my-video" src="video.mp4"></video>
    <div id="subtitle-overlay" style="position: absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;"></div>
</div>
```

### 2. Implementation

```javascript
import SubtitleRenderer from 'web-subtitle-renderer';

const video = document.getElementById('my-video');
const overlay = document.getElementById('subtitle-overlay');

const renderer = new SubtitleRenderer(video, overlay);

// Load a track
renderer.loadTrack('path/to/subtitles.ass', 'ass'); // or 'vtt'

// Connect updates
video.addEventListener('timeupdate', () => renderer.update());
window.addEventListener('resize', () => renderer.resize());
```

## CSS Styling

For the best experience, add these basic styles to your client:

```css
.subtitle-line {
    position: absolute;
    pointer-events: none;
    text-shadow: 1px 1px 2px black; /* Fallback */
    color: white;
    font-family: sans-serif;
}

.ass-style {
    /* ASS styles are applied dynamically by the renderer */
}
```

## License

MIT
