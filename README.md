# 🐒 Tampermonkey Userscripts Collection

Коллекция пользовательских скриптов для Tampermonkey, которые делают взаимодействие с сайтами более удобным и эффективным. Созданы при использовании ИИ DeepSeek.

## 📋 Список скриптов

### 🎮 Twitch

#### 📜 Twitch Popper Hider
**Описание:** скрытие всплывашки о предлагаемом стриме в сайдбаре спустя 2.5–5сек после потери фокуса с сайдбара<br>
**Функции:**
- Скрывает элементы с атрибутом `data-popper-escaped` спустя несколько секунд после отсутствия курсора на сайдбаре 
- Умная пауза для экономии ресурсов

**Код скрипта:**   [twitch-popper-hider.js](https://github.com/fpsthirty/tampermonkey/blob/main/scripts/twitch/twitch-popper-hider.js)<br>
**Поддерживаемые страницы:** `https://www.twitch.tv/*`<br>
**Консольные команды:**
```javascript
popperHiderStatus()    // Показать статус скрипта
resumePopperHider()    // Принудительно возобновить проверки
```
<img width="450" height="288" alt="image" src="https://github.com/user-attachments/assets/3477b805-23c6-4772-8cbe-48411c2c5050" />

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
