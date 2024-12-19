import { browser } from 'webextension-polyfill-ts';

document.getElementById('settingsButton')?.addEventListener('click', () => {
    browser.tabs.create({
        url: browser.runtime.getURL('settings.html')
    });
    window.close();
});