export default class SubtitleRenderer {
    constructor(videoElement, overlayElement) {
        this.video = videoElement;
        this.overlay = overlayElement;
        this.cues = [];
        this.activeCues = [];
        this.format = 'vtt'; // 'vtt' or 'ass'
        this.assParams = { playResX: 384, playResY: 288 }; // Default ASS resolution
        this.styles = {}; // Map of style names to style objects
        this.isEnabled = false;

        // Bind methods
        this.update = this.update.bind(this);
        this.resize = this.resize.bind(this);
    }

    async loadTrack(url, format = 'vtt') {
        try {
            console.log(`[SubtitleRenderer] Fetching: ${url}`);
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch track');
            const text = await res.text();

            this.format = format;
            this.cues = [];
            this.styles = {};

            if (format === 'ass') {
                this.parseASS(text);
            } else {
                this.parseVTT(text);
            }

            this.isEnabled = true;
            this.update(); // Initial render
            this.resize(); // Initial resize
            console.log(`[Subtitle] Loaded ${this.cues.length} cues (${format})`);

            // Optional: Dispatch event or call global showTemporaryMessage if available
            // We verify if function exists in global scope, as this library might be used elsewhere
            if (typeof window.showTemporaryMessage === 'function') {
                window.showTemporaryMessage(`Subtitles loaded: ${this.cues.length} lines`, 3000);
            }
        } catch (e) {
            console.error('[Subtitle] Error loading track:', e);
            this.disable();
        }
    }

    disable() {
        this.isEnabled = false;
        this.cues = [];
        this.activeCues = [];
        this.overlay.innerHTML = '';
    }

    parseVTT(text) {
        const lines = text.split(/\r?\n/);
        let i = 0;

        // Skip header
        if (lines[0].startsWith('WEBVTT')) i++;

        while (i < lines.length) {
            let line = lines[i].trim();

            // Skip empty lines or notes
            if (!line || line.startsWith('NOTE')) {
                i++;
                continue;
            }

            // Check for Cue Identifier (optional)
            if (!line.includes('-->')) {
                i++; // Skip identifier line
                if (i >= lines.length) break;
                line = lines[i].trim();
            }

            // Parse Timing: 00:00:00.000 --> 00:00:05.000
            if (line.includes('-->')) {
                const parts = line.split('-->');
                const start = this.parseTime(parts[0].trim());
                const end = this.parseTime(parts[1].trim());

                // Collect text payload
                let payload = [];
                i++;
                while (i < lines.length && lines[i].trim() !== '') {
                    payload.push(lines[i]); // Keep html tags for now
                    i++;
                }

                this.cues.push({
                    start,
                    end,
                    text: payload.join('<br>'),
                    html: payload.join('<br>').replace(/<v [^>]+>/g, '').replace(/<\/v>/g, ''), // Basic strip of voice tags
                    format: 'vtt'
                });
            } else {
                i++;
            }
        }
    }

    parseASS(text) {
        const lines = text.split(/\r?\n/);
        let section = '';
        const formatOrder = {}; // For Events
        const styleFormatOrder = {}; // For Styles

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            if (line.startsWith('[')) {
                section = line;
                continue;
            }

            if (section === '[Script Info]') {
                if (line.startsWith('PlayResX:')) this.assParams.playResX = parseInt(line.split(':')[1]);
                if (line.startsWith('PlayResY:')) this.assParams.playResY = parseInt(line.split(':')[1]);
            }
            else if (section === '[V4+ Styles]' || section === '[V4 Styles]') {
                if (line.startsWith('Format:')) {
                    const parts = line.substring(7).split(',').map(s => s.trim());
                    parts.forEach((p, idx) => styleFormatOrder[p] = idx);
                } else if (line.startsWith('Style:')) {
                    const parts = line.substring(6).split(','); // Styles can contain commas in font names? rarely.
                    // Better split implementation handling quoted strings if needed, but standard ASS usually CSV
                    const style = {};

                    // Map parts to properties
                    for (const [key, idx] of Object.entries(styleFormatOrder)) {
                        if (idx < parts.length) style[key] = parts[idx].trim();
                    }

                    this.styles[style.Name] = style;
                }
            }
            else if (section === '[Events]') {
                if (line.startsWith('Format:')) {
                    const parts = line.substring(7).split(',').map(s => s.trim());
                    parts.forEach((p, idx) => formatOrder[p] = idx);
                } else if (line.startsWith('Dialogue:')) {
                    if (!formatOrder['Start'] || !formatOrder['End'] || !formatOrder['Text']) continue;

                    // Dialogue: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
                    // We must be careful because "Text" is the last field and can contain commas.

                    // Heuristic: Find the Nth comma where N is the index of 'Text'
                    // Actually, formatOrder['Text'] is the last index.
                    // So we split by comma limited to the number of fields - 1

                    const numFields = Object.keys(formatOrder).length;
                    // ASS lines: Key: v1, v2, v3, ..., "Text, with, commas"

                    // Find first colon
                    const firstColon = line.indexOf(':');
                    const content = line.substring(firstColon + 1).trim();

                    // Custom csv split that respects the last field being free-form
                    const values = [];
                    let currentVal = '';
                    let commaCount = 0;
                    let targetCommaCount = numFields - 1;

                    // Optimization: Standard JS split doesn't support "split N times".
                    // We can find the Nth comma position.
                    let lastCommaIndex = -1;
                    let foundCommas = 0;

                    for (let i = 0; i < content.length; i++) {
                        if (content[i] === ',') {
                            foundCommas++;
                            if (foundCommas === targetCommaCount) {
                                lastCommaIndex = i;
                                break;
                            }
                        }
                    }

                    const metaPart = content.substring(0, lastCommaIndex);
                    const textPart = content.substring(lastCommaIndex + 1);
                    const metaValues = metaPart.split(',').map(s => s.trim());

                    // Construct event object
                    const event = {};
                    // Map meta values
                    const formatKeys = Object.keys(formatOrder).sort((a, b) => formatOrder[a] - formatOrder[b]);

                    for (let i = 0; i < targetCommaCount; i++) {
                        if (i < metaValues.length) {
                            event[formatKeys[i]] = metaValues[i];
                        }
                    }
                    event['Text'] = textPart;

                    const start = this.parseASSTime(event['Start']);
                    const end = this.parseASSTime(event['End']);

                    if (isNaN(start) || isNaN(end)) continue;

                    // Clean up text
                    let rawText = event['Text'];

                    // Handle override tags
                    // We will extract strictly position and alignment for now, simplify the rest
                    // Complex rendering requires drawing to Canvas or generating complex DOM.
                    // We will use DOM for now.

                    const overrides = this.parseOverrides(rawText);
                    const cleanText = rawText.replace(/{[^}]+}/g, '').replace(/\\N/g, '<br>').replace(/\\n/g, ' ');

                    this.cues.push({
                        start,
                        end,
                        text: cleanText,
                        rawText: rawText,
                        styleName: event['Style'],
                        overrides: overrides,
                        format: 'ass'
                    });
                }
            }
        }
    }

    parseOverrides(text) {
        const overrides = {};

        // Check for \pos(x,y)
        const posMatch = text.match(/\\pos\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
        if (posMatch) {
            overrides.pos = { x: parseFloat(posMatch[1]), y: parseFloat(posMatch[2]) };
        }

        // Check for \an(1-9) - Alignment (numpad)
        const anMatch = text.match(/\\an(\d)/);
        if (anMatch) {
            overrides.alignment = parseInt(anMatch[1]);
        }

        // Check for \c&HBBGGRR& - Color (Primary)
        const cMatch = text.match(/\\c&H([0-9a-fA-F]+)&/);
        if (cMatch) {
            overrides.color = this.assColorToCss(cMatch[1]);
        }

        return overrides;
    }

    parseTime(timeStr) {
        // 00:00:05.123 or 00:05.123
        const parts = timeStr.trim().split(':');
        let seconds = 0;
        if (parts.length === 3) {
            seconds += parseInt(parts[0]) * 3600;
            seconds += parseInt(parts[1]) * 60;
            seconds += parseFloat(parts[2]);
        } else if (parts.length === 2) {
            seconds += parseInt(parts[0]) * 60;
            seconds += parseFloat(parts[1]);
        }
        return seconds;
    }

    parseASSTime(timeStr) {
        // 0:00:05.12
        return this.parseTime(timeStr);
    }

    assColorToCss(assColor) {
        // ASS color is &HBBGGRR (optionally &HAABBGGRR)
        // We stripped &H and & already in regex usually, or raw value
        let hex = assColor.replace(/&H|&/g, '');

        // Pad to 6 or 8 chars
        while (hex.length < 6) hex = '0' + hex;

        // Alpha?
        let a = 1;
        if (hex.length === 8) {
            // First 2 bytes are alpha
            const alphaHex = hex.substring(0, 2);
            const alphaVal = parseInt(alphaHex, 16);
            // ASS Alpha: 00 = Opaque, FF = Transparent
            a = 1 - (alphaVal / 255);
            hex = hex.substring(2);
        }

        const b = hex.substring(0, 2);
        const g = hex.substring(2, 4);
        const r = hex.substring(4, 6);

        return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${a.toFixed(2)})`;
    }

    update() {
        if (!this.isEnabled) return;

        const time = this.video.currentTime;
        const active = this.cues.filter(cue => time >= cue.start && time <= cue.end);

        // Simple diff check (avoid redraw if same cues)
        // Use rawText for comparison to capture override changes if they were dynamic (rare)
        const activeKeys = active.map(c => c.rawText + c.start).join('|');
        const currentKeys = this.activeCues.map(c => c.rawText + c.start).join('|');

        if (activeKeys !== currentKeys) {
            this.activeCues = active;
            this.render();
        }
    }

    render() {
        this.overlay.innerHTML = '';
        if (this.activeCues.length === 0) return;

        const containerWidth = this.video.clientWidth || window.innerWidth;
        const containerHeight = this.video.clientHeight || window.innerHeight;

        // Calculate scaling factor
        // ASS coordinates are based on PlayResX/Y
        // We scale everything to fit the current video container
        let scaleX = 1;
        let scaleY = 1;

        if (this.format === 'ass' && this.assParams.playResX) {
            scaleX = containerWidth / this.assParams.playResX;
            // Should we preserve aspect ratio or stretch? ASS usually assumes stretch if not specified otherwise
            scaleY = containerHeight / this.assParams.playResY;

            // Most renderers use one scale factor for fonts to avoid distortion, usually based on Height or Width
            // We'll use Y for font sizes
        }

        this.activeCues.forEach(cue => {
            const div = document.createElement('div');

            if (cue.format === 'vtt') {
                div.className = 'subtitle-line vtt-style';
                div.innerHTML = cue.text;
            } else {
                // ASS Rendering
                div.className = 'subtitle-line ass-style';
                div.innerHTML = cue.text;

                // Apply Styles
                const style = this.styles[cue.styleName] || this.styles['Default'] || {};

                // Font params
                let fontSize = parseInt(style.Fontsize) || 20;
                const color = style.PrimaryColour ? this.assColorToCss(style.PrimaryColour) : 'white';
                const outlineColor = style.OutlineColour ? this.assColorToCss(style.OutlineColour) : 'black';
                const shadowColor = style.BackColour ? this.assColorToCss(style.BackColour) : 'rgba(0,0,0,0.5)';
                const bold = style.Bold === '-1' || style.Bold === '1';
                const italic = style.Italic === '-1' || style.Italic === '1';

                // Positioning
                // Default alignment
                let alignment = parseInt(style.Alignment) || 2; // Default bottom-center

                // Overrides
                if (cue.overrides) {
                    if (cue.overrides.alignment) alignment = cue.overrides.alignment;
                    if (cue.overrides.pos) {
                        // Absolute positioning (Explicit)
                        div.style.position = 'absolute';
                        div.style.left = (cue.overrides.pos.x * scaleX) + 'px';
                        div.style.top = (cue.overrides.pos.y * scaleY) + 'px';
                        this.applyAlignmentTransform(div, alignment);

                        // Apply color override if present
                        if (cue.overrides.color) div.style.color = cue.overrides.color;
                        else div.style.color = color;
                    } else {
                        // Flex/Standard Alignment with Overrides
                        this.applyFlexAlignment(div, alignment, style, scaleX, scaleY);
                        if (cue.overrides.color) div.style.color = cue.overrides.color;
                        else div.style.color = color;
                    }
                } else {
                    // No overrides - Standard Alignment
                    div.style.color = color;
                    this.applyFlexAlignment(div, alignment, style, scaleX, scaleY);
                }

                // Font Styling
                div.style.fontSize = (fontSize * scaleY) + 'px'; // Scale font by Y
                div.style.fontFamily = style.Fontname || 'Arial, sans-serif';
                if (bold) div.style.fontWeight = 'bold';
                if (italic) div.style.fontStyle = 'italic';

                // Outline/Shadow
                const outlineWidth = (parseInt(style.Outline) || 1) * scaleX;
                // CSS text-stroke is non-standard but widely supported. Text-shadow is safer.
                // Simulating outline with text-shadow
                if (outlineWidth > 0) {
                    const o = outlineWidth;
                    const c = outlineColor;
                    div.style.textShadow = `-${o}px -${o}px 0 ${c}, ${o}px -${o}px 0 ${c}, -${o}px ${o}px 0 ${c}, ${o}px ${o}px 0 ${c}`;
                }
            }

            this.overlay.appendChild(div);
        });
    }

    applyAlignmentTransform(element, alignment) {
        // Used for \pos overrides (Absolute positioning)
        // alignment matches numpad (1-9)
        let tx = '-50%';
        let ty = '-50%';

        switch (alignment) {
            case 1: tx = '0%'; ty = '-100%'; break; // Bottom Left
            case 2: tx = '-50%'; ty = '-100%'; break; // Bottom Center
            case 3: tx = '-100%'; ty = '-100%'; break; // Bottom Right
            case 4: tx = '0%'; ty = '-50%'; break; // Middle Left
            case 5: tx = '-50%'; ty = '-50%'; break; // Middle Center
            case 6: tx = '-100%'; ty = '-50%'; break; // Middle Right
            case 7: tx = '0%'; ty = '0%'; break; // Top Left
            case 8: tx = '-50%'; ty = '0%'; break; // Top Center
            case 9: tx = '-100%'; ty = '0%'; break; // Top Right
        }

        element.style.transform = `translate(${tx}, ${ty})`;
    }

    applyFlexAlignment(element, alignment, style, scaleX, scaleY) {
        // Alignment 1-9
        element.style.position = 'absolute';
        element.style.whiteSpace = 'nowrap';

        // Calculate Margins/Padding
        // We use them as padding for full-width containers (centered) 
        // or margins for variable-width (left/right aligned)
        const mL = (parseInt(style.MarginL) || 10) * scaleX;
        const mR = (parseInt(style.MarginR) || 10) * scaleX;
        const mV = (parseInt(style.MarginV) || 10) * scaleY;

        // Vertical Alignment
        if ([7, 8, 9].includes(alignment)) { // Top
            element.style.top = `${mV}px`;
            element.style.bottom = 'auto';
        } else if ([4, 5, 6].includes(alignment)) { // Middle
            element.style.top = '50%';
            element.style.bottom = 'auto';
            element.style.transform = 'translateY(-50%)';
        } else { // Bottom (1, 2, 3)
            element.style.top = 'auto';
            element.style.bottom = `${mV}px`;
        }

        // Horizontal Alignment
        if ([1, 4, 7].includes(alignment)) { // Left
            element.style.left = `${mL}px`;
            element.style.right = 'auto';
            element.style.textAlign = 'left';
            element.style.width = 'auto';
        } else if ([3, 6, 9].includes(alignment)) { // Right
            element.style.left = 'auto';
            element.style.right = `${mR}px`;
            element.style.textAlign = 'right';
            element.style.width = 'auto';
        } else { // Center (2, 5, 8)
            // Use full width with padding to ensure correct centering between margins
            element.style.left = '0';
            element.style.width = '100%';
            element.style.textAlign = 'center';
            // Use padding to restrict the "center" area
            // box-sizing: border-box is important here, usually inherited or default content-box
            // We'll enforce border-box for calculation safety
            element.style.boxSizing = 'border-box';
            element.style.paddingLeft = `${mL}px`;
            element.style.paddingRight = `${mR}px`;

            // Remove transform X since we are using width 100%
            if (element.style.transform && element.style.transform.includes('translateY')) {
                // Keep Y transform if it exists
            } else if (element.style.transform) {
                element.style.transform = element.style.transform.replace(/translateX\([^)]+\)/, '');
            }
        }
    }

    resize() {
        // Re-render to update scaling
        if (this.activeCues.length > 0) {
            this.render();
        }
    }
}
