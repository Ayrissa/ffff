/**
 * SillyMap — AI-generated world and location maps for SillyTavern roleplay.
 * Author: Ayrissa. License: MIT.
 *
 * Privacy: uses ONLY its own API settings. It never reads SillyTavern's API connections, secrets or keys.
 */
import { getContext, getSettings, fillDefaults, DEFAULTS } from './core.js';
import { initSettings } from './settings.js';
import { openWindow, onChatChanged } from './ui.js';

function addWandButton() {
    const add = () => {
        if ($('#sillymap_wand').length) return true;
        const $menu = $('#extensionsMenu');
        if (!$menu.length) return false;
        $menu.append(`
<div id="sillymap_wand" class="list-group-item flex-container flexGap5 interactable" tabindex="0">
    <div class="fa-solid fa-map-location-dot extensionsMenuExtensionButton"></div>
    <span>SillyMap</span>
</div>`);
        $('#sillymap_wand').on('click', () => {
            if ($('#extensionsMenu').is(':visible')) $('#extensionsMenuButton').trigger('click'); // close the wand menu
            openWindow();
        });
        return true;
    };
    if (!add()) {
        const ctx = getContext();
        ctx.eventSource.on((ctx.eventTypes || ctx.event_types).APP_READY, add);
    }
}

jQuery(() => {
    fillDefaults(getSettings(), DEFAULTS);
    initSettings();
    addWandButton();

    const ctx = getContext();
    const ET = ctx.eventTypes || ctx.event_types;
    ctx.eventSource.on(ET.CHAT_CHANGED, onChatChanged);
});
