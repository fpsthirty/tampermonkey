# 🐒 Tampermonkey Userscripts Collection

Коллекция пользовательских скриптов для Tampermonkey, которые делают взаимодействие с сайтами более удобным и эффективным. Созданы при использовании ИИ DeepSeek.

## 📋 Список скриптов

### 🎮 Twitch

#### Twitch Popper Hider
**📜 Файл:** `twitch-popper-hider.js`  
**Описание:** скрытие всплывашки о предлагаемом стриме в сайдбаре спустя 2.5–5сек после потери фокуса с сайдбара<br>
**Функции:**
- Скрывает элементы с атрибутом `data-popper-escaped` 
- Умная пауза для экономии ресурсов;
- Показ элементов при наведении на навигацию;

**Код скрипта:**   [twitch-popper-hider.js](https://github.com/fpsthirty/tampermonkey/raw/main/scripts/twitch/twitch-popper-hider.js)<br>
**Поддерживаемые страницы:** `https://www.twitch.tv/*`<br>
**Консольные команды:**
```javascript
popperHiderStatus()    // Показать статус скрипта
resumePopperHider()    // Принудительно возобновить проверки
```

## 🛠️ Установка

### 1. Установите Tampermonkey
- [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- [Microsoft Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
заметка: не забудьте закрепить иконку на верхней панели браузера, а также [включить режим разработчика](https://www.tampermonkey.net/faq.php#Q209) в браузере

### 2. Установите скрипт
- Перейдите на страницу нужного скрипта в этом репозитории
- Нажмите на файл скрипта (например, `twitch-popper-hider.js`)
- В правом верхнем углу нажмите кнопку для скачивания файла или копирования его содержимого: "Raw" / "Copy Raw File" / "Download Raw file"
- кликните ЛКМ по иконке расширения Tampermonkey
- Нажмите кнопку "Создать новый скрипт"

## 🔧 Функции отладки

Скрипты поддерживают логирование, а также спецкоманды в консоли браузера — указываются в описании к каждому скрипту.
Логирование включается в теле скрипта через флаг `isDebugged = true`, по умолчанию логирование выключено: `isDebugged = false`
