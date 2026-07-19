# 🐒 Tampermonkey Userscripts Collection

Коллекция пользовательских скриптов для Tampermonkey, которые делают взаимодействие с сайтами более удобным и эффективным. Созданы при использовании ИИ DeepSeek.

## 📋 Список скриптов

### 🎮 Twitch

#### 📜 Twitch Popper Hider
**Код скрипта:**   [twitch-popper-hider.js](https://github.com/fpsthirty/tampermonkey/blob/main/scripts/twitch/twitch-popper-hider.js)<br>
**Описание:** скрытие всплывашки о предлагаемом стриме в сайдбаре спустя 2.5–5сек после потери фокуса с сайдбара<p>
**Функции:**
- Скрывает элементы с атрибутом `data-popper-escaped` спустя несколько секунд после отсутствия курсора на сайдбаре 
- Умная пауза для экономии ресурсов

**Поддерживаемые страницы:** `https://www.twitch.tv/*`<br>
**Консольные команды:**
```javascript
popperHiderStatus()    // Показать статус скрипта
resumePopperHider()    // Принудительно возобновить проверки
```
<img width="450" height="288" alt="image" src="https://github.com/user-attachments/assets/3477b805-23c6-4772-8cbe-48411c2c5050" />

---

#### 📜 Twitch Chat Commands from Title
**Код скрипта:**   [twitch-chat-commands-from-title.js](https://github.com/fpsthirty/tampermonkey/blob/main/scripts/twitch/twitch-chat-commands-from-title.js)<br>
**Описание:** Скрипт автоматически находит команды чата *(слова, начинающиеся с `!`)* в заголовке трансляции на Twitch и преобразует их в кликабельные кнопки. При клике на кнопку команда автоматически отправляется в чат.<p>
**Функции:**
- пресечение throttling-кликов - отправка сообщений не чаще 1 раза в секунду,
- кнопки добавляются только в live-трансляциях, т.к. чат недоступен на записях (VOD),
- фоновые проверки по обновлению заголовка трансляции с поиском команд: по умолчанию раз в минуту, а также при каждом наведении курсора на заголовок

**Поддерживаемые страницы:** `https://www.twitch.tv/*`<br>
**Консольные команды:**
```javascript
enableTwitchDebug()    // Включить подробное логирование
disableTwitchDebug()    // Выключить логирование
getTwitchDebugStatus()    // Проверить статус отладки
```

![img/twitch/twitch-chat-commands-from-title](https://github.com/fpsthirty/tampermonkey/raw/main/img/twitch/twitch-chat-commands-from-title.png)

---

#### 📜 2GIS easy bookmarks
**Код скрипта:**   [2gis-bookmarks.js](https://github.com/fpsthirty/tampermonkey/blob/main/scripts/2gis/2gis-bookmarks.js)<br>
**Описание:** добавляет удобную систему вкладок на сайт 2gis.ru; вкладки позволяют быстро сохранять поисковые запросы и в один клик их использовать.<p>

**Функции:**
- Управление вкладками: 
  - создание: меню создания открывается при клике по вкладке с символом "+";
  - редактирование, удаление: меню выводится при клике пкм по названию вкладки;
  - изменение порядка их вывода: перетягиваем (Drag-and-drop) вкладки для изменения их порядка.
- Короткие имена вкладок: в начале названия вкладки укажите эмоджи, который будет визуально заменять название этой вкладки.

**Поддерживаемые страницы:** `https://2gis.ru/*`<br>
**Консольные команды:**
```javascript
__2gisBookmarks.export()    // экспорт вкладок
__2gisBookmarks.import()    // импорт вкладок
__2gisBookmarks.clear()    // удаление всех вкладок
__2gisBookmarks.enableDebug()    // Включить вывод логов в консоли
__2gisBookmarks.disableDebug()    // Отключить вывод логов
```

![img/2gis/2gis-bookmarks.png](https://github.com/fpsthirty/tampermonkey/raw/main/img/2gis/2gis-bookmarks.png)

---
---


## 🛠️ Установка

### 1. Установите Tampermonkey
- [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- [Microsoft Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)<p>
заметка: не забудьте закрепить иконку расширения на верхней панели браузера, а также [включить режим разработчика](https://www.tampermonkey.net/faq.php#Q209) в браузере

### 2. Установите скрипт
- Перейдите на страницу нужного скрипта в этом репозитории
- Нажмите на файл скрипта (например, `twitch-popper-hider.js`)
- В правом верхнем углу нажмите кнопку для скачивания файла или копирования его содержимого: "Raw" / "Copy Raw File" / "Download Raw file"
- кликните ЛКМ по иконке расширения Tampermonkey
- Нажмите кнопку "Создать новый скрипт"
- Вставляйте код скрипта, сохраняете
- Обновляете страницу браузера с урлом, к которому относился скрипт, — на иконке расширения должен появиться счётчик применяемых скриптов к сайту. Если этого не произошло, то кликните по иконке расширения Tampermonkey и убедитесь, что скрипт отображается в контекстном меню, а также скрипт и расширение имеют галочку «Включено». 

## 🔧 Функции отладки

Скрипты поддерживают логирование, а также спецкоманды в консоли браузера — указываются в описании к каждому скрипту.
Логирование включается в теле скрипта через флаг `isDebugged = true`, по умолчанию логирование выключено: `isDebugged = false`
