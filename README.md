npm page: https://www.npmjs.com/package/web-subtitle-renderer

> [NOTE!]
> this is a side project to me so don't expect frequent updates and whatnot. this project updates as long as [Sync-Player](https://github.com/Lakunake/Minecraft-WebDisplays-Sync-Player/) updates and will get delayed updates compared to the embedded version of this in Sync-Player, newest version of this will always be the embedded version

# Web Subtitle Renderer

A lightweight, zero-dependency VTT and ASS (Advanced Substation Alpha) subtitle renderer for standard HTML5 `<video>` elements. Made to be used in Sync-Player originally.

## Features

- **Format Support**: Handles both standard WebVTT and complex ASS/SSA formats.
- **Styling**: Supports ASS styles including fonts, colors (with alpha), outlines, shadows, and margins.
- **Smart Resizing**: Automatically calculates actual video content dimensions to handle letterboxing/pillarboxing correctly.
- **Advanced ASS Support**:
    - **Positioning**: Alignment (1-9) and Absolute Positioning (`\pos`).
    - **Animations**: `\fad` (Fade), `\move` (Movement).
    - **3D Rotation**: `\frx`, `\fry`, `\frz`.
    - **Karaoke**: `\k` (Basic timing/highlighting framework).
    - **Styling Overrides**: `\blur`, `\bord`, `\shad`, `\fs`, `\fn`, `\c` (Color).
- **Zero Dependencies**: Pure vanilla JavaScript module.

## Smart Video Scaling

Unlike simple overlays that stretch to fit the `div`, this renderer calculates the **actual video content aspect ratio** vs the **container aspect ratio**. 

It automatically resizes and positions the overlay to match the video content exactly, preventing subtitles from floating in black bars or being misaligned when letterboxing occurs.

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
