import { getContext, getSettings, saveSettings } from './core.js';

const MAX_ITEMS = 12;

function charKey() {
    const ctx = getContext();
    if (ctx.groupId) return 'group:' + ctx.groupId;
    return ctx.characters?.[ctx.characterId]?.avatar || null;
}

function saveMeta() {
    const ctx = getContext();
    (ctx.saveMetadata || ctx.saveMetadataDebounced)?.call(ctx);
}

/** Returns { root, save } where the map data of this kind lives, or null if there is no open chat. */
function location(kind) {
    const ctx = getContext();
    const s = getSettings();
    if (kind === 'world' && s.bindTo === 'character') {
        const key = charKey();
        if (!key) return null;
        s.byChar[key] ??= {};
        return { root: s.byChar[key], save: saveSettings };
    }
    if (!ctx.chatMetadata) return null;
    ctx.chatMetadata.sillymap ??= {};
    return { root: ctx.chatMetadata.sillymap, save: saveMeta };
}

/** Map record: { items: [{image, style, prompt, desc, created}], cur, style, extra } */
export function getMap(kind) {
    const loc = location(kind);
    if (!loc) return null;
    loc.root[kind] ??= { items: [], cur: -1, style: '', extra: '' };
    return loc.root[kind];
}

export function currentItem(kind) {
    const m = getMap(kind);
    return m && m.items[m.cur] ? m.items[m.cur] : null;
}

export function setField(kind, key, value) {
    const loc = location(kind);
    if (!loc) return;
    getMap(kind)[key] = value;
    loc.save();
}

export function addItem(kind, item) {
    const loc = location(kind);
    if (!loc) return;
    const m = getMap(kind);
    m.items.push(item);
    if (m.items.length > MAX_ITEMS) m.items.splice(0, m.items.length - MAX_ITEMS);
    m.cur = m.items.length - 1;
    loc.save();
}

export function setCur(kind, index) {
    const loc = location(kind);
    const m = getMap(kind);
    if (!loc || !m || index < 0 || index >= m.items.length) return;
    m.cur = index;
    loc.save();
}
