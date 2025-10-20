// ==UserScript==
// @name         Twitch Popper Hider v2.16
// @namespace    https://www.tampermonkey.net/
// @version      2.16
// @description  скрытие всплывашки о предлагаемом стриме в сайдбаре спустя 2.5–5сек после потери фокуса с сайдбара
// @author       fpsthirty + DeepSeek
// @match        https://www.twitch.tv/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

/*
режим работы скрипта:
• Навели курсор на side-nav-card → ▶️ Включение основного скрипта + 🔓 Показать ранее скрытые всплывашки сайдбара, относящиеся к аватару стрима в hover-состоянии
• Убрали курсор с side-nav-card → ⏰ Скрыть всплывашки через 5 сек
• Скрыли элемент → ⏸️ Пауза основного скрипта
*/

(function() {
    'use strict';

    let isDebugged = false;
    if (isDebugged) {
        console.log('🚀 Twitch Popper Hider Full Logging активирован');
    }

    let hiddenCount = 0;
    const processedElements = new Set();
    const hiddenElements = new Map();
    let isActive = true;
    let checkInterval = 2000;
    let inactivityTimer = null;
    let hoverDelayTimer = null;
    let isHoveringSideNav = false;
    let isPausedAfterHide = false;

    // Счётчики для отладки
    let debugCheckCounter = 0;
    let debugMutationCounter = 0;
    let debugScheduleCounter = 0;
    let debugPopperFoundCounter = 0;


    // Для умной паузы observer
    let consecutiveSkippedMutations = 0;
    let consecutiveNoPoppersFound = 0;
    const MAX_CONSECUTIVE_SKIPS = 10;
    const MAX_CONSECUTIVE_NO_POPPERS = 10;
    let observerPaused = false;

    function increaseCheckFrequency() {
        if (checkInterval > 2000) {
            checkInterval = 2000;
            if (isDebugged) {
                console.log('⚡ Повышена частота проверок до 2 секунд');
            }
            restartInterval();
        }
    }

    function decreaseCheckFrequency() {
        if (checkInterval < 30000) {
            checkInterval = 30000;
            if (isDebugged) {
                console.log('🐢 Понижена частота проверок до 30 секунд');
            }
            restartInterval();
        }
    }

    function restartInterval() {
        if (window._checkIntervalId) {
            clearInterval(window._checkIntervalId);
        }
        window._checkIntervalId = setInterval(findAndSchedulePoppers, checkInterval);
    }

    function pauseAfterHiding() {
        isPausedAfterHide = true;
        if (isDebugged) {
            console.log('⏸️ ПАУЗА: Проверки приостановлены до наведения на side-nav-card');
        }
        decreaseCheckFrequency();
    }

    function resumeAfterHover() {
        if (isPausedAfterHide) {
            isPausedAfterHide = false;
            if (isDebugged) {
                console.log('▶️ ВОЗОБНОВЛЕНИЕ: Проверки возобновлены (наведение на side-nav-card)');
            }
            increaseCheckFrequency();
            consecutiveSkippedMutations = 0;
            consecutiveNoPoppersFound = 0;
            observerPaused = false;
            setTimeout(findAndSchedulePoppers, 100);
        }
    }

    function scheduleHiding(element) {
        if (processedElements.has(element) && isDebugged) {
                console.log('➡️ Элемент уже в обработке, пропускаем');
            return;
        }

        processedElements.add(element);
        debugScheduleCounter++;
        if (isDebugged) {
            console.log('⏰ ТАЙМЕР УСТАНОВЛЕН [' + debugScheduleCounter + ']: Элемент будет скрыт через 5 секунд');
        }

        increaseCheckFrequency();
        resetInactivityTimer();

        const timeoutId = setTimeout(() => {
            if (element && element.isConnected) {
                hiddenElements.set(element, {
                    display: element.style.display,
                    visibility: element.style.visibility,
                    opacity: element.style.opacity
                });

                element.style.cssText += '; display: none !important; visibility: hidden !important; opacity: 0 !important;';
                hiddenCount++;
                if (isDebugged) {
                    console.log(`✅ СКРЫТИЕ [${hiddenCount}]: Элемент скрыт`);
                }
                pauseAfterHiding();
            }
            processedElements.delete(element);
        }, 2500);

        element._hideTimeoutId = timeoutId;
    }

    function showElement(element) {
        if (element && hiddenElements.has(element)) {
            const originalStyles = hiddenElements.get(element);
            element.style.display = originalStyles.display || '';
            element.style.visibility = originalStyles.visibility || '';
            element.style.opacity = originalStyles.opacity || '';
            hiddenElements.delete(element);
            if (isDebugged) {
                console.log('🔓 Элемент показан');
            }
        }
    }

    function resetInactivityTimer() {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            if (isDebugged) {
                console.log('💤 Неактивность: уменьшаем частоту проверок');
            }
            decreaseCheckFrequency();
        }, 30000);
    }

    function pauseCheckingDueToHover() {
        if (hoverDelayTimer) clearTimeout(hoverDelayTimer);

        isHoveringSideNav = true;
        if (isDebugged) {
            console.log('🖱️  КУРСОР ВХОД: На side-nav-card');
        }

        consecutiveSkippedMutations = 0;
        consecutiveNoPoppersFound = 0;
        observerPaused = false;

        resumeAfterHover();

        hiddenElements.forEach((styles, element) => {
            if (element.isConnected) showElement(element);
        });
    }

    function resumeCheckingAfterHover() {
        isHoveringSideNav = false;

        if (hoverDelayTimer) clearTimeout(hoverDelayTimer);
        if (isDebugged) {
            console.log('🖱️  КУРСОР ВЫХОД: С side-nav-card');
        }

        hoverDelayTimer = setTimeout(() => {
            if (isDebugged) {
                console.log('🖱️  ВОЗОБНОВЛЕНИЕ: 5 секунд после ухода курсора');
            }

            const poppers = document.querySelectorAll('[data-popper-escaped]');
            let scheduledCount = 0;
            poppers.forEach(popper => {
                if (!processedElements.has(popper) && isElementVisible(popper)) {
                    scheduleHiding(popper);
                    scheduledCount++;
                }
            });
            if (scheduledCount > 0 && isDebugged) {
                console.log('🖱️  Запланировано скрытие: ' + scheduledCount + ' элементов');
            }
        }, 2500);
    }

    function findAndSchedulePoppers() {
        debugCheckCounter++;

        const blockReasons = [];
        if (!isActive) blockReasons.push('скрипт неактивен');
        if (isHoveringSideNav) blockReasons.push('курсор на side-nav');
        if (isPausedAfterHide) blockReasons.push('пауза после скрытия');
        if (observerPaused) blockReasons.push('observer на паузе');

        if (blockReasons.length > 0 ) {
            if (isDebugged) {
                console.log('🚫 ПРОВЕРКА [' + debugCheckCounter + ']: Пропущена - ' + blockReasons.join(', '));
            }
            return;
        }
        if (isDebugged) {
            console.log('🔍 ПРОВЕРКА [' + debugCheckCounter + ']: Запуск поиска элементов...');
        }

        const elements = document.querySelectorAll('[data-popper-escaped]');
        if (isDebugged) {
            console.log('🔍 ПРОВЕРКА [' + debugCheckCounter + ']: Найдено элементов: ' + elements.length);
        }

        let scheduledCount = 0;

        elements.forEach(element => {
            if (isElementVisible(element) && !processedElements.has(element)) {
                scheduleHiding(element);
                scheduledCount++;
            }
        });

        if (scheduledCount > 0) {
            if (isDebugged) {
                console.log('🔍 ПРОВЕРКА [' + debugCheckCounter + ']: Запланировано скрытие: ' + scheduledCount + ' элементов');
            }
        } else {
            if (isDebugged) {
                console.log('🔍 ПРОВЕРКА [' + debugCheckCounter + ']: Новых элементов для скрытия не найдено');
            }
        }

        if (!scheduledCount) {
            resetInactivityTimer();
        }
    }

    function isElementVisible(element) {
        try {
            if (!element || !element.getBoundingClientRect) return false;
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return style.visibility !== 'hidden' &&
                   style.display !== 'none' &&
                   rect.width > 0 &&
                   rect.height > 0;
        } catch (error) {
            return false;
        }
    }

    function setupSideNavHoverHandlers() {
        function setupSideNavCards() {
            const sideNavCards = document.querySelectorAll('.side-nav-card, [class*="side-nav-card"]');
            if (isDebugged) {
                console.log('🎯 Найдено side-nav-card элементов: ' + sideNavCards.length);
            }
            sideNavCards.forEach(card => {
                if (!card._hoverHandled) {
                    card.addEventListener('mouseenter', pauseCheckingDueToHover);
                    card.addEventListener('mouseleave', resumeCheckingAfterHover);
                    card._hoverHandled = true;
                }
            });
        }
        setupSideNavCards();

        const sideNavObserver = new MutationObserver(function(mutations) {
            let cardsAdded = false;
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) {
                            if (node.classList && (node.classList.contains('side-nav-card') ||
                                Array.from(node.classList).some(cls => cls.includes('side-nav-card')))) {
                                cardsAdded = true;
                            }
                            if (node.querySelectorAll) {
                                const childCards = node.querySelectorAll('.side-nav-card, [class*="side-nav-card"]');
                                if (childCards.length > 0) cardsAdded = true;
                            }
                        }
                    });
                }
            });
            if (cardsAdded) {
                if (isDebugged) {
                    console.log('🎯 Обнаружены новые side-nav-card элементы');
                }
                setTimeout(setupSideNavCards, 100);
            }
        });
        sideNavObserver.observe(document.body, { childList: true, subtree: true });
    }

    // OBSERVER С ПАУЗОЙ ПРИ 10 ПРОПУСКАХ ИЛИ 10 НЕНАХОДКАХ
    const observer = new MutationObserver(function(mutations) {
        debugMutationCounter++;

        const blockReasons = [];
        if (!isActive) blockReasons.push('скрипт неактивен');
        if (isHoveringSideNav) blockReasons.push('курсор на side-nav');
        if (isPausedAfterHide) blockReasons.push('пауза после скрытия');

        if (blockReasons.length > 0) {
            // 🔥 ПРОПУСК из-за блокировки
            consecutiveSkippedMutations++;
            consecutiveNoPoppersFound = 0; // Сбрасываем счётчик ненаходок

            // Проверяем лимит пропусков
            if (consecutiveSkippedMutations >= MAX_CONSECUTIVE_SKIPS && !observerPaused) {
                observerPaused = true;
                if (isDebugged) {
                    console.log('⏸️ OBSERVER ПАУЗА: Превышен лимит пропусков (' + MAX_CONSECUTIVE_SKIPS + '), ждём наведение на side-nav-card');
                }
                observer.disconnect();
            }

            if (isDebugged) {
                console.log('🚫 MUTATION [' + debugMutationCounter + ']: Пропущено - ' + blockReasons.join(', ') +
                       ' (пропусков подряд: ' + consecutiveSkippedMutations + ', ненаходок подряд: ' + consecutiveNoPoppersFound + ')');
            }
            return;
        }

        // 🔥 Сбрасываем счётчик пропусков когда observer активен
        consecutiveSkippedMutations = 0;

        // 🔥 ВАЖНОЕ ИЗМЕНЕНИЕ: Если observer был на паузе - перезапускаем его
        if (observerPaused) {
            observerPaused = false;
            if (isDebugged) {
                console.log('👁️ Observer возобновлён после паузы');
            }
            observer.observe(document, { childList: true, subtree: true });
        }

        let foundPoppers = false;
        let totalNewPoppers = 0;

        // Проверяем только добавленные узлы на наличие div[data-popper-escaped]
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        // Проверяем сам добавленный узел
                        if (node.matches && node.matches('div[data-popper-escaped]')) {
                            debugPopperFoundCounter++;
                            if (isDebugged) {
                                console.log('🎯 MUTATION [' + debugMutationCounter + ']: Найден div[data-popper-escaped] в добавленном узле');
                            }
                            if (isElementVisible(node) && !processedElements.has(node)) {
                                scheduleHiding(node);
                                foundPoppers = true;
                                totalNewPoppers++;
                            }
                        }

                        // Проверяем дочерние элементы на div[data-popper-escaped]
                        const childPoppers = node.querySelectorAll ? node.querySelectorAll('div[data-popper-escaped]') : [];
                        if (childPoppers.length > 0) {
                            debugPopperFoundCounter++;
                            if (isDebugged) {
                                console.log('🎯 MUTATION [' + debugMutationCounter + ']: Найдено дочерних div[data-popper-escaped]: ' + childPoppers.length);
                            }
                            for (const element of childPoppers) {
                                if (isElementVisible(element) && !processedElements.has(element)) {
                                    scheduleHiding(element);
                                    foundPoppers = true;
                                    totalNewPoppers++;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (foundPoppers) {
            // 🔥 Найдены элементы - сбрасываем счётчик ненаходок
            consecutiveNoPoppersFound = 0;
            if (isDebugged) {
                console.log('✅ MUTATION [' + debugMutationCounter + ']: Обработано новых div[data-popper-escaped]: ' + totalNewPoppers);
            }
            increaseCheckFrequency();
        } else if (mutations.length > 0) {
            // 🔥 НЕ НАЙДЕНЫ элементы - увеличиваем счётчик ненаходок
            consecutiveNoPoppersFound++;
            if (isDebugged) {
                console.log('🔍 MUTATION [' + debugMutationCounter + ']: Обработано мутаций: ' + mutations.length + ', div[data-popper-escaped] не найдены' +
                       ' (ненаходок подряд: ' + consecutiveNoPoppersFound + ')');
            }

            // 🔥 ВАЖНОЕ ИЗМЕНЕНИЕ: Пауза при 10 ненаходках подряд
            if (consecutiveNoPoppersFound >= MAX_CONSECUTIVE_NO_POPPERS && !observerPaused) {
                observerPaused = true;
                if (isDebugged) {
                    console.log('⏸️ OBSERVER ПАУЗА: Превышен лимит ненаходок (' + MAX_CONSECUTIVE_NO_POPPERS + '), ждём наведение на side-nav-card');
                }
                observer.disconnect();
            }
        }
    });

    function startHiding() {
        if (isDebugged) {
            console.log('🎬 Запуск системы скрытия...');
        }
        checkInterval = 10000;
        restartInterval();
        setupSideNavHoverHandlers();

        observer.observe(document, { childList: true, subtree: true });

        setTimeout(findAndSchedulePoppers, 1000);
        setTimeout(findAndSchedulePoppers, 2500);

        window.popperHiderStatus = function() {
            console.log('📊 СТАТУС POPPER HIDER:');
            console.log('   📍 Активных таймеров: ' + processedElements.size);
            console.log('   📍 Скрытых элементов: ' + hiddenElements.size);
            console.log('   ⚡ Интервал проверки: ' + checkInterval + 'ms');
            console.log('   🖱️  Курсор на side-nav: ' + isHoveringSideNav);
            console.log('   ⏸️  Пауза после скрытия: ' + isPausedAfterHide);
            console.log('   👁️  Observer на паузе: ' + observerPaused);
            console.log('   📍 Пропусков подряд: ' + consecutiveSkippedMutations);
            console.log('   📍 Ненаходок подряд: ' + consecutiveNoPoppersFound);
            console.log('   📍 Всего скрыто: ' + hiddenCount);
            console.log('   🔍 Счётчики отладки:');
            console.log('      - Проверки: ' + debugCheckCounter);
            console.log('      - Мутации: ' + debugMutationCounter);
            console.log('      - Таймеры: ' + debugScheduleCounter);
            console.log('      - Найдено div[data-popper-escaped]: ' + debugPopperFoundCounter);
        };

        window.resumePopperHider = function() {
            isPausedAfterHide = false;
            observerPaused = false;
            consecutiveSkippedMutations = 0;
            consecutiveNoPoppersFound = 0;
            increaseCheckFrequency();
            observer.observe(document, { childList: true, subtree: true });
            if (isDebugged) {
                console.log('▶️ Принудительное возобновление проверок и observer');
            }
        };

        if (isDebugged) {
            console.log('💡 Команды отладки: popperHiderStatus(), resumePopperHider()');
        }
    }

    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            isActive = false;
            if (isDebugged) {
                console.log('⏸️ СКРИПТ ПРИОСТАНОВЛЕН: Страница неактивна');
            }
        } else {
            isActive = true;
            if (isDebugged) {
                console.log('▶️ СКРИПТ ВОЗОБНОВЛЕН: Страница активна');
            }
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startHiding);
    } else {
        startHiding();
    }

    setInterval(() => {
        if (observerPaused || consecutiveSkippedMutations > 0 || consecutiveNoPoppersFound > 0) {
            if (isDebugged) {
                console.log('📈 СТАТУС [авто]: observerPaused=' + observerPaused +
                       ', skippedMutations=' + consecutiveSkippedMutations +
                       ', noPoppers=' + consecutiveNoPoppersFound);
            }
        }
    }, 30000);

})();