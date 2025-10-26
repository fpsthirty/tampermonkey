// ==UserScript==
// @name         Twitch Chat Commands from Title
// @namespace    http://tampermonkey.net/
// @version      1.16
// @description  Make !commands in stream title clickable
// @author       fpsthirty + DeepSeek
// @match        https://www.twitch.tv/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=twitch.tv
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Система отладки
    let isDebugged = false;

    // Методы для управления отладкой (доступны в консоли)
    window.enableTwitchDebug = function() {
        isDebugged = true;
        console.log('🔧 Twitch Commands Script: Debug mode ENABLED');
    };

    window.disableTwitchDebug = function() {
        isDebugged = false;
        console.log('🔧 Twitch Commands Script: Debug mode DISABLED');
    };

    window.getTwitchDebugStatus = function() {
        return isDebugged;
    };

    // Функция для логирования
    function debugLog(...args) {
        if (isDebugged) {
            console.log('🔧 Twitch Commands Script:', ...args);
        }
    }

    // Выводим инструкцию один раз при загрузке
    console.log('🔧 Twitch Commands Script: Loaded! Use enableTwitchDebug() in console to see logs');

    let observer = null;
    let navObserver = null;
    let isInitialized = false;
    let isHovering = false;
    let lastNavCheck = 0;
    let lastHoverTime = 0;
    let navCheckTimeout = null;
    let initialProcessAttempts = 0;
    const MAX_INITIAL_ATTEMPTS = 10;

    // Храним оригинальный текст заголовка для сравнения
    let lastOriginalTitle = '';

    // Защита от множественных кликов
    let lastCommandClickTime = 0;
    const CLICK_THROTTLE_MS = 1000; // 1 секунда

    function init() {
        if (isInitialized) {
            debugLog('Already initialized, skipping...');
            return;
        }

        debugLog('Starting main initialization...');

        // Ждём, пока заголовок появится и будет непустым
        const titleElement = document.querySelector('[data-a-target="stream-title"]');
        if (!titleElement) {
            debugLog('Title element not found, will retry in 2 seconds...');
            setTimeout(init, 2000);
            return;
        }

        // Проверяем, что заголовок не пустой (старая логика)
        const titleText = titleElement.textContent || titleElement.innerText || '';
        debugLog(`Current title content: "${titleText}"`);
        debugLog(`Title length: ${titleText.length}, trimmed length: ${titleText.trim().length}`);

        if (!titleText.trim() && initialProcessAttempts < MAX_INITIAL_ATTEMPTS) {
            initialProcessAttempts++;
            debugLog(`Title is empty, retrying... (attempt ${initialProcessAttempts}/${MAX_INITIAL_ATTEMPTS})`);
            setTimeout(init, 1000);
            return;
        }

        if (!titleText.trim()) {
            debugLog('Title still empty after maximum attempts, but setting up listeners anyway...');
        } else {
            debugLog('Title has content, proceeding with initialization...');
        }

        debugLog('Title element found with content, setting up hover listeners...');

        // Сохраняем оригинальный текст
        lastOriginalTitle = getOriginalTitleText(titleElement);
        debugLog(`Initial original title saved: "${lastOriginalTitle}"`);

        // Обрабатываем заголовок сразу при загрузке
        debugLog('Performing initial title processing...');
        processTitle(titleElement);

        // Добавляем обработчики hover
        titleElement.addEventListener('mouseenter', function() {
            const now = Date.now();
            const timeSinceLastHover = now - lastHoverTime;

            if (!isHovering) {
                debugLog('Mouse entered title after ' + timeSinceLastHover + 'ms');
                isHovering = true;
                lastHoverTime = now;

                // Всегда обрабатываем заголовок при первом наведении
                debugLog('Processing title on first hover...');
                processTitle(titleElement);

                // Запускаем наблюдение только если его нет
                startObservation(titleElement);
            }
        });

        titleElement.addEventListener('mouseleave', function() {
            debugLog('Mouse left title, stopping observation...');
            isHovering = false;
            stopObservation();
        });

        // Делегирование событий на весь документ
        document.addEventListener('click', function(event) {
            if (event.target.classList.contains('twitch-command-btn')) {
                debugLog('Command button clicked!', event.target);
                event.preventDefault();
                event.stopPropagation();

                const command = event.target.getAttribute('data-command');
                debugLog('Command to send:', command);

                // Защита от множественных кликов
                const now = Date.now();
                const timeSinceLastClick = now - lastCommandClickTime;

                if (timeSinceLastClick < CLICK_THROTTLE_MS) {
                    debugLog(`Click throttled - ${timeSinceLastClick}ms since last click (min ${CLICK_THROTTLE_MS}ms)`);
                    return;
                }

                lastCommandClickTime = now;
                sendChatMessage(command);
            }
        });

        isInitialized = true;
        debugLog('Initialization complete successfully');

        // ЗАПУСКАЕМ навигационный observer ТОЛЬКО после успешной инициализации
        setupNavigationObserver();
    }

    // Функция для получения оригинального текста заголовка (без наших кнопок)
    function getOriginalTitleText(titleElement) {
        // Создаем временный элемент, чтобы убрать наши кнопки
        const tempElement = titleElement.cloneNode(true);
        const buttons = tempElement.querySelectorAll('.twitch-command-btn');
        buttons.forEach(btn => {
            // Заменяем кнопку на просто текст команды
            const textNode = document.createTextNode(btn.getAttribute('data-command'));
            btn.parentNode.replaceChild(textNode, btn);
        });
        return tempElement.textContent || tempElement.innerText || '';
    }

    // Функция: Проверка, что трансляция идет онлайн
    function isStreamLive() {
        // Ищем индикатор онлайн-трансляции по вашему локатору
        const liveIndicator = document.querySelector('div.channel-info-content div.tw-channel-status-text-indicator');

        if (liveIndicator) {
            const indicatorText = liveIndicator.textContent || liveIndicator.innerText || '';
            debugLog(`Live indicator found with text: "${indicatorText}"`);
            // Если найден элемент — трансляция онлайн
            return true;
        } else {
            debugLog('Live indicator not found - stream is not live (VOD/offline)');
            return false;
        }
    }

    function setupNavigationObserver() {
        debugLog('Setting up optimized navigation observer...');

        // Останавливаем предыдущий observer, если он был
        if (navObserver) {
            navObserver.disconnect();
            navObserver = null;
        }

        navObserver = new MutationObserver(function(mutations) {
            const now = Date.now();
            const timeSinceLastCheck = now - lastNavCheck;

            // Проверяем не чаще чем раз в 60 секунд
            if (timeSinceLastCheck < 60000) {
                return;
            }

            lastNavCheck = now;
            debugLog('Navigation change detected (throttled), checking for new content...');

            if (navCheckTimeout) {
                clearTimeout(navCheckTimeout);
            }

            // Делаем проверку с задержкой, чтобы избежать множественных срабатываний
            navCheckTimeout = setTimeout(() => {
                const titleElement = document.querySelector('[data-a-target="stream-title"]');
                if (titleElement) {
                    const currentOriginalTitle = getOriginalTitleText(titleElement);
                    debugLog(`Navigation check - current original title: "${currentOriginalTitle}"`);
                    debugLog(`Navigation check - last original title: "${lastOriginalTitle}"`);

                    // Сравниваем с последним сохраненным оригинальным текстом
                    if (currentOriginalTitle !== lastOriginalTitle) {
                        debugLog('Title actually changed, reinitializing...');
                        lastOriginalTitle = currentOriginalTitle;
                        isInitialized = false;
                        initialProcessAttempts = 0;
                        stopObservation();
                        setTimeout(init, 1000);
                    } else {
                        debugLog('Title content is the same, no need to reinitialize');
                    }
                }
            }, 500);
        });

        navObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        debugLog('Navigation observer started successfully');
    }

    function startObservation(titleElement) {
        if (observer) {
            debugLog('Observer already running, skipping...');
            return;
        }

        debugLog('Setting up mutation observer...');

        observer = new MutationObserver(function(mutations) {
            // Обрабатываем изменения только если курсор на заголовке
            if (isHovering) {
                const currentOriginalTitle = getOriginalTitleText(titleElement);
                debugLog(`Mutation detected - current original: "${currentOriginalTitle}"`);
                debugLog(`Mutation detected - last original: "${lastOriginalTitle}"`);

                // Сравниваем с последним сохраненным оригинальным текстом
                if (currentOriginalTitle !== lastOriginalTitle) {
                    debugLog('Title actually changed while hovering, processing title...');
                    lastOriginalTitle = currentOriginalTitle;
                    processTitle(titleElement);
                } else {
                    debugLog('Title content is the same (probably our own changes), skipping processing');
                }
            }
        });

        const observerConfig = {
            childList: true,
            subtree: true,
            characterData: true
        };

        observer.observe(titleElement, observerConfig);
        debugLog('Mutation observer started successfully');
    }

    function stopObservation() {
        if (observer) {
            debugLog('Disconnecting mutation observer...');
            observer.disconnect();
            observer = null;
        }
        debugLog('Observation stopped');
    }

    function processTitle(titleElement) {
        debugLog('Starting title processing...');

        // Работаем только с онлайн-трансляциями
        if (!isStreamLive()) {
            debugLog('Stream is not live (VOD/offline), skipping command processing...');

            // Удаляем существующие кнопки, если они есть (на случай переключения с live на VOD)
            const existingButtons = titleElement.querySelectorAll('.twitch-command-btn');
            if (existingButtons.length > 0) {
                debugLog(`Removing ${existingButtons.length} existing buttons because stream is not live`);
                existingButtons.forEach(btn => {
                    const textNode = document.createTextNode(btn.getAttribute('data-command'));
                    btn.parentNode.replaceChild(textNode, btn);
                });
            }
            return;
        }

        debugLog('Stream is live, proceeding with command processing...');

        // Проверяем, что заголовок не пустой
        const titleText = titleElement.textContent || titleElement.innerText || '';
        debugLog(`Processing title with content: "${titleText}"`);
        debugLog(`Title processing - length: ${titleText.length}, trimmed: ${titleText.trim().length}`);

        if (!titleText.trim()) {
            debugLog('Title is empty, skipping processing...');
            return;
        }

        // Сохраняем исходный HTML
        const originalHTML = titleElement.innerHTML;

        // Регулярное выражение для поиска команд
        const commandRegex = /(^|\s)(![\w\u0400-\u04FF\d]+)/g;

        // Проверяем, есть ли команды в тексте ДО обработки
        const preCheckMatches = [];
        let match;
        const testRegex = new RegExp(commandRegex.source, 'g');
        while ((match = testRegex.exec(titleText)) !== null) {
            preCheckMatches.push(match[2]);
        }
        debugLog(`Pre-check - found ${preCheckMatches.length} command(s) in raw text:`, preCheckMatches);

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = originalHTML;

        let hasChanges = false;
        let commandsFound = 0;

        function processNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;

                // Используем улучшенную замену с учётом групп регулярного выражения
                const newHTML = text.replace(commandRegex, function(match, prefix, command) {
                    commandsFound++;
                    debugLog(`Found command in text node: "${command}" with prefix: "${prefix}"`);
                    return prefix + '<button class="twitch-command-btn" data-command="' + command + '">' + command + '</button>';
                });

                if (newHTML !== text) {
                    const span = document.createElement('span');
                    span.innerHTML = newHTML;
                    node.parentNode.replaceChild(span, node);
                    hasChanges = true;
                }
            } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('twitch-command-btn')) {
                node.childNodes.forEach(child => processNode(child));
            }
        }

        debugLog('Processing DOM nodes...');
        tempDiv.childNodes.forEach(processNode);

        if (commandsFound > 0) {
            debugLog(`Total commands found during processing: ${commandsFound}`);
        } else {
            debugLog('No commands found in title during processing');
        }

        const shouldApplyChanges = hasChanges && (commandsFound > 0);

        if (shouldApplyChanges) {
            debugLog('Applying changes to title (found new commands)...');
            titleElement.innerHTML = tempDiv.innerHTML;

            styleAllCommandButtons(titleElement);

            debugLog('Title processing complete - buttons added and styled');

            const afterText = titleElement.textContent || titleElement.innerText || '';
            debugLog(`Title content AFTER processing: "${afterText}"`);
        } else if (!hasChanges) {
            debugLog('No changes needed in title');
        } else {
            debugLog('No new commands found, skipping processing');
        }
    }

    // Функция: Стилизация всех кнопок команд
    function styleAllCommandButtons(titleElement) {
        const buttons = titleElement.querySelectorAll('.twitch-command-btn');
        debugLog(`Styling ${buttons.length} buttons (including existing ones)...`);

        buttons.forEach(btn => {
            btn.style.cssText = `
                background: rgba(145, 71, 255, 0.2);
                border: 1px solid #9147ff;
                color: #9147ff;
                padding: 2px 6px;
                margin: 1px 2px;
                border-radius: 4px;
                cursor: pointer;
                font-size: inherit;
                font-family: inherit;
                display: inline;
                transition: all 0.3s ease;
                position: relative;
            `;

            btn.replaceWith(btn.cloneNode(true));
        });

        const freshButtons = titleElement.querySelectorAll('.twitch-command-btn');
        freshButtons.forEach(btn => {
            // Hover эффекты
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(145, 71, 255, 0.2)';
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'rgba(145, 71, 255, 0)';
            });

            // Эффект нажатия (зажата ЛКМ)
            btn.addEventListener('mousedown', () => {
                btn.style.transform = 'translateY(1px)';
                btn.style.background = 'rgba(145, 71, 255, 0.4)';
                btn.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.2) inset';
            });

            btn.addEventListener('mouseup', () => {
                btn.style.transform = 'translateY(0px)';
                btn.style.background = 'rgba(145, 71, 255, 0.2)';
                btn.style.boxShadow = 'none';
            });

            // На случай если кнопку отпустили вне элемента
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translateY(0px)';
                btn.style.background = 'rgba(145, 71, 255, 0)';
                btn.style.boxShadow = 'none';
            });
        });

        debugLog(`Successfully styled ${freshButtons.length} buttons with hover and click effects`);
    }

    function sendChatMessage(message) {
        console.log('🔧 Twitch Commands Script: Starting message sending process');
        console.log('🔧 Twitch Commands Script: Command to send:', message);

        debugLog('Searching for chat input...');
        let chatInput = document.querySelector("div[data-test-selector='chat-input'] [contenteditable='true']");

        if (!chatInput) {
            debugLog('Trying alternative selector 1...');
            chatInput = document.querySelector("[data-a-target='chat-input']");
        }

        if (!chatInput) {
            debugLog('Trying alternative selector 2...');
            chatInput = document.querySelector("textarea, [contenteditable='true']");
        }

        if (!chatInput) {
            console.log('🔧 Twitch Commands Script: ERROR: No chat input found after trying all selectors');
            return;
        }

        debugLog('Chat input found successfully');

        try {
            debugLog('Focusing on chat input...');
            chatInput.focus();

            debugLog('Clearing chat input...');
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(chatInput);
            selection.removeAllRanges();
            selection.addRange(range);

            document.execCommand('delete');
            debugLog('Chat input cleared');

            debugLog('Creating paste event...');
            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: new DataTransfer(),
                bubbles: true,
                cancelable: true
            });
            pasteEvent.clipboardData.setData('text/plain', message);

            debugLog('Dispatching paste event...');
            const pasteResult = chatInput.dispatchEvent(pasteEvent);
            debugLog('Paste event result:', pasteResult);

            setTimeout(() => {
                debugLog('Looking for send button...');
                const sendButton = document.querySelector('[data-a-target="chat-send-button"]');

                if (sendButton) {
                    debugLog('Send button found, disabled status:', sendButton.disabled);
                } else {
                    debugLog('Send button not found');
                }

                if (sendButton && !sendButton.disabled) {
                    debugLog('Clicking send button...');
                    sendButton.click();
                    console.log('🔧 Twitch Commands Script: Message sent successfully!');
                } else {
                    debugLog('Send button not available or disabled, trying Enter key...');

                    const enterEvent = new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true
                    });
                    chatInput.dispatchEvent(enterEvent);
                    debugLog('Enter key event dispatched');
                }
            }, 150);

        } catch (error) {
            console.log('🔧 Twitch Commands Script: ERROR in sendChatMessage:', error);
        }
    }

    if (document.readyState === 'loading') {
        debugLog('Document loading, waiting for DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', init);
    } else {
        debugLog('Document already ready, initializing...');
        init();
    }

    debugLog('Basic setup complete, main initialization will start soon...');

})();