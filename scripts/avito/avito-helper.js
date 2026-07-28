// ==UserScript==
// @name         Avito Helper
// @namespace    http://tampermonkey.net/
// @version      3.6
// @description  Утилиты для Avito
// @author       fpsthirty + DeepSeek
// @match        https://www.avito.ru/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=avito.ru
// @grant        GM_setClipboard
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // ========== Конфигурация дебага ==========
    const DEBUG_KEY = 'avito_debug_enabled';
    let debugEnabled = false;

    function isDebugEnabled() {
        try {
            return localStorage.getItem(DEBUG_KEY) === 'true';
        } catch (e) {
            return false;
        }
    }

    function debugLog(message, data = {}) {
        if (!debugEnabled) return;
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[Avito Debug] ${timestamp} - ${message}`, data);
    }

    // ========== Консольные команды ==========
    const commands = {
        enableDebug: function() {
            try {
                localStorage.setItem(DEBUG_KEY, 'true');
                debugEnabled = true;
                console.log('🔍 Режим отладки: ВКЛЮЧЕН');
                console.log('Теперь будут отображаться все служебные сообщения');
            } catch (e) {
                console.error('Ошибка включения режима отладки:', e);
            }
        },
        disableDebug: function() {
            try {
                localStorage.setItem(DEBUG_KEY, 'false');
                debugEnabled = false;
                console.log('🔍 Режим отладки: ВЫКЛЮЧЕН');
                console.log('Служебные сообщения скрыты');
            } catch (e) {
                console.error('Ошибка выключения режима отладки:', e);
            }
        },
        isDebugEnabled: function() {
            const enabled = isDebugEnabled();
            console.log(`🔍 Режим отладки: ${enabled ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
            return enabled;
        }
    };

    window.__avito = commands;

    if (isDebugEnabled()) {
        debugEnabled = true;
        console.log('[Avito Helper] Режим отладки включен из сохраненных настроек');
    }

    // console.log('[Avito Helper] Скрипт загружен. Для управления дебагом: __avito.enableDebug() или __avito.disableDebug()'); todo: надо реализовать без unsafeWindow

    // ========== Конфигурация разделов ==========
    const SECTIONS = {
        'common': {
            name: 'Общее',
            locators: []
        },
        'realty': {
            name: 'Недвижимость',
            locators: [
                "//a[@data-marker='search-form/logo']/following-sibling::a[contains(@href,'/nedvizhimost')]"
            ]
        },
        'realty-offer': {
            name: 'Недвижимость-объявление',
            locators: [
                "//a[@data-marker='search-form/logo']/following-sibling::a[contains(@href,'/nedvizhimost')]",
                "//div[@id='bx_item-params']/h2[text()='О помещении']"
            ]
        },
        'realty-map': {
            name: 'Недвижимость-карта',
            locators: [
                "//a[@data-marker='search-form/logo']/following-sibling::a[contains(@href,'/nedvizhimost')]",
                "//div[@data-marker='map-full/side-block']"
            ]
        }
    };

    function checkSection(sectionName) {
        const section = SECTIONS[sectionName];
        if (!section) return false;

        const locators = section.locators;
        if (locators.length === 0) return true;

        for (let xpath of locators) {
            const element = document.evaluate(
                xpath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            ).singleNodeValue;

            if (!element) {
                return false;
            }
        }
        return true;
    }

    function getCurrentSection() {
        const sections = ['realty-offer', 'realty-map', 'realty', 'common'];
        for (let section of sections) {
            if (checkSection(section)) {
                return section;
            }
        }
        return 'common';
    }

    // ========== Глобальные переменные для margin-left ==========
    let cachedMarginLeft = null;
    let isMarginLeftInitialized = false;
    let windowWidth = window.innerWidth;
    const MIN_WINDOW_WIDTH = 1720;
    const MIN_BLOCK_WIDTH = 150;
    const PADDING_LEFT = 16;
    const PADDING_RIGHT = 16;

    function findMarginElement() {
        const element = document.evaluate(
            "//div[@style='display:contents']/div[div[@style='display:contents']]",
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;
        return element;
    }

    function getCalculatedBlockWidth() {
        const currentWidth = window.innerWidth;

        // Если ширина окна >= 1720px, вычисляем ширину блока по формуле
        if (currentWidth >= MIN_WINDOW_WIDTH) {
            const extraSpace = currentWidth - MIN_WINDOW_WIDTH;
            const calculatedWidth = (extraSpace / 2) + MIN_BLOCK_WIDTH;
            debugLog('getCalculatedBlockWidth: вычисленная ширина по формуле', {
                windowWidth: currentWidth,
                extraSpace: extraSpace,
                calculatedWidth: calculatedWidth,
                minBlockWidth: MIN_BLOCK_WIDTH
            });
            return calculatedWidth;
        }

        // Иначе используем margin-left
        const marginLeft = getMarginLeft();
        const blockWidth = marginLeft - PADDING_LEFT - PADDING_RIGHT;
        debugLog('getCalculatedBlockWidth: ширина из margin-left', {
            marginLeft: marginLeft,
            blockWidth: blockWidth
        });
        return blockWidth;
    }

    function getMarginLeft() {
        // Если ширина окна >= 1720px, возвращаем 200 (достаточное значение для показа блока)
        if (window.innerWidth >= MIN_WINDOW_WIDTH) {
            debugLog('getMarginLeft: ширина окна >= 1720px, возвращаем 200 (достаточное значение)', {
                windowWidth: window.innerWidth
            });
            return 200;
        }

        if (cachedMarginLeft !== null && isMarginLeftInitialized) {
            return cachedMarginLeft;
        }

        const element = findMarginElement();
        if (element) {
            const computedStyle = window.getComputedStyle(element);
            cachedMarginLeft = parseFloat(computedStyle.marginLeft) || 0;
            isMarginLeftInitialized = true;
            debugLog('getMarginLeft: первичное вычисление', { marginLeft: cachedMarginLeft });
            return cachedMarginLeft;
        }
        return 0;
    }

    function refreshMarginLeftOnResize() {
        const newWidth = window.innerWidth;
        if (newWidth !== windowWidth) {
            windowWidth = newWidth;

            // Если ширина >= 1720px, кэшируем как 200
            if (windowWidth >= MIN_WINDOW_WIDTH) {
                cachedMarginLeft = 200;
                isMarginLeftInitialized = true;
                debugLog('refreshMarginLeftOnResize: ширина >= 1720px, установлено значение 200', {
                    windowWidth: windowWidth
                });
                return;
            }

            const element = findMarginElement();
            if (element) {
                const computedStyle = window.getComputedStyle(element);
                cachedMarginLeft = parseFloat(computedStyle.marginLeft) || 0;
                isMarginLeftInitialized = true;
                debugLog('refreshMarginLeftOnResize: обновлено при изменении ширины окна', {
                    marginLeft: cachedMarginLeft,
                    windowWidth: windowWidth
                });
            }
        }
    }

    function isSideBlockVisible() {
        const sideBlock = document.getElementById('avito-side-address-block');
        if (!sideBlock) return false;
        return sideBlock.classList.contains('visible');
    }

    function processAddressElement(element) {
        const OVERLAY_DURATION = 250;

        if (element.dataset.avitoProcessed === 'true') {
            return;
        }

        const originalText = element.innerText.trim();

        element.innerHTML = '';
        element.className = 'avito-address-copy';

        const contentWrapper = document.createElement('span');
        contentWrapper.className = 'avito-address-content';

        const textSpan = document.createElement('span');
        textSpan.textContent = originalText;
        contentWrapper.appendChild(textSpan);

        const iconSpan = document.createElement('span');
        iconSpan.className = 'copy-icon';
        iconSpan.textContent = ' ⎘';
        contentWrapper.appendChild(iconSpan);

        const overlay = document.createElement('div');
        overlay.className = 'avito-address-overlay';

        element.appendChild(contentWrapper);
        element.appendChild(overlay);

        element.dataset.avitoProcessed = 'true';

        let overlayTimeout = null;
        element.addEventListener('click', function(e) {
            overlay.classList.add('active');

            if (overlayTimeout) {
                clearTimeout(overlayTimeout);
            }

            overlayTimeout = setTimeout(() => {
                overlay.classList.remove('active');
                overlayTimeout = null;
            }, OVERLAY_DURATION);

            const textToCopy = originalText;
            GM_setClipboard(textToCopy, 'text');
        });
    }

    function initCopyLinkFeature_RealtyOffer() {
        const currentSection = getCurrentSection();
        if (currentSection !== 'realty' && currentSection !== 'realty-offer') {
            return;
        }

        const marginLeft = getMarginLeft();
        if (marginLeft >= 150) {
            debugLog('initCopyLinkFeature_RealtyOffer: метод отключен (marginLeft >= 150)', { marginLeft });
            return;
        }

        debugLog('initCopyLinkFeature_RealtyOffer: метод запущен', { marginLeft });

        const DIV_HEIGHT = 60;
        const TRIGGER_ZONE_HEIGHT = 60;
        const HOVER_DELAY = 150;
        const ANIMATION_DURATION_SHOW = 350;
        const ANIMATION_DURATION_HIDE = 500;
        const OVERLAY_DURATION = 250;

        GM_addStyle(`
            .avito-copy-link-container {
                position: fixed;
                top: -${DIV_HEIGHT}px;
                left: 0;
                width: 100%;
                height: ${DIV_HEIGHT}px;
                background-color: #0099f7;
                color: #ffffff;
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: top ${ANIMATION_DURATION_SHOW}ms ease-in-out;
                font-family: Arial, Helvetica Neue, Helvetica, sans-serif;
                font-size: 20px;
                font-weight: 500;
                user-select: none;
                box-shadow: none;
            }
            .avito-copy-link-container.hidden-by-sidebar {
                display: none !important;
            }
            .avito-copy-link-container.show {
                top: 0;
            }
            .avito-copy-link-container.hide {
                transition: top ${ANIMATION_DURATION_HIDE}ms ease-in-out;
            }
            .avito-copy-link-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: #353535;
                opacity: 0;
                pointer-events: none;
                transition: opacity ${OVERLAY_DURATION}ms ease-in-out;
                z-index: 1;
            }
            .avito-copy-link-overlay.active {
                opacity: 0.65;
            }
            .avito-copy-link-text {
                position: relative;
                z-index: 2;
                pointer-events: none;
                letter-spacing: 0.3px;
            }
        `);

        const container = document.createElement('div');
        container.className = 'avito-copy-link-container';
        container.id = 'avito-copy-link-container';

        const overlay = document.createElement('div');
        overlay.className = 'avito-copy-link-overlay';
        container.appendChild(overlay);

        const text = document.createElement('span');
        text.className = 'avito-copy-link-text';
        text.innerHTML = 'кликнуть для копирования ссылки на объявление 🏠';
        container.appendChild(text);

        document.body.appendChild(container);

        function checkAndHideIfSidebarVisible() {
            if (isSideBlockVisible()) {
                container.classList.add('hidden-by-sidebar');
                debugLog('initCopyLinkFeature_RealtyOffer: блок скрыт (видна боковая панель)');
            } else {
                container.classList.remove('hidden-by-sidebar');
                debugLog('initCopyLinkFeature_RealtyOffer: блок показан (боковая панель скрыта)');
            }
        }

        setTimeout(checkAndHideIfSidebarVisible, 100);

        const sidebarObserver = new MutationObserver(function() {
            checkAndHideIfSidebarVisible();
        });

        const sideBlock = document.getElementById('avito-side-address-block');
        if (sideBlock) {
            sidebarObserver.observe(sideBlock, {
                attributes: true,
                attributeFilter: ['class']
            });
            debugLog('initCopyLinkFeature_RealtyOffer: настроен наблюдатель за боковым блоком');
        }

        let showTimeout = null;
        let hideTimeout = null;
        let overlayTimeout = null;
        let isMouseInZone = false;
        let isDivVisible = false;

        function showDiv() {
            if (container.classList.contains('hidden-by-sidebar')) {
                debugLog('initCopyLinkFeature_RealtyOffer: попытка показать блок, но он скрыт боковой панелью');
                return;
            }

            if (showTimeout) {
                clearTimeout(showTimeout);
                showTimeout = null;
            }
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            container.classList.remove('hide');
            container.classList.add('show');
            isDivVisible = true;
            debugLog('initCopyLinkFeature_RealtyOffer: див показан');
        }

        function hideDiv() {
            if (showTimeout) {
                clearTimeout(showTimeout);
                showTimeout = null;
            }
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            container.classList.remove('show');
            container.classList.add('hide');
            hideTimeout = setTimeout(() => {
                container.classList.remove('hide');
                isDivVisible = false;
                hideTimeout = null;
                debugLog('initCopyLinkFeature_RealtyOffer: див скрыт');
            }, ANIMATION_DURATION_HIDE);
        }

        function tryShowWithDelay() {
            if (isSideBlockVisible()) {
                debugLog('initCopyLinkFeature_RealtyOffer: попытка показать блок, но видна боковая панель');
                return;
            }

            if (isDivVisible) return;

            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }

            if (isMouseInZone) {
                if (showTimeout) {
                    clearTimeout(showTimeout);
                    showTimeout = null;
                }

                showTimeout = setTimeout(() => {
                    if (isMouseInZone && !isDivVisible && !isSideBlockVisible()) {
                        showDiv();
                    }
                    showTimeout = null;
                }, HOVER_DELAY);
            }
        }

        document.addEventListener('mousemove', function(e) {
            const isInZone = e.clientY <= TRIGGER_ZONE_HEIGHT;
            isMouseInZone = isInZone;

            if (isInZone) {
                tryShowWithDelay();
            } else {
                if (showTimeout) {
                    clearTimeout(showTimeout);
                    showTimeout = null;
                }
                if (isDivVisible) {
                    hideDiv();
                }
            }
        });

        container.addEventListener('click', function(e) {
            overlay.classList.add('active');

            if (overlayTimeout) {
                clearTimeout(overlayTimeout);
            }

            overlayTimeout = setTimeout(() => {
                overlay.classList.remove('active');
                overlayTimeout = null;
            }, OVERLAY_DURATION);

            let currentUrl = window.location.href;
            const questionMarkIndex = currentUrl.indexOf('?');
            if (questionMarkIndex !== -1) {
                currentUrl = currentUrl.substring(0, questionMarkIndex);
            }

            GM_setClipboard(currentUrl, 'text');
            debugLog('initCopyLinkFeature_RealtyOffer: ссылка скопирована', { url: currentUrl });

            const originalText = text.innerHTML;
            text.innerHTML = '✅ Ссылка скопирована!';
            setTimeout(() => {
                text.innerHTML = originalText;
            }, 1500);
        });

        let scrollTimeout = null;
        window.addEventListener('scroll', function() {
            if (isDivVisible) {
                if (scrollTimeout) {
                    clearTimeout(scrollTimeout);
                }
                scrollTimeout = setTimeout(() => {
                    if (!isMouseInZone) {
                        hideDiv();
                    }
                    scrollTimeout = null;
                }, 100);
            }
        });

        document.addEventListener('visibilitychange', function() {
            if (document.hidden && isDivVisible) {
                hideDiv();
            }
        });

        document.addEventListener('mouseleave', function() {
            isMouseInZone = false;
            if (showTimeout) {
                clearTimeout(showTimeout);
                showTimeout = null;
            }
            if (isDivVisible) {
                hideDiv();
            }
        });

        const bodyObserver = new MutationObserver(function() {
            const sideBlock = document.getElementById('avito-side-address-block');
            if (sideBlock && !sidebarObserver.observe) {
                sidebarObserver.observe(sideBlock, {
                    attributes: true,
                    attributeFilter: ['class']
                });
                debugLog('initCopyLinkFeature_RealtyOffer: боковой блок найден, настроен наблюдатель');
                checkAndHideIfSidebarVisible();
            }
        });

        bodyObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function initCopyLocationFeature_RealtyMap() {
        const currentSection = getCurrentSection();
        if (currentSection !== 'realty' && currentSection !== 'realty-map') {
            return;
        }

        debugLog('initCopyLocationFeature_RealtyMap: метод запущен');

        const OVERLAY_DURATION = 250;

        GM_addStyle(`
            .avito-location-copy {
                cursor: pointer;
                position: relative;
                display: inline-block;
            }
            .avito-location-copy .copy-icon {
                margin-left: 6px;
                font-size: 0.9em;
                opacity: 0.7;
            }
            .avito-location-copy:hover .copy-icon {
                opacity: 1;
            }
            .avito-location-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: #656565;
                opacity: 0;
                pointer-events: none;
                transition: opacity ${OVERLAY_DURATION}ms ease-in-out;
                z-index: 1;
                border-radius: inherit;
            }
            .avito-location-overlay.active {
                opacity: 0.35;
            }
            .avito-location-content {
                position: relative;
                z-index: 2;
                display: flex;
                align-items: center;
            }
        `);

        function processLocationElement(element) {
            if (element.dataset.avitoProcessed === 'true') {
                return;
            }

            const originalText = element.innerText.trim();

            element.innerHTML = '';
            element.className = 'avito-location-copy';

            const contentWrapper = document.createElement('span');
            contentWrapper.className = 'avito-location-content';

            const textSpan = document.createElement('span');
            textSpan.textContent = originalText;
            contentWrapper.appendChild(textSpan);

            const iconSpan = document.createElement('span');
            iconSpan.className = 'copy-icon';
            iconSpan.textContent = ' ⎘';
            contentWrapper.appendChild(iconSpan);

            const overlay = document.createElement('div');
            overlay.className = 'avito-location-overlay';

            element.appendChild(contentWrapper);
            element.appendChild(overlay);

            element.dataset.avitoProcessed = 'true';

            let overlayTimeout = null;
            element.addEventListener('click', function(e) {
                overlay.classList.add('active');

                if (overlayTimeout) {
                    clearTimeout(overlayTimeout);
                }

                overlayTimeout = setTimeout(() => {
                    overlay.classList.remove('active');
                    overlayTimeout = null;
                }, OVERLAY_DURATION);

                const textToCopy = originalText;
                GM_setClipboard(textToCopy, 'text');
                debugLog('initCopyLocationFeature_RealtyMap: локация скопирована', { text: textToCopy });
            });
        }

        function findAndProcessLocationElements() {
            const elements = document.evaluate(
                "//div[@data-marker='item-location']",
                document,
                null,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                null
            );

            for (let i = 0; i < elements.snapshotLength; i++) {
                const element = elements.snapshotItem(i);
                if (element) {
                    processLocationElement(element);
                }
            }
        }

        const observer = new MutationObserver(function(mutations) {
            let shouldCheck = false;

            for (let mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    shouldCheck = true;
                    break;
                }
                if (mutation.type === 'attributes' || mutation.type === 'characterData') {
                    const target = mutation.target;
                    if (target.nodeType === Node.ELEMENT_NODE) {
                        const element = target.closest('[data-marker="item-location"]');
                        if (element && element.dataset.avitoProcessed !== 'true') {
                            shouldCheck = true;
                            break;
                        }
                    }
                }
            }

            if (shouldCheck) {
                findAndProcessLocationElements();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
            attributeFilter: ['data-marker', 'class', 'style']
        });

        findAndProcessLocationElements();
    }

    function initCopyAddressFeature_RealtyOffer() {
        const currentSection = getCurrentSection();
        if (currentSection !== 'realty' && currentSection !== 'realty-offer') {
            return;
        }

        debugLog('initCopyAddressFeature_RealtyOffer: метод запущен');

        GM_addStyle(`
            .avito-address-copy {
                cursor: pointer;
                position: relative;
                display: inline-block;
            }
            .avito-address-copy .copy-icon {
                margin-left: 6px;
                font-size: 0.9em;
                opacity: 0.7;
            }
            .avito-address-copy:hover .copy-icon {
                opacity: 1;
            }
            .avito-address-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: #656565;
                opacity: 0;
                pointer-events: none;
                transition: opacity 250ms ease-in-out;
                z-index: 1;
                border-radius: inherit;
            }
            .avito-address-overlay.active {
                opacity: 0.35;
            }
            .avito-address-content {
                position: relative;
                z-index: 2;
                display: flex;
                align-items: center;
            }
        `);

        function findAndProcessAddressElements() {
            const elements = document.evaluate(
                "//div[@itemprop='address']",
                document,
                null,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                null
            );

            for (let i = 0; i < elements.snapshotLength; i++) {
                const element = elements.snapshotItem(i);
                if (element) {
                    processAddressElement(element);
                }
            }
        }

        const observer = new MutationObserver(function(mutations) {
            let shouldCheck = false;

            for (let mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    shouldCheck = true;
                    break;
                }
                if (mutation.type === 'attributes' || mutation.type === 'characterData') {
                    const target = mutation.target;
                    if (target.nodeType === Node.ELEMENT_NODE) {
                        const element = target.closest('[itemprop="address"]');
                        if (element && element.dataset.avitoProcessed !== 'true') {
                            shouldCheck = true;
                            break;
                        }
                    }
                }
            }

            if (shouldCheck) {
                findAndProcessAddressElements();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
            attributeFilter: ['itemprop', 'class', 'style']
        });

        findAndProcessAddressElements();
    }

    function initSideAddressBlock_RealtyOffer() {
        const currentSection = getCurrentSection();
        if (currentSection !== 'realty' && currentSection !== 'realty-offer') {
            return;
        }

        const OVERLAY_DURATION = 250;
        const MIN_WIDTH = 150;
        const LINK_BLOCK_HEIGHT = 60;
        const TOP_OFFSET = 100;

        let ignoreMarginLeft = false;
        let ignoreTimeout = null;

        debugLog('initSideAddressBlock_RealtyOffer: инициализация бокового блока');

        const initialMarginLeft = getMarginLeft();
        debugLog('initSideAddressBlock_RealtyOffer: первичное получение margin-left', {
            marginLeft: initialMarginLeft,
            windowWidth: window.innerWidth,
            minWindowWidth: MIN_WINDOW_WIDTH
        });

        GM_addStyle(`
            .avito-side-address-block {
                position: fixed;
                top: ${TOP_OFFSET}px;
                left: 0;
                min-width: ${MIN_WIDTH}px;
                padding: 0 ${PADDING_RIGHT}px 0 ${PADDING_LEFT}px;
                font-family: Arial, Helvetica Neue, Helvetica, sans-serif;
                font-size: 14px;
                color: #333;
                z-index: 99999;
                display: none;
                background: none;
                box-shadow: none;
                border: none;
            }
            .avito-side-address-block.visible {
                display: block;
            }
            .avito-side-link-block {
                height: ${LINK_BLOCK_HEIGHT}px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                user-select: none;
                position: relative;
            }
            .avito-side-link-block .link-button {
                background-color: #0099f7;
                color: #ffffff;
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                font-family: Arial, Helvetica Neue, Helvetica, sans-serif;
                transition: opacity 0.2s ease;
                position: relative;
                z-index: 2;
                white-space: normal;
                word-wrap: break-word;
                max-width: 100%;
                text-align: center;
                line-height: 1.4;
                overflow: hidden;
            }
            .avito-side-link-block .link-button:hover {
                opacity: 0.9;
            }
            .avito-side-link-block .link-button:active {
                opacity: 0.8;
            }
            .avito-side-link-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: #353535;
                opacity: 0;
                pointer-events: none;
                transition: opacity ${OVERLAY_DURATION}ms ease-in-out;
                z-index: 3;
                border-radius: 4px;
            }
            .avito-side-link-overlay.active {
                opacity: 0.65;
            }
            .avito-side-address-block .address-wrapper {
                padding: 12px 0;
                border-top: 1px solid #e0e0e0;
                cursor: pointer;
                position: relative;
            }
            .avito-side-address-block .address-text {
                display: inline;
            }
            .avito-side-address-block .copy-icon-address {
                margin-left: 8px;
                font-size: 0.9em;
                opacity: 0.6;
            }
            .avito-side-address-block:hover .copy-icon-address {
                opacity: 1;
            }
            .avito-side-address-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: #656565;
                opacity: 0;
                pointer-events: none;
                transition: opacity ${OVERLAY_DURATION}ms ease-in-out;
                z-index: 1;
                border-radius: 0;
            }
            .avito-side-address-overlay.active {
                opacity: 0.35;
            }
            .avito-side-address-content {
                position: relative;
                z-index: 2;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .avito-side-characteristics {
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid #e0e0e0;
            }
            .avito-side-characteristics .char-title {
                font-weight: 600;
                font-size: 14px;
                color: #333;
                margin-bottom: 8px;
            }
            .avito-side-characteristics .char-item {
                font-size: 13px;
                color: #555;
                padding: 3px 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #f0f0f0;
            }
            .avito-side-characteristics .char-item:last-child {
                border-bottom: none;
            }
            .avito-side-characteristics .char-remove {
                cursor: pointer;
                color: #999;
                font-size: 12px;
                padding: 0 4px;
                transition: color 0.2s ease;
                user-select: none;
            }
            .avito-side-characteristics .char-remove:hover {
                color: #ff4444;
            }
            .avito-side-characteristics .char-empty {
                font-size: 13px;
                color: #999;
                font-style: italic;
            }
        `);

        const sideBlock = document.createElement('div');
        sideBlock.className = 'avito-side-address-block';
        sideBlock.id = 'avito-side-address-block';

        const linkBlock = document.createElement('div');
        linkBlock.className = 'avito-side-link-block';

        const button = document.createElement('button');
        button.className = 'link-button';
        const BUTTON_TEXT = 'Скопировать ссылку на\u00A0объявление';
        button.textContent = BUTTON_TEXT;

        const linkOverlay = document.createElement('div');
        linkOverlay.className = 'avito-side-link-overlay';
        button.appendChild(linkOverlay);

        linkBlock.appendChild(button);
        sideBlock.appendChild(linkBlock);

        const addressWrapper = document.createElement('div');
        addressWrapper.className = 'address-wrapper';

        const addressContentWrapper = document.createElement('span');
        addressContentWrapper.className = 'avito-side-address-content';

        const textSpan = document.createElement('span');
        textSpan.className = 'address-text';
        addressContentWrapper.appendChild(textSpan);

        const iconSpan = document.createElement('span');
        iconSpan.className = 'copy-icon-address';
        iconSpan.textContent = '⎘';
        addressContentWrapper.appendChild(iconSpan);

        addressWrapper.appendChild(addressContentWrapper);

        const addressOverlay = document.createElement('div');
        addressOverlay.className = 'avito-side-address-overlay';
        addressWrapper.appendChild(addressOverlay);

        sideBlock.appendChild(addressWrapper);
        document.body.appendChild(sideBlock);

        debugLog('initSideAddressBlock_RealtyOffer: блок создан и добавлен в DOM');

        let originalAddressElement = null;
        let linkOverlayTimeout = null;
        let addressOverlayTimeout = null;
        let lastBlockState = false;

        function updateBlockContent() {
            const addressElement = document.evaluate(
                "//div[@itemprop='address']",
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            ).singleNodeValue;

            if (addressElement && addressElement !== originalAddressElement) {
                originalAddressElement = addressElement;
                if (addressElement.dataset.avitoProcessed === 'true') {
                    const textNode = addressElement.querySelector('.avito-address-content span:first-child');
                    if (textNode) {
                        textSpan.textContent = textNode.textContent;
                    } else {
                        textSpan.textContent = addressElement.innerText.trim();
                    }
                } else {
                    textSpan.textContent = addressElement.innerText.trim();
                }
                debugLog('initSideAddressBlock_RealtyOffer: обновлен адрес', { address: textSpan.textContent });
            } else if (!addressElement) {
                originalAddressElement = null;
                textSpan.textContent = '';
                debugLog('initSideAddressBlock_RealtyOffer: элемент с адресом не найден');
            }
        }

        function updateBlockVisibility() {
            if (ignoreMarginLeft) {
                debugLog('initSideAddressBlock_RealtyOffer: игнорирование margin-left (режим стабилизации)');
                return;
            }

            // Проверяем, нужно ли показывать блок
            let shouldShow = false;
            let blockWidth = 0;

            const currentWidth = window.innerWidth;

            // Если ширина окна >= 1720px, используем формулу
            if (currentWidth >= MIN_WINDOW_WIDTH) {
                const extraSpace = currentWidth - MIN_WINDOW_WIDTH;
                blockWidth = (extraSpace / 2) + MIN_BLOCK_WIDTH;
                shouldShow = true;
                debugLog('initSideAddressBlock_RealtyOffer: ширина >= 1720px, блок показан по формуле', {
                    windowWidth: currentWidth,
                    extraSpace: extraSpace,
                    blockWidth: blockWidth,
                    minBlockWidth: MIN_BLOCK_WIDTH
                });
            } else {
                // Иначе используем margin-left
                const marginLeft = getMarginLeft();
                const minRequiredWidth = MIN_BLOCK_WIDTH + PADDING_LEFT + PADDING_RIGHT;
                shouldShow = marginLeft >= minRequiredWidth;
                blockWidth = marginLeft - PADDING_LEFT - PADDING_RIGHT;

                debugLog('initSideAddressBlock_RealtyOffer: проверка видимости через margin-left', {
                    marginLeft: marginLeft,
                    minRequiredWidth: minRequiredWidth,
                    shouldShow: shouldShow,
                    blockWidth: blockWidth,
                    windowWidth: currentWidth
                });
            }

            if (shouldShow && blockWidth >= MIN_BLOCK_WIDTH) {
                sideBlock.style.width = blockWidth + 'px';
                sideBlock.classList.add('visible');
                if (!lastBlockState) {
                    debugLog('initSideAddressBlock_RealtyOffer: блок ПОКАЗАН', {
                        width: blockWidth + 'px',
                        windowWidth: currentWidth
                    });
                    lastBlockState = true;

                    if (ignoreTimeout) {
                        clearTimeout(ignoreTimeout);
                    }
                    ignoreMarginLeft = true;
                    debugLog('initSideAddressBlock_RealtyOffer: включен режим игнорирования margin-left на 2 секунды');

                    ignoreTimeout = setTimeout(() => {
                        ignoreMarginLeft = false;
                        ignoreTimeout = null;
                        debugLog('initSideAddressBlock_RealtyOffer: режим игнорирования margin-left ОТКЛЮЧЕН');
                        updateBlockVisibility();
                    }, 2000);
                }
            } else {
                sideBlock.classList.remove('visible');
                if (lastBlockState) {
                    debugLog('initSideAddressBlock_RealtyOffer: блок СКРЫТ', {
                        reason: shouldShow ? 'blockWidth < MIN_BLOCK_WIDTH' : 'условие не выполнено',
                        blockWidth: blockWidth,
                        minBlockWidth: MIN_BLOCK_WIDTH,
                        windowWidth: currentWidth
                    });
                    lastBlockState = false;
                }
            }
        }

        function updateBlock() {
            updateBlockContent();
            updateBlockVisibility();
        }

        button.addEventListener('click', function(e) {
            e.stopPropagation();

            linkOverlay.classList.add('active');

            if (linkOverlayTimeout) {
                clearTimeout(linkOverlayTimeout);
            }

            linkOverlayTimeout = setTimeout(() => {
                linkOverlay.classList.remove('active');
                linkOverlayTimeout = null;
            }, OVERLAY_DURATION);

            let currentUrl = window.location.href;
            const questionMarkIndex = currentUrl.indexOf('?');
            if (questionMarkIndex !== -1) {
                currentUrl = currentUrl.substring(0, questionMarkIndex);
            }
            GM_setClipboard(currentUrl, 'text');
            debugLog('initSideAddressBlock_RealtyOffer: ссылка скопирована', { url: currentUrl });
        });

        addressWrapper.addEventListener('click', function(e) {
            const textToCopy = textSpan.textContent;
            if (!textToCopy) return;

            addressOverlay.classList.add('active');

            if (addressOverlayTimeout) {
                clearTimeout(addressOverlayTimeout);
            }

            addressOverlayTimeout = setTimeout(() => {
                addressOverlay.classList.remove('active');
                addressOverlayTimeout = null;
            }, OVERLAY_DURATION);

            GM_setClipboard(textToCopy, 'text');
            debugLog('initSideAddressBlock_RealtyOffer: адрес скопирован', { address: textToCopy });
        });

        window.addEventListener('resize', function() {
            refreshMarginLeftOnResize();
            debugLog('initSideAddressBlock_RealtyOffer: событие resize - обновление видимости', {
                windowWidth: window.innerWidth,
                marginLeft: cachedMarginLeft
            });
            updateBlockVisibility();
        });

        const mutationObserver = new MutationObserver(function(mutations) {
            let shouldUpdate = false;

            for (let mutation of mutations) {
                if (mutation.type === 'childList' || mutation.type === 'attributes' || mutation.type === 'characterData') {
                    const target = mutation.target;
                    if (target.nodeType === Node.ELEMENT_NODE) {
                        const addressElement = target.closest('[itemprop="address"]');
                        if (addressElement) {
                            shouldUpdate = true;
                            debugLog('initSideAddressBlock_RealtyOffer: обнаружено изменение адреса');
                            break;
                        }
                    }
                }
            }

            if (shouldUpdate) {
                debugLog('initSideAddressBlock_RealtyOffer: запуск обновления блока (изменение адреса)');
                updateBlock();
            }
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
            attributeFilter: ['itemprop', 'class', 'style']
        });

        debugLog('initSideAddressBlock_RealtyOffer: MutationObserver настроен');

        updateBlock();

        if (document.readyState === 'complete') {
            debugLog('initSideAddressBlock_RealtyOffer: страница полностью загружена, дополнительные проверки');
            setTimeout(() => {
                debugLog('initSideAddressBlock_RealtyOffer: дополнительная проверка через 100ms');
                updateBlock();
            }, 100);

            setTimeout(() => {
                debugLog('initSideAddressBlock_RealtyOffer: дополнительная проверка через 500ms');
                updateBlock();
            }, 500);

            setTimeout(() => {
                debugLog('initSideAddressBlock_RealtyOffer: дополнительная проверка через 1000ms');
                updateBlock();
            }, 1000);
        } else {
            window.addEventListener('load', function() {
                debugLog('initSideAddressBlock_RealtyOffer: событие load, дополнительные проверки');
                setTimeout(() => {
                    debugLog('initSideAddressBlock_RealtyOffer: дополнительная проверка после load через 100ms');
                    updateBlock();
                }, 100);

                setTimeout(() => {
                    debugLog('initSideAddressBlock_RealtyOffer: дополнительная проверка после load через 500ms');
                    updateBlock();
                }, 500);

                setTimeout(() => {
                    debugLog('initSideAddressBlock_RealtyOffer: дополнительная проверка после load через 1000ms');
                    updateBlock();
                }, 1000);
            });
        }
    }

    function initSelectCharacteristics_RealtyOffer() {
        const currentSection = getCurrentSection();
        if (currentSection !== 'realty' && currentSection !== 'realty-offer') {
            return;
        }

        const ulElement = document.evaluate(
            "//div[@id='bx_item-params']/h2[text()='О помещении']//following-sibling::ul",
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;

        if (!ulElement) {
            debugLog('initSelectCharacteristics_RealtyOffer: ulElement не найден');
            return;
        }

        debugLog('initSelectCharacteristics_RealtyOffer: метод запущен');

        const STORAGE_KEY = 'avito_selected_characteristics';

        GM_addStyle(`
            .avito-select-hint {
                font-size: 13px;
                color: #666;
                padding: 8px 0 8px 20px;
                cursor: pointer;
                user-select: none;
                transition: color 0.2s ease;
                border-left: 3px solid transparent;
                margin-top: 4px;
            }
            .avito-select-hint:hover {
                color: #0099f7;
                border-left-color: #0099f7;
            }
            .avito-select-hint.active {
                color: #0099f7;
                border-left-color: #0099f7;
            }
            .avito-select-hint.hidden {
                display: none;
            }
            .avito-characteristics-ul {
                border: 2px solid #0099f7 !important;
                border-radius: 4px;
                padding: 8px 0 8px 20px !important;
                transition: border-color 0.3s ease;
            }
            .avito-characteristics-ul li {
                cursor: pointer;
                transition: all 0.2s ease;
                padding: 4px 8px;
                border-radius: 3px;
                list-style: none;
                margin: 2px 0;
            }
            .avito-characteristics-ul li:hover {
                text-decoration: underline;
                text-decoration-color: #0099f7;
                background-color: rgba(0, 153, 247, 0.05);
            }
            .avito-characteristics-ul li.selected {
                background-color: rgba(0, 153, 247, 0.1);
                border-left: 3px solid #0099f7;
            }
            .avito-side-characteristics .char-remove {
                display: none;
            }
            .avito-side-characteristics.show-remove .char-remove {
                display: inline-block;
            }
        `);

        function getSavedCharacteristics() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                return saved ? JSON.parse(saved) : [];
            } catch (e) {
                debugLog('initSelectCharacteristics_RealtyOffer: ошибка чтения localStorage', { error: e });
                return [];
            }
        }

        function saveCharacteristics(chars) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(chars));
                debugLog('initSelectCharacteristics_RealtyOffer: характеристики сохранены', { chars });
            } catch (e) {
                debugLog('initSelectCharacteristics_RealtyOffer: ошибка сохранения в localStorage', { error: e });
            }
        }

        const hintBlock = document.createElement('div');
        hintBlock.className = 'avito-select-hint';
        hintBlock.textContent = 'Кликните, чтобы выбрать "характеристика-значение", которые нужно всегда выводить в блоке краткой информации об объекте';

        ulElement.parentNode.insertBefore(hintBlock, ulElement.nextSibling);

        let selectedCharacteristics = [];
        let isUlActive = false;
        let isHintHidden = false;

        function updateSideCharacteristics() {
            let charContainer = document.querySelector('.avito-side-characteristics');

            if (!charContainer) {
                const sideBlock = document.getElementById('avito-side-address-block');
                if (!sideBlock) return;

                charContainer = document.createElement('div');
                charContainer.className = 'avito-side-characteristics';
                sideBlock.appendChild(charContainer);
            }

            if (isHintHidden) {
                charContainer.classList.add('show-remove');
            } else {
                charContainer.classList.remove('show-remove');
            }

            charContainer.innerHTML = '';

            if (selectedCharacteristics.length > 0) {
                const title = document.createElement('div');
                title.className = 'char-title';
                title.textContent = 'Характеристики';
                charContainer.appendChild(title);

                selectedCharacteristics.forEach((char, index) => {
                    const charItem = document.createElement('div');
                    charItem.className = 'char-item';

                    const charText = document.createElement('span');
                    charText.textContent = char;
                    charItem.appendChild(charText);

                    const removeBtn = document.createElement('span');
                    removeBtn.className = 'char-remove';
                    removeBtn.textContent = '✕';
                    removeBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        selectedCharacteristics.splice(index, 1);
                        saveCharacteristics(selectedCharacteristics);
                        updateLiStates();
                        updateSideCharacteristics();
                        if (selectedCharacteristics.length === 0) {
                            ulElement.classList.remove('avito-characteristics-ul');
                            isUlActive = false;
                            hintBlock.classList.remove('active');
                            hintBlock.classList.remove('hidden');
                            isHintHidden = false;
                            updateSideCharacteristics();
                        }
                    });
                    charItem.appendChild(removeBtn);

                    charContainer.appendChild(charItem);
                });
            }
        }

        function updateLiStates() {
            const liElements = ulElement.querySelectorAll('li');
            liElements.forEach(li => {
                const text = li.textContent.trim();
                if (selectedCharacteristics.includes(text)) {
                    li.classList.add('selected');
                } else {
                    li.classList.remove('selected');
                }
            });
        }

        function applySavedCharacteristics() {
            const savedChars = getSavedCharacteristics();
            if (savedChars.length === 0) {
                debugLog('initSelectCharacteristics_RealtyOffer: сохраненных характеристик нет');
                return;
            }

            debugLog('initSelectCharacteristics_RealtyOffer: загружены сохраненные характеристики', { savedChars });

            const liElements = ulElement.querySelectorAll('li');
            let foundAny = false;

            liElements.forEach(li => {
                const text = li.textContent.trim();
                if (savedChars.includes(text) && !selectedCharacteristics.includes(text)) {
                    selectedCharacteristics.push(text);
                    li.classList.add('selected');
                    foundAny = true;
                }
            });

            if (foundAny) {
                debugLog('initSelectCharacteristics_RealtyOffer: применены сохраненные характеристики', {
                    count: selectedCharacteristics.length,
                    chars: selectedCharacteristics
                });
                updateSideCharacteristics();
            } else {
                debugLog('initSelectCharacteristics_RealtyOffer: ни одна сохраненная характеристика не найдена в текущем списке');
            }
        }

        function enableSelectionMode() {
            isUlActive = true;
            ulElement.classList.add('avito-characteristics-ul');
            hintBlock.classList.add('active');
            hintBlock.classList.add('hidden');
            isHintHidden = true;
            updateSideCharacteristics();
            debugLog('initSelectCharacteristics_RealtyOffer: режим выбора ВКЛЮЧЕН');
        }

        function disableSelectionMode() {
            isUlActive = false;
            ulElement.classList.remove('avito-characteristics-ul');
            hintBlock.classList.remove('active');
            hintBlock.classList.remove('hidden');
            isHintHidden = false;
            selectedCharacteristics = [];
            saveCharacteristics(selectedCharacteristics);
            updateLiStates();
            updateSideCharacteristics();
            debugLog('initSelectCharacteristics_RealtyOffer: режим выбора ВЫКЛЮЧЕН');
        }

        hintBlock.addEventListener('click', function() {
            if (!isUlActive) {
                enableSelectionMode();
            } else {
                disableSelectionMode();
            }
        });

        ulElement.querySelectorAll('li').forEach(li => {
            li.addEventListener('click', function(e) {
                e.stopPropagation();

                if (!isUlActive) return;

                const text = this.textContent.trim();
                const index = selectedCharacteristics.indexOf(text);

                if (index === -1) {
                    selectedCharacteristics.push(text);
                    this.classList.add('selected');
                    debugLog('initSelectCharacteristics_RealtyOffer: добавлена характеристика', { text });
                } else {
                    selectedCharacteristics.splice(index, 1);
                    this.classList.remove('selected');
                    debugLog('initSelectCharacteristics_RealtyOffer: удалена характеристика', { text });
                }

                saveCharacteristics(selectedCharacteristics);
                updateSideCharacteristics();

                if (selectedCharacteristics.length === 0) {
                    disableSelectionMode();
                }
            });
        });

        applySavedCharacteristics();

        hintBlock.classList.remove('hidden');
        isHintHidden = false;
        isUlActive = false;
        ulElement.classList.remove('avito-characteristics-ul');

        const observer = new MutationObserver(function() {
            const existingLi = ulElement.querySelectorAll('li:not([data-avito-processed])');

            existingLi.forEach(li => {
                li.dataset.avitoProcessed = 'true';
                const newLi = li.cloneNode(true);
                li.parentNode.replaceChild(newLi, li);

                newLi.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (!isUlActive) return;

                    const text = this.textContent.trim();
                    const index = selectedCharacteristics.indexOf(text);

                    if (index === -1) {
                        selectedCharacteristics.push(text);
                        this.classList.add('selected');
                    } else {
                        selectedCharacteristics.splice(index, 1);
                        this.classList.remove('selected');
                    }

                    saveCharacteristics(selectedCharacteristics);
                    updateSideCharacteristics();

                    if (selectedCharacteristics.length === 0) {
                        disableSelectionMode();
                    }
                });
            });
        });

        observer.observe(ulElement, {
            childList: true,
            subtree: true
        });
    }

    function init() {
        if (document.readyState === 'complete') {
            initCopyLinkFeature_RealtyOffer();
            initCopyLocationFeature_RealtyMap();
            initCopyAddressFeature_RealtyOffer();
            initSideAddressBlock_RealtyOffer();
            initSelectCharacteristics_RealtyOffer();
        } else {
            window.addEventListener('load', function() {
                initCopyLinkFeature_RealtyOffer();
                initCopyLocationFeature_RealtyMap();
                initCopyAddressFeature_RealtyOffer();
                initSideAddressBlock_RealtyOffer();
                initSelectCharacteristics_RealtyOffer();
            });
        }
    }

    init();

})();