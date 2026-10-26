import { LOC } from './locales.js';

export const MODULE = 'sillymap';
export const getContext = () => SillyTavern.getContext();

export const DEFAULTS = {
    lang: 'ru',
    bindTo: 'chat', // where the WORLD map is stored: 'chat' | 'character'. The scene map is always per chat.
    defaultStyle: 'fantasy',
    customStyle: '',
    analyze: true,
    contextMessages: 10,
    imageApi: { provider: 'openai', url: '', key: '', model: '', aspectWorld: 'square', aspectScene: 'square', customSize: '' },
    llmApi: { url: '', key: '', model: '', temperature: 0.7, maxTokens: 1200 },
    byChar: {},
};

export function fillDefaults(target, def) {
    for (const k of Object.keys(def)) {
        if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k])) {
            if (!target[k] || typeof target[k] !== 'object') target[k] = {};
            fillDefaults(target[k], def[k]);
        } else if (target[k] === undefined) {
            target[k] = def[k];
        }
    }
}

export function getSettings() {
    const root = getContext().extensionSettings;
    if (!root[MODULE]) root[MODULE] = {};
    return root[MODULE];
}

export const saveSettings = () => getContext().saveSettingsDebounced();

export const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

export function setPath(obj, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    parts.reduce((o, k) => o[k], obj)[last] = value;
}

export function t(key) {
    const lang = getSettings().lang;
    return LOC[lang]?.[key] ?? LOC.en[key] ?? key;
}

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));

export const cleanText = (s, max = 2000) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
