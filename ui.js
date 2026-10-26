import { getSettings, t, esc } from './core.js';
import { STYLES, buildImagePrompt } from './prompts.js';
import { imageConfigured, llmConfigured, describeFromChat, generateImage, storeImage } from './api.js';
import { getMap, currentItem, setField, addItem, setCur } from './storage.js';
import { Viewer } from './viewer.js';

const state = { open: false, tab: 'world', busy: false, abort: null, viewer: null, shownUrl: null };

const $q = sel => $('#sm_overlay').find(sel);

function windowHtml() {
    return `
<div class="sm-overlay" id="sm_overlay">
  <div class="sm-window" role="dialog">
    <div class="sm-head">
      <div class="sm-title"><i class="fa-solid fa-map-location-dot"></i><span>SillyMap</span></div>
      <div class="sm-tabs">
        <button class="sm-tab" data-tab="world"><i class="fa-solid fa-earth-europe"></i><span>${esc(t('tabWorld'))}</span></button>
        <button class="sm-tab" data-tab="scene"><i class="fa-solid fa-location-dot"></i><span>${esc(t('tabScene'))}</span></button>
      </div>
      <button class="sm-close" title="${esc(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="sm-main">
      <div class="sm-viewport" id="sm_vp">
        <div class="sm-stage" id="sm_stage"><img id="sm_img" alt="" draggable="false"></div>
        <div class="sm-empty sm-ui" id="sm_empty">
          <div id="sm_empty_text"></div>
          <button class="sm-gen-big" id="sm_gen_big"><i class="fa-solid fa-rotate"></i></button>
        </div>
        <div class="sm-zoom sm-ui" id="sm_zoom">
          <button data-z="in" title="${esc(t('zoomIn'))}"><i class="fa-solid fa-plus"></i></button>
          <button data-z="out" title="${esc(t('zoomOut'))}"><i class="fa-solid fa-minus"></i></button>
          <button data-z="fit" title="${esc(t('zoomFit'))}"><i class="fa-solid fa-expand"></i></button>
        </div>
        <div class="sm-loading sm-ui" id="sm_loading" hidden>
          <div class="sm-spin"></div>
          <div id="sm_status"></div>
          <button class="sm-btn" id="sm_cancel">${esc(t('cancel'))}</button>
        </div>
      </div>
      <div class="sm-panel">
        <label class="sm-field"><span>${esc(t('style'))}</span>
          <select id="sm_style" class="text_pole">${STYLES.map(s => `<option value="${s}">${esc(t('style_' + s))}</option>`).join('')}</select>
        </label>
        <label class="sm-field"><span>${esc(t('extra'))}</span>
          <textarea id="sm_extra" class="text_pole" rows="3"></textarea>
        </label>
        <button id="sm_gen" class="sm-btn sm-primary"><i class="fa-solid fa-rotate"></i><span id="sm_gen_label"></span></button>
        <div class="sm-versions" id="sm_versions">
          <button id="sm_prev"><i class="fa-solid fa-chevron-left"></i></button>
          <span id="sm_ver"></span>
          <button id="sm_next"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <button id="sm_prompt_btn" class="sm-btn"><i class="fa-solid fa-code"></i><span></span></button>
        <textarea id="sm_prompt" class="text_pole" readonly hidden rows="7"></textarea>
      </div>
    </div>
  </div>
</div>`;
}

function setLoading(on, text = '') {
    $q('#sm_loading').prop('hidden', !on);
    $q('#sm_status').text(text);
}

async function showImage(url) {
    if (state.shownUrl === url) return;
    state.shownUrl = url;
    try {
        await state.viewer.setImage(url);
    } catch {
        state.shownUrl = null;
        toastr.error(t('imgLoadErr'));
    }
}

function render() {
    if (!state.open) return;
    const s = getSettings();
    const kind = state.tab;
    const m = getMap(kind);
    const item = currentItem(kind);

    $q('.sm-tab').each(function () { $(this).toggleClass('active', $(this).data('tab') === kind); });
    $q('#sm_style').val(m?.style || s.defaultStyle);
    $q('#sm_extra').val(m?.extra || '').attr('placeholder', t(kind === 'world' ? 'extraPhWorld' : 'extraPhScene'));
    $q('#sm_gen_label').text(' ' + t(item ? 'regen' : 'create'));
    $q('#sm_gen, #sm_gen_big').prop('disabled', !m || state.busy);
    $q('.sm-panel select, .sm-panel textarea:not(#sm_prompt)').prop('disabled', !m);

    const hasImg = !!item;
    $q('#sm_empty').prop('hidden', hasImg);
    $q('#sm_empty_text').text(m ? t(kind === 'world' ? 'emptyWorld' : 'emptyScene') : t('noChat'));
    $q('#sm_zoom').prop('hidden', !hasImg);
    $q('#sm_stage').toggle(hasImg);

    const n = m?.items.length || 0;
    $q('#sm_versions').prop('hidden', n < 2);
    $q('#sm_ver').text(n ? `${m.cur + 1} / ${n}` : '');
    $q('#sm_prev').prop('disabled', !m || m.cur <= 0);
    $q('#sm_next').prop('disabled', !m || m.cur >= n - 1);

    const $p = $q('#sm_prompt');
    $q('#sm_prompt_btn').prop('hidden', !item).find('span').text(' ' + t($p.prop('hidden') ? 'showPrompt' : 'hidePrompt'));
    $p.val(item?.prompt || '');
    if (!item) $p.prop('hidden', true);

    if (item) showImage(item.image);
    else { state.shownUrl = null; state.viewer.clear(); }
}

async function onGenerate() {
    if (state.busy) return;
    const s = getSettings();
    const kind = state.tab;
    const m = getMap(kind);
    if (!m) return toastr.warning(t('noChat'));
    if (!imageConfigured()) return toastr.warning(t('noImageApi'));

    const style = m.style || s.defaultStyle;
    const extra = (m.extra || '').trim();
    const useLlm = s.analyze && llmConfigured();
    if (!useLlm && !extra) return toastr.warning(t('needDesc'));

    state.busy = true;
    state.abort = new AbortController();
    const { signal } = state.abort;
    $q('#sm_gen, #sm_gen_big').prop('disabled', true);
    try {
        let desc = '';
        if (useLlm) {
            setLoading(true, t('statusAnalyze'));
            desc = await describeFromChat(kind, signal);
        }
        const prompt = buildImagePrompt(kind, style, desc, extra);
        setLoading(true, t('statusDraw'));
        const img = await generateImage(prompt, kind, signal);
        setLoading(true, t('statusSave'));
        const url = await storeImage(img, kind);
        addItem(kind, { image: url, style, prompt, desc, created: Date.now() });
        if (state.open) { state.shownUrl = null; render(); } else toastr.success(t('done'));
    } catch (e) {
        if (e?.name === 'AbortError') toastr.info(t('cancelled'));
        else { console.error('[SillyMap]', e); toastr.error(t('errGen') + (e?.message || e)); }
    } finally {
        state.busy = false;
        state.abort = null;
        if (state.open) { setLoading(false); render(); }
    }
}

function bindWindow() {
    const $o = $('#sm_overlay');
    $o.on('click', '.sm-close', closeWindow);
    $o.on('click', '.sm-tab', function () { state.tab = $(this).data('tab'); render(); });
    $o.on('click', '#sm_gen, #sm_gen_big', onGenerate);
    $o.on('click', '#sm_cancel', () => state.abort?.abort());
    $o.on('change', '#sm_style', function () { setField(state.tab, 'style', this.value); });
    $o.on('change', '#sm_extra', function () { setField(state.tab, 'extra', this.value); });
    $o.on('click', '#sm_prompt_btn', () => { $q('#sm_prompt').prop('hidden', (_, v) => !v); render(); });
    $o.on('click', '#sm_prev', () => { const m = getMap(state.tab); if (m) { setCur(state.tab, m.cur - 1); render(); } });
    $o.on('click', '#sm_next', () => { const m = getMap(state.tab); if (m) { setCur(state.tab, m.cur + 1); render(); } });
    $o.on('click', '#sm_zoom button', function () {
        const z = $(this).data('z');
        if (z === 'in') state.viewer.zoomBy(1.4);
        else if (z === 'out') state.viewer.zoomBy(1 / 1.4);
        else state.viewer.fit();
    });
    $o.on('mousedown', function (e) { if (e.target === this) closeWindow(); });
}

function onKey(e) { if (e.key === 'Escape' && state.open) closeWindow(); }

export function openWindow() {
    if (state.open) return;
    $('#sm_overlay').remove();
    $('body').append(windowHtml());
    state.open = true;
    state.shownUrl = null;
    const vp = document.getElementById('sm_vp');
    state.viewer = new Viewer(vp, document.getElementById('sm_stage'));
    bindWindow();
    document.addEventListener('keydown', onKey);
    render();
    if (state.busy) setLoading(true, t('statusDraw'));
}

export function closeWindow() {
    if (!state.open) return;
    state.open = false;
    document.removeEventListener('keydown', onKey);
    state.viewer?.destroy();
    state.viewer = null;
    $('#sm_overlay').remove();
}

export function onChatChanged() {
    if (!state.open) return;
    state.shownUrl = null;
    render();
}
