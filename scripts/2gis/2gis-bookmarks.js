// ==UserScript==
// @name         2GIS easy bookmarks
// @namespace    http://tampermonkey.net/
// @version      3.6
// @description  Удобные вкладки на 2gis.ru
// @author       fpsthirty + DeepSeek
// @icon         https://www.google.com/s2/favicons?sz=64&domain=2gis.ru
// @match        https://2gis.ru/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Хранилище вкладок
    let tabs = [];
    let isEditing = false;
    let draggedTab = null;
    let dragOverTab = null;
    let editingTabElement = null;
    const STORAGE_KEY = '2gis_custom_tabs';

    // Создаем основной контейнер для вкладок
    const container = document.createElement('div');
    container.id = 'custom-tabs-container';
    container.style.cssText = `
        position: absolute;
        top: 112px;
        z-index: 9999;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 24px;
        max-width: 260px;
        width: 260px;
        max-height: calc(100vh - 112px);
        overflow-y: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
    `;

    // Скрываем скроллбар для Webkit-браузеров
    const style = document.createElement('style');
    style.textContent = `
        #custom-tabs-container::-webkit-scrollbar {
            display: none;
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(container);

    // Функция извлечения эмоджи и текста
    function extractEmojiAndText(text) {
        // Преобразуем в строку, если это не строка
        const str = String(text);
        const emojiRegex = /^(\p{Emoji}+)\s*(.*)$/u;
        const match = str.match(emojiRegex);
        if (match) {
            return { emoji: match[1], text: match[2].trim() };
        }
        return { emoji: '', text: str.trim() };
    }

    // Функция отображения названия вкладки
    function getDisplayText(text) {
        // Сначала преобразуем в строку и извлекаем эмоджи
        const { emoji, text: cleanText } = extractEmojiAndText(text);
        if (emoji) {
            return emoji;
        }
        // Если нет эмоджи, обрезаем до 17 символов, если больше 20
        // cleanText уже является строкой благодаря extractEmojiAndText
        const displayText = cleanText.length > 20 ? cleanText.slice(0, 17) + '…' : cleanText;
        return displayText;
    }

    // Функция получения чистого текста для копирования и подсказки
    function getCleanText(text) {
        const { text: cleanText } = extractEmojiAndText(text);
        return cleanText;
    }

    // Функция проверки, нужно ли показывать alt-текст
    function shouldShowAlt(fullText, displayText) {
        return fullText !== displayText;
    }

    // Функция закрытия всех панелей действий
    function closeAllActionPanels() {
        document.querySelectorAll('.tab-actions').forEach(panel => panel.remove());
    }

    // Функция создания вкладки-заготовки
    function createPlaceholderTab() {
        const tab = document.createElement('div');
        tab.className = 'custom-tab placeholder-tab';
        tab.textContent = '+';
        tab.style.cssText = `
            cursor: pointer;
            position: relative;
            background: rgba(255, 255, 255, .85);
            min-width: 24px;
            max-width: 24px;
            height: 40px;
            padding: 0 6px;
            border-radius: 0 4px 4px 0;
            text-align: center;
            box-shadow: 2px 1px 3px 0 rgba(38, 38, 38, 0.5);
            color: #262626;
            pointer-events: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: bold;
            transition: all 0.2s;
            user-select: none;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            flex-shrink: 0;
        `;
        tab.title = 'добавить новую вкладку';
        tab.dataset.isPlaceholder = 'true';

        tab.addEventListener('click', function(e) {
            if (isEditing) return;
            e.stopPropagation();
            closeAllActionPanels();
            // Расширяем ширину до 150px при клике
            this.style.maxWidth = '150px';
            this.style.minWidth = '150px';
            startEditingTab(tab);
        });

        // При наведении делаем менее прозрачным
        tab.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(255, 255, 255, 0.95)';
        });
        tab.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(255, 255, 255, .85)';
        });

        return tab;
    }

    // Функция создания сохраненной вкладки
    function createSavedTab(text, position) {
        const tab = document.createElement('div');
        tab.className = 'custom-tab saved-tab';

        const displayText = getDisplayText(text);
        const cleanText = getCleanText(text);
        tab.textContent = displayText;

        // Ширина зависит от длины текста
        const padding = 12; // 6px с каждой стороны
        const textWidth = Math.min(displayText.length * 8, 150 - padding);
        const tabWidth = Math.min(Math.max(textWidth + padding, 24), 150);

        tab.style.cssText = `
            cursor: pointer;
            position: relative;
            background: rgba(255, 255, 255, .85);
            min-width: 24px;
            max-width: 150px;
            width: ${tabWidth}px;
            height: 40px;
            padding: 0 6px;
            border-radius: 0 4px 4px 0;
            text-align: center;
            box-shadow: 2px 1px 3px 0 rgba(38, 38, 38, 0.5);
            color: #262626;
            pointer-events: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s;
            user-select: none;
            white-space: nowrap;
            text-overflow: ellipsis;
            line-height: 1.2;
            flex-shrink: 0;
        `;
        tab.dataset.fullText = String(text);
        tab.dataset.cleanText = cleanText;
        tab.dataset.isPlaceholder = 'false';
        tab.dataset.tabId = Date.now() + Math.random();
        tab.dataset.position = position !== undefined ? position : tabs.length;

        // Добавляем всплывающую подсказку только если текст был сокращен
        if (shouldShowAlt(String(text), displayText)) {
            tab.title = String(text);
        }

        // При наведении делаем менее прозрачным
        tab.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(255, 255, 255, 0.95)';
        });
        tab.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(255, 255, 255, .85)';
        });

        // ЛКМ - копирование в буфер обмена (только чистый текст)
        tab.addEventListener('click', function(e) {
            if (isEditing || e.button !== 0) return;
            e.stopPropagation();
            closeAllActionPanels();
            const cleanText = this.dataset.cleanText || this.dataset.fullText;
            copyToClipboard(cleanText, this);
        });

        // ПКМ - показать меню редактирования/удаления
        tab.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (isEditing) return;
            closeAllActionPanels();
            showTabActions(tab);
        });

        // Drag and Drop
        tab.draggable = true;
        tab.addEventListener('dragstart', handleDragStart);
        tab.addEventListener('dragend', handleDragEnd);
        tab.addEventListener('dragover', handleDragOver);
        tab.addEventListener('drop', handleDrop);

        return tab;
    }

    // Функция сохранения редактируемой вкладки
    function saveEditingTab(tabElement, input) {
        const newText = input.value.trim();
        if (newText) {
            const isPlaceholder = tabElement.dataset.isPlaceholder === 'true';

            if (isPlaceholder) {
                // Создаем новую сохраненную вкладку
                const position = tabs.length;
                const savedTab = createSavedTab(newText, position);
                container.insertBefore(savedTab, tabElement);
                const tabData = { id: parseInt(savedTab.dataset.tabId), text: newText, position: position };
                tabs.push(tabData);
                saveTabs();
                // Возвращаем заготовке стандартную ширину
                tabElement.style.maxWidth = '24px';
                tabElement.style.minWidth = '24px';
                tabElement.style.width = '24px';
            } else {
                // Обновляем существующую вкладку
                const displayText = getDisplayText(newText);
                const cleanText = getCleanText(newText);
                tabElement.textContent = displayText;
                tabElement.dataset.fullText = newText;
                tabElement.dataset.cleanText = cleanText;

                // Обновляем alt-текст
                if (shouldShowAlt(newText, displayText)) {
                    tabElement.title = newText;
                } else {
                    tabElement.title = '';
                }

                // Обновляем ширину вкладки
                const padding = 12;
                const textWidth = Math.min(displayText.length * 8, 150 - padding);
                const tabWidth = Math.min(Math.max(textWidth + padding, 24), 150);
                tabElement.style.width = tabWidth + 'px';
                tabElement.style.maxWidth = '150px';
                tabElement.style.minWidth = '24px';

                // Обновляем в хранилище
                const tabId = parseInt(tabElement.dataset.tabId);
                const index = tabs.findIndex(t => t.id === tabId);
                if (index !== -1) {
                    tabs[index].text = newText;
                    saveTabs();
                }
            }
        }
        isEditing = false;
        editingTabElement = null;
        input.remove();
        // Обновляем позицию заготовки (она всегда последняя)
        movePlaceholderToEnd();
    }

    // Функция начала редактирования вкладки
    function startEditingTab(tabElement) {
        if (isEditing) return;
        isEditing = true;
        editingTabElement = tabElement;
        closeAllActionPanels();

        const isPlaceholder = tabElement.dataset.isPlaceholder === 'true';
        const currentText = isPlaceholder ? '' : tabElement.dataset.fullText || tabElement.textContent;

        // Устанавливаем ширину 150px для редактирования
        tabElement.style.maxWidth = '150px';
        tabElement.style.minWidth = '150px';
        tabElement.style.width = '150px';

        // Создаем поле ввода
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: 2px solid #4a90d9;
            border-radius: 0 4px 4px 0;
            background: white;
            font-size: 13px;
            padding: 0 8px;
            box-sizing: border-box;
            z-index: 10;
            outline: none;
        `;

        tabElement.appendChild(input);
        input.focus();
        input.select();

        // Обработчик клика вне поля ввода
        function handleOutsideClick(e) {
            if (isEditing && !input.contains(e.target) && e.target !== tabElement) {
                saveEditingTab(tabElement, input);
                document.removeEventListener('click', handleOutsideClick);
            }
        }

        // Обработчики событий для поля ввода
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEditingTab(tabElement, input);
                document.removeEventListener('click', handleOutsideClick);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                isEditing = false;
                editingTabElement = null;
                input.remove();
                document.removeEventListener('click', handleOutsideClick);
                // Возвращаем заготовке стандартную ширину
                if (isPlaceholder) {
                    tabElement.style.maxWidth = '24px';
                    tabElement.style.minWidth = '24px';
                    tabElement.style.width = '24px';
                } else {
                    // Возвращаем сохраненной вкладке её обычную ширину
                    const fullText = tabElement.dataset.fullText || tabElement.textContent;
                    const displayText = getDisplayText(fullText);
                    const padding = 12;
                    const textWidth = Math.min(displayText.length * 8, 150 - padding);
                    const tabWidth = Math.min(Math.max(textWidth + padding, 24), 150);
                    tabElement.style.width = tabWidth + 'px';
                    tabElement.style.maxWidth = '150px';
                    tabElement.style.minWidth = '24px';
                }
            }
        });

        // Добавляем обработчик клика вне
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 10);
    }

    // Функция показа действий над вкладкой (редактирование/удаление)
    function showTabActions(tabElement) {
        if (tabElement.dataset.isPlaceholder === 'true') return;

        // Удаляем старые действия
        const oldActions = tabElement.querySelector('.tab-actions');
        if (oldActions) oldActions.remove();

        const actions = document.createElement('div');
        actions.className = 'tab-actions';
        actions.style.cssText = `
            position: absolute;
            right: -96px;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            gap: 6px;
            background: rgba(255, 255, 255, 0.95);
            padding: 7px 8px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 20;
            white-space: nowrap;
            pointer-events: auto;
        `;

        // Кнопка редактирования (слева)
        const editBtn = document.createElement('div');
        editBtn.textContent = '✏️';
        editBtn.style.cssText = `
            cursor: pointer;
            padding: 4px 6px;
            font-size: 18px;
            border-radius: 4px;
            transition: background 0.2s;
            line-height: 1;
        `;
        editBtn.addEventListener('mouseenter', () => editBtn.style.background = '#e0e0e0');
        editBtn.addEventListener('mouseleave', () => editBtn.style.background = 'transparent');
        editBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            actions.remove();
            // Начинаем редактирование
            startEditingTab(tabElement);
        });

        // Кнопка удаления (справа)
        const deleteBtn = document.createElement('div');
        deleteBtn.textContent = '🗑️';
        deleteBtn.style.cssText = `
            cursor: pointer;
            padding: 4px 6px;
            font-size: 18px;
            border-radius: 4px;
            transition: background 0.2s;
            line-height: 1;
        `;
        deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.background = '#ffebee');
        deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.background = 'transparent');
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            // Удаляем вкладку
            const tabId = parseInt(tabElement.dataset.tabId);
            const index = tabs.findIndex(t => t.id === tabId);
            if (index !== -1) {
                tabs.splice(index, 1);
                saveTabs();
            }
            tabElement.remove();
            actions.remove();
            // Перемещаем заготовку в конец
            movePlaceholderToEnd();
        });

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        tabElement.appendChild(actions);

        // Закрываем действия при клике вне
        setTimeout(() => {
            document.addEventListener('click', function closeActions(e) {
                if (!actions.contains(e.target) && e.target !== tabElement) {
                    actions.remove();
                    document.removeEventListener('click', closeActions);
                }
            });
        }, 10);
    }

    // Функция копирования в буфер обмена
    function copyToClipboard(text, tabElement) {
        navigator.clipboard.writeText(text).then(() => {
            // Анимация изменения цвета фона
            const originalBg = tabElement.style.background;
            tabElement.style.transition = 'background 0.25s ease';
            tabElement.style.background = '#bbb';

            setTimeout(() => {
                tabElement.style.background = originalBg;
            }, 250);
        }).catch(err => {
            console.error('Ошибка копирования:', err);
        });
    }

    // Функции для работы с localStorage
    function saveTabs() {
        try {
            // Обновляем позиции перед сохранением
            const savedTabs = container.querySelectorAll('.saved-tab');
            savedTabs.forEach((tab, index) => {
                const tabId = parseInt(tab.dataset.tabId);
                const found = tabs.find(t => t.id === tabId);
                if (found) {
                    found.position = index;
                }
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
        } catch (e) {
            console.error('Ошибка сохранения:', e);
        }
    }

    function loadTabs() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const savedTabs = JSON.parse(data);
                if (Array.isArray(savedTabs) && savedTabs.length > 0) {
                    // Сортируем по позиции
                    savedTabs.sort((a, b) => (a.position || 0) - (b.position || 0));
                    tabs = savedTabs;
                    // Восстанавливаем вкладки
                    const placeholder = container.querySelector('.placeholder-tab');
                    savedTabs.forEach(tabData => {
                        const tab = createSavedTab(tabData.text, tabData.position);
                        tab.dataset.tabId = tabData.id;
                        container.insertBefore(tab, placeholder);
                    });
                }
            }
        } catch (e) {
            console.error('Ошибка загрузки:', e);
        }
    }

    // Консольные команды
    window.__2gisTabs = {
        // Экспорт вкладок
        export: function() {
            const data = tabs.map(t => t.text);
            const json = JSON.stringify(data);
            console.log('📋 Скопируйте строку ниже для последующего импорта:');
            console.log(`__2gisTabs.import(${json})`);
        },

        // Импорт вкладок
        import: function(jsonString) {
            try {
                const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
                if (!Array.isArray(data)) {
                    console.error('❌ Неверный формат данных');
                    return;
                }
                const placeholder = container.querySelector('.placeholder-tab');
                let addedCount = 0;
                data.forEach(text => {
                    if (text && typeof text === 'string' && text.trim()) {
                        const position = tabs.length;
                        const newTab = createSavedTab(text.trim(), position);
                        container.insertBefore(newTab, placeholder);
                        tabs.push({ id: parseInt(newTab.dataset.tabId), text: text.trim(), position: position });
                        addedCount++;
                    }
                });
                saveTabs();
                console.log(`✅ Импортировано ${addedCount} вкладок`);
                movePlaceholderToEnd();
            } catch (e) {
                console.error('❌ Ошибка импорта:', e);
                console.log('💡 Убедитесь, что передаете корректную JSON строку');
            }
        },

        // Удаление всех вкладок
        clear: function() {
            const savedTabs = container.querySelectorAll('.saved-tab');
            savedTabs.forEach(tab => tab.remove());
            tabs = [];
            saveTabs();
            console.log('🗑️ Все вкладки удалены');
            movePlaceholderToEnd();
        }
    };

    // Drag and Drop функции
    function handleDragStart(e) {
        if (this.dataset.isPlaceholder === 'true' || isEditing) {
            e.preventDefault();
            return;
        }
        draggedTab = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
        this.style.opacity = '0.4';
        closeAllActionPanels();
    }

    function handleDragEnd(e) {
        this.style.opacity = '1';
        document.querySelectorAll('.custom-tab').forEach(tab => {
            tab.style.border = 'none';
        });
        // Сохраняем новый порядок
        saveTabs();
        draggedTab = null;
        dragOverTab = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (this.dataset.isPlaceholder === 'true' || isEditing) return;
        if (this === draggedTab) return;

        dragOverTab = this;
        document.querySelectorAll('.custom-tab').forEach(tab => {
            tab.style.border = 'none';
        });
        this.style.border = '2px dashed #4a90d9';
    }

    function handleDrop(e) {
        e.preventDefault();
        if (this.dataset.isPlaceholder === 'true' || isEditing) return;
        if (this === draggedTab) return;

        // Меняем местами в DOM
        const allTabs = Array.from(container.querySelectorAll('.custom-tab'));
        const fromIndex = allTabs.indexOf(draggedTab);
        const toIndex = allTabs.indexOf(this);

        if (fromIndex < toIndex) {
            this.parentNode.insertBefore(draggedTab, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedTab, this);
        }

        this.style.border = 'none';
        draggedTab.style.opacity = '1';
        movePlaceholderToEnd();
    }

    // Функция перемещения заготовки в конец
    function movePlaceholderToEnd() {
        const placeholder = container.querySelector('.placeholder-tab');
        if (placeholder) {
            container.appendChild(placeholder);
        }
    }

    // Функция обновления позиции контейнера
    function updatePosition() {
        const xpath = "//div[@dir='ltr']/following-sibling::*[contains(@style, 'left:')]";
        const result = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        );
        const targetElement = result.singleNodeValue;

        if (targetElement) {
            const style = targetElement.getAttribute('style') || '';
            const leftMatch = style.match(/left:\s*([^;]+)/);
            if (leftMatch && leftMatch[1]) {
                const leftValue = leftMatch[1].trim();
                container.style.left = leftValue;
            }
        }
    }

    // Инициализация
    function init() {
        // Создаем заготовку
        const placeholder = createPlaceholderTab();
        container.appendChild(placeholder);

        // Загружаем сохраненные вкладки
        loadTabs();

        // Обновляем позицию
        setTimeout(updatePosition, 1000);

        // Наблюдаем за изменениями
        const observer = new MutationObserver(function(mutations) {
            const xpath = "//div[@dir='ltr']/following-sibling::*[contains(@style, 'left:')]";
            const result = document.evaluate(
                xpath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            );
            const targetElement = result.singleNodeValue;

            if (targetElement) {
                const style = targetElement.getAttribute('style') || '';
                const leftMatch = style.match(/left:\s*([^;]+)/);
                if (leftMatch && leftMatch[1]) {
                    const newLeft = leftMatch[1].trim();
                    const currentLeft = container.style.left;
                    if (newLeft !== currentLeft) {
                        updatePosition();
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style']
        });

        window.addEventListener('scroll', updatePosition);
        window.addEventListener('resize', updatePosition);

        // Выводим информацию о консольных командах
        console.log('2GIS easy bookmarks is ready to use.');
        console.log('📌 Доступные команды:');
        console.log('__2gisTabs.export() - экспорт вкладок');
        console.log('__2gisTabs.import(JSON_строка) - импорт вкладок');
        console.log('__2gisTabs.clear() - удалить все вкладки');
    }

    // Ждем загрузки страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();