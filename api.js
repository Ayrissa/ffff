/**
 * All network calls. Uses ONLY the extension's own API settings.
 * SillyTavern's own API connections / secrets are never read.
 */
import { getContext, getSettings, t, cleanText } from './core.js';
import { describeSystem } from './prompts.js';

const stripThink = s => String(s || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

async function httpError(res) {
    let body = '';
    try { body = await res.text(); } catch { /* ignore */ }
    return new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
}

/* ------------------------------------------------ analysis (text) API */

export const llmConfigured = () => { const a = getSettings().llmApi; return !!(a.url && a.model); };

export function imageConfigured() {
    const a = getSettings().imageApi;
    return a.provider === 'gemini' ? !!(a.key && a.model) : !!(a.url && a.model);
}

function llmEndpoint(url) {
    let u = String(url || '').trim().replace(/\/+$/, '');
    if (!/\/chat\/completions$/i.test(u)) u += '/chat/completions';
    return u;
}

function llmHeaders(a, json = true) {
    const h = {};
    if (json) h['Content-Type'] = 'application/json';
    if (a.key) h['Authorization'] = 'Bearer ' + a.key;
    return h;
}

export async function callLLM(messages, { signal, maxTokens } = {}) {
    const a = getSettings().llmApi;
    const res = await fetch(llmEndpoint(a.url), {
        method: 'POST',
        headers: llmHeaders(a),
        credentials: 'omit',
        signal,
        body: JSON.stringify({ model: a.model, messages, temperature: a.temperature, max_tokens: maxTokens ?? a.maxTokens, stream: false }),
    });
    if (!res.ok) throw await httpError(res);
    const j = await res.json();
    const c = j?.choices?.[0]?.message?.content;
    return Array.isArray(c) ? c.map(p => p?.text || '').join('') : String(c ?? '');
}

export async function loadLLMModels() {
    const a = getSettings().llmApi;
    const url = String(a.url || '').trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '') + '/models';
    const res = await fetch(url, { headers: llmHeaders(a, false), credentials: 'omit' });
    if (!res.ok) throw await httpError(res);
    const j = await res.json();
    return (j.data || j.models || []).map(x => x.id || x.name).filter(Boolean);
}

export async function describeFromChat(kind, signal) {
    const ctx = getContext();
    const s = getSettings();
    const chat = (ctx.chat || []).filter(m => !m.is_system).slice(-s.contextMessages);
    const ch = ctx.characters?.[ctx.characterId];
    const card = ch ? [
        ch.name ? `Name: ${ch.name}` : '',
        ch.description ? `Description: ${cleanText(ch.description, 1500)}` : '',
        ch.scenario ? `Scenario: ${cleanText(ch.scenario, 800)}` : '',
    ].filter(Boolean).join('\n') : '';
    const history = chat.map(m => `${m.name}: ${cleanText(m.mes, 1500)}`).join('\n\n');
    const out = await callLLM([
        { role: 'system', content: describeSystem(kind) },
        { role: 'user', content: `${card ? `Character card:\n${card}\n\n` : ''}Recent chat:\n${history}\n\nWrite the description now.` },
    ], { signal });
    const text = stripThink(out);
    if (!text) throw new Error(t('emptyDesc'));
    return text;
}

/* ------------------------------------------------ image API */

const ASPECT_OPENAI = { square: '1024x1024', landscape: '1536x1024', portrait: '1024x1536' };
const ASPECT_RATIO = { square: '1:1', landscape: '4:3', portrait: '3:4' };

function sniffMime(b64) {
    if (b64.startsWith('/9j/')) return 'image/jpeg';
    if (b64.startsWith('UklG')) return 'image/webp';
    return 'image/png';
}

function blobToB64(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1]);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
    });
}

async function imageFromUrl(url, signal) {
    try {
        const r = await fetch(url, { signal, credentials: 'omit' });
        if (!r.ok) throw new Error('fetch failed');
        const blob = await r.blob();
        return { b64: await blobToB64(blob), mime: blob.type || 'image/png' };
    } catch (e) {
        if (e?.name === 'AbortError') throw e;
        return { externalUrl: url }; // CORS blocked: keep the remote URL (may expire)
    }
}

async function genOpenAI(a, prompt, aspect, signal) {
    const base = a.url.trim().replace(/\/+$/, '').replace(/\/images\/generations$/i, '');
    const res = await fetch(base + '/images/generations', {
        method: 'POST',
        headers: llmHeaders(a),
        credentials: 'omit',
        signal,
        body: JSON.stringify({ model: a.model, prompt, n: 1, size: (a.customSize || '').trim() || ASPECT_OPENAI[aspect] || '1024x1024' }),
    });
    if (!res.ok) throw await httpError(res);
    const d = (await res.json())?.data?.[0];
    if (d?.b64_json) return { b64: d.b64_json, mime: sniffMime(d.b64_json) };
    if (d?.url) return imageFromUrl(d.url, signal);
    throw new Error(t('noImage'));
}

async function genGemini(a, prompt, aspect, signal) {
    const base = (a.url || 'https://generativelanguage.googleapis.com/v1beta').trim().replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': a.key };
    const ratio = ASPECT_RATIO[aspect] || '1:1';

    if (/^imagen/i.test(a.model)) {
        const res = await fetch(`${base}/models/${a.model}:predict`, {
            method: 'POST', headers, credentials: 'omit', signal,
            body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: ratio } }),
        });
        if (!res.ok) throw await httpError(res);
        const p = (await res.json())?.predictions?.[0];
        if (!p?.bytesBase64Encoded) throw new Error(t('noImage'));
        return { b64: p.bytesBase64Encoded, mime: p.mimeType || sniffMime(p.bytesBase64Encoded) };
    }

    const res = await fetch(`${base}/models/${a.model}:generateContent`, {
        method: 'POST', headers, credentials: 'omit', signal,
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: ratio } },
        }),
    });
    if (!res.ok) throw await httpError(res);
    const j = await res.json();
    const parts = j?.candidates?.[0]?.content?.parts || [];
    const img = parts.map(p => p.inlineData || p.inline_data).find(Boolean);
    if (!img?.data) {
        const why = parts.map(p => p.text).filter(Boolean).join(' ') || j?.promptFeedback?.blockReason || j?.candidates?.[0]?.finishReason || '';
        throw new Error(`${t('noImage')}${why ? ': ' + String(why).slice(0, 200) : ''}`);
    }
    return { b64: img.data, mime: img.mimeType || img.mime_type || sniffMime(img.data) };
}

export function generateImage(prompt, kind, signal) {
    const a = getSettings().imageApi;
    const aspect = kind === 'world' ? a.aspectWorld : a.aspectScene;
    return a.provider === 'gemini' ? genGemini(a, prompt, aspect, signal) : genOpenAI(a, prompt, aspect, signal);
}

/* ------------------------------------------------ saving the picture on the ST server */

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Uploads the image to SillyTavern's own user-files storage (no keys involved) and returns its URL. */
export async function storeImage(img, kind) {
    if (img.externalUrl) return img.externalUrl;
    const ext = EXT[img.mime] || 'png';
    const name = `sillymap_${kind}_${Date.now()}.${ext}`;
    const ctx = getContext();
    const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: ctx.getRequestHeaders(),
        body: JSON.stringify({ name, data: img.b64 }),
    });
    if (!res.ok) throw new Error(t('uploadFail') + `HTTP ${res.status}`);
    const j = await res.json();
    const p = String(j.path || '');
    if (!p) throw new Error(t('uploadFail'));
    return /^(https?:)?\//.test(p) ? p : '/' + p;
}
