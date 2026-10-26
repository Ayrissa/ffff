import { getSettings, saveSettings, getPath, setPath, t, esc } from './core.js';
import { STYLES } from './prompts.js';
import { callLLM, loadLLMModels } from './api.js';

const ID = 'sm_settings_body';

function body() {
    const s = getSettings();
    const g = k => getPath(s, k);
    const row = (label, inner) => `<label class="sm-srow"><span>${label}</span>${inner}</label>`;
    const sel = (k, opts) => `<select class="text_pole sm-in" data-k="${k}">${opts.map(([v, l]) => `<option value="${v}"${String(v) === String(g(k)) ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    const chk = (k, label) => `<label class="checkbox_label"><input type="checkbox" class="sm-in" data-k="${k}"${g(k) ? ' checked' : ''}><span>${label}</span></label>`;
    const inp = (k, type = 'text', extra = '') => `<input class="text_pole sm-in" type="${type}" data-k="${k}" value="${esc(g(k))}" ${extra}>`;
    const gem = s.imageApi.provider === 'gemini';
    const aspects = [['square', t('aspSquare')], ['landscape', t('aspLandscape')], ['portrait', t('aspPortrait')]];

    return `
<div class="sm-ssec">
  ${row(t('language'), sel('lang', [['ru', 'Русский'], ['en', 'English']]))}
  ${row(t('binding'), sel('bindTo', [['chat', t('bindChat')], ['character', t('bindChar')]]))}
  <small class="sm-snote">${t('bindNote')}</small>
  ${row(t('defaultStyle'), sel('defaultStyle', STYLES.map(x => [x, t('style_' + x)])))}
  <label class="sm-scol"><span>${t('customStyle')}</span><textarea class="text_pole sm-in" data-k="customStyle" rows="2" placeholder="${esc(t('customStylePh'))}">${esc(s.customStyle)}</textarea></label>
</div>

<div class="sm-ssec"><h4>${t('secImage')}</h4>
  ${row(t('provider'), sel('imageApi.provider', [['openai', t('provOpenAI')], ['gemini', t('provGemini')]]))}
  ${row(t('apiUrl'), inp('imageApi.url', 'text', `placeholder="${gem ? 'https://generativelanguage.googleapis.com/v1beta' : 'https://api.openai.com/v1'}" autocomplete="off"`))}
  ${row(t('apiKey'), inp('imageApi.key', 'password', 'autocomplete="new-password"'))}
  ${row(t('model'), inp('imageApi.model', 'text', `placeholder="${gem ? 'gemini-2.5-flash-image' : 'gpt-image-1'}" autocomplete="off"`))}
  ${row(t('aspectWorld'), sel('imageApi.aspectWorld', aspects))}
  ${row(t('aspectScene'), sel('imageApi.aspectScene', aspects))}
  ${gem ? '' : row(t('customSize'), inp('imageApi.customSize', 'text', 'placeholder="1024x1024"'))}
  <small class="sm-snote">${t('imageNote')}</small>
</div>

<div class="sm-ssec"><h4>${t('secLlm')}</h4>
  ${chk('analyze', t('analyze'))}
  ${row(t('apiUrl'), inp('llmApi.url', 'text', 'placeholder="https://api.openai.com/v1" autocomplete="off"'))}
  ${row(t('apiKey'), inp('llmApi.key', 'password', 'autocomplete="new-password"'))}
  ${row(t('model'), inp('llmApi.model', 'text', 'list="sm_models" autocomplete="off"'))}
  <datalist id="sm_models"></datalist>
  ${row(t('llmTemp'), inp('llmApi.temperature', 'number', 'min="0" max="2" step="0.1"'))}
  ${row(t('llmMaxTok'), inp('llmApi.maxTokens', 'number', 'min="200" max="8000" step="100"'))}
  ${row(t('ctxMsgs'), inp('contextMessages', 'number', 'min="1" max="40"'))}
  <div class="sm-sbtns">
    <div id="sm_load_models" class="menu_button">${t('loadModels')}</div>
    <div id="sm_test" class="menu_button">${t('test')}</div>
  </div>
</div>
<small class="sm-snote">${t('privacy')}</small>`;
}

function rebuild() {
    $(`#${ID}`).html(body());
}

export function initSettings() {
    $('#extensions_settings2').append(`
<div class="sm-settings">
  <div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>SillyMap</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content"><div id="${ID}"></div></div>
  </div>
</div>`);
    rebuild();

    $(document).on('input change', '.sm-in', function () {
        const k = $(this).attr('data-k');
        let v;
        if (this.type === 'checkbox') v = this.checked;
        else if (this.type === 'number') { v = Number(this.value); if (!Number.isFinite(v)) return; }
        else v = this.value;
        if (getPath(getSettings(), k) === v) return;
        setPath(getSettings(), k, v);
        saveSettings();
        if (k === 'lang' || k === 'imageApi.provider') rebuild();
    });

    $(document).on('click', '#sm_load_models', async () => {
        try {
            const list = await loadLLMModels();
            $('#sm_models').html(list.map(id => `<option value="${esc(id)}"></option>`).join(''));
            toastr.success(t('modelsLoaded') + list.length);
        } catch (e) { toastr.error(t('errGen') + (e?.message || e)); }
    });

    $(document).on('click', '#sm_test', async () => {
        try { await callLLM([{ role: 'user', content: 'Reply with: OK' }], { maxTokens: 200 }); toastr.success(t('okTest')); }
        catch (e) { toastr.error(t('errGen') + (e?.message || e)); }
    });
}
