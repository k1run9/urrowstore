# URROW Store

Динамический магазин плагинов для Lampa. Каталог обновляется автоматически через GitHub Actions.

## Установка

Lampa → Настройки → Плагины → Добавить плагин:

```
https://k1run9.github.io/urrowstore/store.js
```

## Как пользоваться

- **Меню слева** → пункт «URROW Store»
- **Шапка主页面** → иконка 📦 рядом с поиском

## Архитектура

```
sources.json          — исходный список плагинов (редактируется вручную)
build-catalog.js      — Node.js скрипт сборки каталога
catalog.json          — генерируется автоматически из sources.json
.store.js             — фронтенд, загружает catalog.json и рендерит UI
.github/workflows/    — GitHub Actions, обновляет catalog.json раз в 6 часов
```

## Как добавить плагин

1. Отредактируйте `sources.json` — добавьте запись:
```json
{"id":"my-plugin","name":"Мой плагин","description":"Описание","author":"myname","repo":"https://github.com/me/repo","script_url":"https://example.com/plugin.js","category":"misc","min_lampa_version":"1980000"}
```
2. Запуште в `main`
3. GitHub Actions автоматически обновит `catalog.json`

## Категории

- **interface** — Интерфейс (темы, рейтинги, UI)
- **player** — Плеер (онлайн-источники, качество)
- **catalog** — Каталог (подборки, стриминги)
- **torrent** — Торренты (стили, рекомендации)
- **misc** — Прочее (утилиты, синхронизация)

## Технологии

- Vanilla JS (совместимо с Lampa)
- Node.js 20+ (для сборки каталога)
- GitHub Actions (автообновление)
- GitHub Pages (хостинг)

## Ссылки

- Репозиторий: https://github.com/k1run9/urrowstore
- Страница: https://k1run9.github.io/urrowstore/
- Каталог: https://k1run9.github.io/urrowstore/catalog.json

## Лицензия

MIT
