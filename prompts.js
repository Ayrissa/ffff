import { getSettings } from './core.js';

export const STYLES = ['fantasy', 'medieval', 'paper', 'modern', 'custom'];

const WORLD = {
    fantasy: 'A richly illustrated fantasy world map, hand-painted digital art, top-down aerial overview of a whole continent with seas, mountain ranges, forests, rivers, deserts and winding coastlines, vivid colours, soft painterly shading, dramatic depth, decorative ocean border',
    medieval: 'An antique medieval cartographic map on aged parchment, hand-inked in brown and black ink with muted watercolour washes, tiny drawn mountains, trees and castles in the manner of illuminated manuscripts, ornamental compass rose, decorative sea monsters and sailing ships, weathered edges',
    paper: 'A vintage book-style map on cream paper, fine black ink line art, hand-engraved hatching for mountains and forests, delicate coastlines, sepia tones, light paper texture and age stains, elegant minimal atlas look',
    modern: 'A clean modern digital map, flat vector cartography, top-down satellite-like overview, simple colour palette (water in blue, land in soft beige and green, roads in orange and white), crisp lines like a navigation app',
};

const SCENE = {
    fantasy: 'A top-down battle map (bird\'s-eye view, strictly overhead orthographic perspective) in rich painterly fantasy art style, warm atmospheric lighting, detailed hand-painted textures, tabletop roleplaying battlemap',
    medieval: 'A top-down battle map (strictly overhead view) in a hand-inked medieval dark-fantasy style, wood, stone and straw textures, bold ink outlines with warm colouring, tabletop roleplaying battlemap look',
    paper: 'A top-down floor plan sketch (strictly overhead view) drawn with ink and light watercolour on cream paper, architect\'s notebook style, thin black outlines, subtle sepia shading',
    modern: 'A clean modern top-down plan (strictly overhead view), flat vector illustration, realistic proportions, neutral colour palette with clear shapes, like an architectural or city-navigation plan',
};

const TAIL = 'Absolutely no text, no letters, no numbers, no labels, no captions, no logos, no watermark, no UI elements, no people or characters. The artwork must be free of any lettering.';

export function buildImagePrompt(kind, style, desc, extra) {
    const table = kind === 'world' ? WORLD : SCENE;
    let base = table[style];
    if (style === 'custom' || !base) {
        const custom = (getSettings().customStyle || '').trim();
        base = (kind === 'world' ? 'A map of a whole world seen from above, ' : 'A top-down overhead battle map of a location, ') + (custom || 'illustrated artwork');
    }
    const parts = [base + '.'];
    if (desc) parts.push(`Subject: ${desc}`);
    if (extra) parts.push(`Additional wishes from the user: ${extra}`);
    parts.push(TAIL);
    return parts.join(' ');
}

export function describeSystem(kind) {
    if (kind === 'world') {
        return [
            'You assist with a roleplay map. From the roleplay material, write a visual description of the WORLD geography for an image generator.',
            'One paragraph, 80-140 words, in English.',
            'Cover: overall shape (continents, islands, seas), terrain types (mountain ranges, forests, deserts, rivers, lakes), climate zones, where the main regions lie (north, south, coast, inland), and visible signs of civilization (cities, ports, roads, ruins) matching the setting and its technology level.',
            'If the material does not describe the world, invent a coherent one that fits the genre and tone.',
            'Do NOT use proper names. Do NOT mention characters. Do NOT mention text, labels or captions.',
            'Output only the description.',
        ].join('\n');
    }
    return [
        'You assist with a roleplay map. From the roleplay material, write a visual description of the CURRENT LOCATION where the scene takes place, as seen from directly above (top-down battle map).',
        'One paragraph, 80-140 words, in English.',
        'Cover: type and size of the place (room, building, street, camp, clearing...), layout, walls, doors, windows, furniture and notable objects, ground or floor material, light sources, time of day, mood.',
        'Do NOT mention any characters or creatures. Do NOT use proper names. Do NOT mention text, labels or captions.',
        'Output only the description.',
    ].join('\n');
}
