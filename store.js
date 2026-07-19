/* URROW Store v2.5 — Магазин плагинов для Lampa */
(function () {
    'use strict';

    if (window.__urrow_store) return;
    window.__urrow_store = true;

    console.log('[urrowstore] script loaded');

    // === КОНФИГУРАЦИЯ ===
    var CATALOG_URL = 'https://k1run9.github.io/urrowstore/catalog.json';
    var VERSION_URL = 'https://k1run9.github.io/urrowstore/version.json';
    var STORE_URL = 'https://k1run9.github.io/urrowstore/store.js';
    var CACHE_KEY = 'urrow_catalog_cache';
    var CACHE_TIME_KEY = 'urrow_catalog_cache_time';
    var CACHE_TTL = 3 * 3600 * 1000;
    var STORE_VERSION_KEY = 'urrowstore_version';

    // === УТИЛИТЫ ===
    function notify(msg) {
        try { if (Lampa.Noty) Lampa.Noty.show(msg); } catch (e) {}
    }

    function getLampaVersion() {
        try {
            if (Lampa.Manifest && Lampa.Manifest.version) return parseInt(Lampa.Manifest.version) || 0;
        } catch (e) {}
        return 0;
    }

    // === AUTO-UPDATE ===
    function checkStoreUpdate() {
        try {
            var currentVersion = Lampa.Storage.get(STORE_VERSION_KEY, '0.0.0');
            var controller = new AbortController();
            var timer = setTimeout(function () { controller.abort(); }, 5000);

            fetch(VERSION_URL + '?t=' + Date.now(), { signal: controller.signal })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    clearTimeout(timer);
                    if (data.version && data.version !== currentVersion) {
                        console.log('[urrowstore] Обновление: ' + currentVersion + ' -> ' + data.version);
                        Lampa.Storage.set(STORE_VERSION_KEY, data.version);
                        // Перезагружаем store.js с новой версией
                        var s = document.createElement('script');
                        s.src = STORE_URL + '?v=' + data.version;
                        s.onload = function () { console.log('[urrowstore] store.js обновлён до v' + data.version); };
                        document.body.appendChild(s);
                    }
                })
                .catch(function () { /* офлайн — ок, используем кэш */ });
        } catch (e) {
            console.error('[urrowstore] checkStoreUpdate error:', e);
        }
    }

    // === HEADER ICON (Lampa.Head.addIcon) ===
    function addHeaderIcon() {
        try {
            if (Lampa.Head && typeof Lampa.Head.addIcon === 'function') {
                Lampa.Head.addIcon(
                    '<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" stroke-width="2"/><path d="M7 12h10M12 7v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
                    function () { openStore(); }
                );
                console.log('[urrowstore] Head.addIcon выполнен');
                return;
            }
        } catch (e) {
            console.warn('[urrowstore] Head.addIcon не удался, пробуем DOM:', e);
        }

        // Фолбэк: прямая вставка в .head__actions
        try {
            var $ = window.jQuery || window.$;
            if ($ && $('.head__actions').length) {
                var btn = $('<div class="head__action selector" tabindex="0"><svg viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" stroke-width="2"/><path d="M7 12h10M12 7v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>');
                btn.on('hover:enter click', function () { openStore(); });
                $('.head__actions').prepend(btn);
                console.log('[urrowstore] Иконка в шапку добавлена через DOM');
            }
        } catch (e2) {
            console.error('[urrowstore] DOM fallback не удался:', e2);
        }
    }

    // === MENU BUTTON (Lampa.Menu.addButton) ===
    function addMenuButton() {
        if (!Lampa.Menu || typeof Lampa.Menu.addButton !== 'function') {
            console.warn('[urrowstore] Lampa.Menu.addButton недоступен');
            return;
        }
        try {
            Lampa.Menu.addButton({
                name: 'URROW Store',
                description: 'Магазин плагинов',
                icon: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" stroke-width="2"/><path d="M7 12h10M12 7v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
                onSelect: function () {
                    openStore();
                }
            });
            console.log('[urrowstore] Menu.addButton выполнен');
        } catch (e) {
            console.error('[urrowstore] Menu.addButton error:', e);
        }
    }

    // === SETTINGS (Lampa.SettingsApi) ===
    function addSettingsSection() {
        if (!Lampa.SettingsApi) {
            console.warn('[urrowstore] Lampa.SettingsApi недоступен');
            return;
        }
        try {
            Lampa.SettingsApi.addComponent({
                component: 'urrowstore',
                icon: '📦',
                name: 'URROW Store'
            });

            Lampa.SettingsApi.addParam({
                component: 'urrowstore',
                param: { name: 'urrowstore_version_info', type: 'static' },
                field: {
                    name: 'Версия',
                    description: Lampa.Storage.get(STORE_VERSION_KEY, '2.5.0')
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'urrowstore',
                param: { name: 'urrowstore_auto_update', type: 'trigger', default: true },
                field: {
                    name: 'Авто-обновление магазина',
                    description: 'Проверять обновления store.js при запуске'
                }
            });

            console.log('[urrowstore] SettingsApi выполнен');
        } catch (e) {
            console.error('[urrowstore] SettingsApi error:', e);
        }
    }

    // === CATALOG ===
    function fetchCatalog(force, cb) {
        var now = Date.now();
        var ct = parseInt(Lampa.Storage.get(CACHE_TIME_KEY, '0')) || 0;
        var cached = Lampa.Storage.get(CACHE_KEY, null);

        if (!force && cached && (now - ct) < CACHE_TTL) {
            cb(cached);
            return;
        }

        try {
            var req = new Lampa.Reguest();
            req.timeout = 15000;
            req.silent(CATALOG_URL, function (d) {
                try {
                    if (typeof d === 'string') d = JSON.parse(d);
                    Lampa.Storage.set(CACHE_KEY, d);
                    Lampa.Storage.set(CACHE_TIME_KEY, String(now));
                    cb(d);
                } catch (e) {
                    cb(cached || { version: '0.0.0', plugins: [] });
                }
            }, function () {
                cb(cached || { version: '0.0.0', plugins: [] });
            });
        } catch (e) {
            cb(cached || { version: '0.0.0', plugins: [] });
        }
    }

    // === VERSION CHECK ===
    function checkCompat(p) {
        var cur = getLampaVersion();
        var mn = parseInt(p.min_lampa_version) || 0;
        var mx = parseInt(p.max_lampa_version) || 0;
        if (mn && cur && cur < mn) return 'outdated';
        if (mx && cur && cur > mx) return 'unstable';
        return 'ok';
    }

    // === EXTENSIONS ===
    function getExt() {
        try {
            var e = Lampa.Storage.get('plugins', []);
            return Array.isArray(e) ? e : [];
        } catch (x) { return []; }
    }

    function isInstalled(url) {
        return getExt().some(function (e) { return e.url === url; });
    }

    function installPlugin(p, cb) {
        try {
            var ext = getExt();
            if (!ext.some(function (e) { return e.url === p.script_url; })) {
                var plugin = { url: p.script_url, name: p.name, author: p.author, status: 1 };
                ext.push(plugin);
                Lampa.Storage.set('plugins', ext);

                // Загружаем скрипт через официальный API
                if (Lampa.Plugins && typeof Lampa.Plugins.push === 'function') {
                    Lampa.Plugins.push(plugin);
                } else if (Lampa.Utils && Lampa.Utils.putScriptAsync) {
                    Lampa.Utils.putScriptAsync([p.script_url]);
                }
            }
            notify(p.name + ' ✓ установлен');
            if (cb) cb();
        } catch (e) {
            console.error('[urrowstore] installPlugin error:', e);
            notify('Ошибка установки');
            if (cb) cb();
        }
    }

    function uninstallPlugin(p, cb) {
        try {
            var ext = getExt().filter(function (e) { return e.url !== p.script_url; });
            Lampa.Storage.set('plugins', ext);

            // Удаляем через официальный API
            if (Lampa.Plugins && typeof Lampa.Plugins.remove === 'function') {
                Lampa.Plugins.remove({ url: p.script_url });
            }

            notify(p.name + ' удалён');
        } catch (e) {
            console.error('[urrowstore] uninstallPlugin error:', e);
        }
        if (cb) cb();
    }

    // === CSS ===
    function injectStyles() {
        if (document.getElementById('urrow-store-css')) return;
        var s = document.createElement('style');
        s.id = 'urrow-store-css';
        s.textContent = [
            '.us{padding:1.5em;max-width:1200px;margin:0 auto}',
            '.us-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5em;padding-bottom:1em;border-bottom:1px solid rgba(255,255,255,0.08)}',
            '.us-title{font-size:1.6em;font-weight:700;color:#fff;display:flex;align-items:center;gap:0.5em}',
            '.us-ver{font-size:0.6em;color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.06);padding:0.15em 0.5em;border-radius:0.25em}',
            '.us-btns{display:flex;gap:0.5em}',
            '.us-b{padding:0.5em 1em;border-radius:0.5em;border:2px solid transparent;cursor:pointer;font-size:0.85em;font-weight:600;color:#fff;transition:all .2s ease}',
            '.us-b--p{background:linear-gradient(135deg,#667eea,#764ba2)}',
            '.us-b--s{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.8)}',
            '.us-b.selector.focus{border-color:#667eea;box-shadow:0 0 16px rgba(102,126,234,0.6);transform:scale(1.08)}',
            '.us-stats{display:flex;gap:1em;margin-bottom:1.2em;flex-wrap:wrap}',
            '.us-stat{font-size:0.8em;color:rgba(255,255,255,0.4)}',
            '.us-stat b{color:rgba(255,255,255,0.7)}',
            '.us-search{position:relative;margin-bottom:1em}',
            '.us-search input{width:100%;padding:0.7em 1em 0.7em 2.5em;border-radius:0.5em;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:0.85em;outline:none;transition:border-color .2s}',
            '.us-search input:focus{border-color:#667eea}',
            '.us-si{position:absolute;left:0.8em;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.3)}',
            '.us-cats{display:flex;gap:0.4em;margin-bottom:1.2em;flex-wrap:wrap}',
            '.us-cat{padding:0.35em 0.8em;border-radius:1.2em;font-size:0.75em;font-weight:600;cursor:pointer;border:2px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);background:transparent;transition:all .2s ease}',
            '.us-cat--on{background:linear-gradient(135deg,#667eea,#764ba2);border-color:transparent;color:#fff}',
            '.us-cat.selector.focus{border-color:#667eea;color:#fff;transform:scale(1.08);box-shadow:0 0 12px rgba(102,126,234,0.5)}',
            '.us-list{display:flex;flex-direction:column;gap:0.5em}',
            '.us-card{background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.06);border-radius:0.7em;padding:1em;transition:all .2s ease;cursor:pointer}',
            '.us-card.selector.focus{border-color:#667eea;background:rgba(102,126,234,0.1);box-shadow:0 0 20px rgba(102,126,234,0.4);transform:scale(1.02)}',
            '.us-card--in{border-color:rgba(46,204,113,0.2);background:rgba(46,204,113,0.04)}',
            '.us-card--in.selector.focus{border-color:#2ecc71;box-shadow:0 0 20px rgba(46,204,113,0.4);transform:scale(1.02)}',
            '.us-top{display:flex;align-items:flex-start;gap:0.7em}',
            '.us-info{flex:1;min-width:0}',
            '.us-name{font-size:0.95em;font-weight:700;color:#fff}',
            '.us-author{font-size:0.7em;color:rgba(255,255,255,0.4)}',
            '.us-desc{font-size:0.75em;color:rgba(255,255,255,0.55);margin-top:0.4em;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
            '.us-row{display:flex;gap:0.35em;margin-top:0.7em;flex-wrap:wrap;align-items:center}',
            '.us-ab{padding:0.4em 0.9em;border-radius:0.35em;border:2px solid transparent;cursor:pointer;font-size:0.75em;font-weight:600;color:#fff;transition:all .2s ease}',
            '.us-ab.selector.focus{transform:scale(1.1);box-shadow:0 0 10px rgba(102,126,234,0.5);border-color:rgba(102,126,234,0.5)}',
            '.us-ab--i{background:linear-gradient(135deg,#667eea,#764ba2)}',
            '.us-ab--r{background:rgba(231,76,60,0.15);color:#e74c3c}',
            '.us-ab--u{background:rgba(241,196,15,0.15);color:#f1c40f}',
            '.us-badge{display:inline-flex;align-items:center;gap:0.25em;font-size:0.7em;padding:0.15em 0.5em;border-radius:0.25em;font-weight:600}',
            '.us-badge--ok{background:rgba(46,204,113,0.15);color:#2ecc71}',
            '.us-badge--br{background:rgba(231,76,60,0.15);color:#e74c3c}',
            '.us-badge--old{background:rgba(241,196,15,0.15);color:#f1c40f}',
            '.us-badge--dep{background:rgba(155,155,155,0.15);color:#999}',
            '.us-stars{color:#f1c40f;font-size:0.75em}',
            '.us-tags{display:flex;gap:0.2em;flex-wrap:wrap;margin-top:0.5em}',
            '.us-tag{font-size:0.65em;padding:0.1em 0.35em;border-radius:0.2em;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.4)}',
            '.us-bottom{display:flex;align-items:center;justify-content:space-between;margin-top:0.5em}',
            '.us-vtag{font-size:0.65em;color:rgba(255,255,255,0.3)}',
            '.us-empty{text-align:center;padding:3em;color:rgba(255,255,255,0.3)}',
            '.us-load{text-align:center;padding:4em;color:rgba(255,255,255,0.4)}',
            '.us-spin{display:inline-block;width:2em;height:2em;border:3px solid rgba(255,255,255,0.1);border-top-color:#667eea;border-radius:50%;animation:uss .8s linear infinite;margin-bottom:0.8em}',
            '@keyframes uss{to{transform:rotate(360deg)}}',
            '.us-confirm{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:1000}',
            '.us-confirm__box{background:#1e1e2e;border-radius:1em;padding:2em;max-width:24em;text-align:center;border:2px solid rgba(102,126,234,0.3)}',
            '.us-confirm__title{font-size:1.1em;font-weight:700;color:#fff;margin-bottom:0.8em}',
            '.us-confirm__text{font-size:0.85em;color:rgba(255,255,255,0.6);margin-bottom:1.5em}',
            '.us-confirm__btns{display:flex;gap:0.8em;justify-content:center}',
            '.us-confirm__btn{padding:0.5em 1.5em;border-radius:0.5em;border:2px solid transparent;cursor:pointer;font-size:0.85em;font-weight:600;transition:all .2s ease}',
            '.us-confirm__btn.selector.focus{transform:scale(1.08);box-shadow:0 0 14px rgba(102,126,234,0.5);border-color:#667eea}',
            '.us-confirm__btn--yes{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}',
            '.us-confirm__btn--no{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7)}'
        ].join('');
        document.head.appendChild(s);
    }

    // === HELPERS ===
    function renderStars(r) {
        if (!r || !r.count) return '';
        var f = Math.floor(r.average), h = r.average - f >= 0.5 ? 1 : 0, e = 5 - f - h;
        var s = '';
        for (var i = 0; i < f; i++) s += '★';
        for (var i = 0; i < h; i++) s += '½';
        for (var i = 0; i < e; i++) s += '☆';
        return '<span class="us-stars">' + s + '</span> <span style="font-size:0.7em;color:rgba(255,255,255,0.4)">' + r.average.toFixed(1) + ' (' + r.count + ')</span>';
    }

    function renderBadge(p) {
        var c = checkCompat(p);
        if (p.status === 'broken') return '<span class="us-badge us-badge--br">✗ Сломан</span>';
        if (p.status === 'deprecated') return '<span class="us-badge us-badge--dep">Устарел</span>';
        if (c === 'outdated') return '<span class="us-badge us-badge--old">⚠ Требуется Lampa ' + (p.min_lampa_version || '') + '</span>';
        if (c === 'unstable') return '<span class="us-badge us-badge--old">⚠ Может не работать</span>';
        return '<span class="us-badge us-badge--ok">✓ Активен</span>';
    }

    function catName(c) {
        return { interface:'🎨 Интерфейс', player:'▶️ Плеер', catalog:'📂 Каталог', torrent:'🎯 Торренты', misc:'🔧 Прочее' }[c] || c;
    }

    // === CONFIRM DIALOG ===
    function confirmDialog(msg, cb) {
        var overlay = document.createElement('div');
        overlay.className = 'us-confirm';
        overlay.innerHTML = '<div class="us-confirm__box"><div class="us-confirm__title">Подтверждение</div><div class="us-confirm__text">' + msg + '</div><div class="us-confirm__btns"><button class="selector us-confirm__btn us-confirm__btn--yes" data-c="y">Да</button><button class="selector us-confirm__btn us-confirm__btn--no" data-c="n">Нет</button></div></div>';
        document.body.appendChild(overlay);

        try {
            Lampa.Controller.collectionSet(overlay);
            Lampa.Controller.collectionFocus(overlay.querySelector('[data-c="y"]'), overlay);
        } catch (e) {}

        function close(result) {
            try { overlay.remove(); } catch (e) {}
            try { Lampa.Controller.toggle('urrowstore'); } catch (e) {}
            cb(result);
        }

        overlay.querySelector('[data-c="y"]').addEventListener('hover:enter', function () { close(true); });
        overlay.querySelector('[data-c="n"]').addEventListener('hover:enter', function () { close(false); });
        overlay.querySelector('[data-c="y"]').addEventListener('click', function () { close(true); });
        overlay.querySelector('[data-c="n"]').addEventListener('click', function () { close(false); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(false); });
    }

    // === MAIN COMPONENT (Lampa.Component.add) ===
    function UrrowStoreComponent(object) {
        var self = this;
        var el = null;
        var lastFocused = null;
        var data = { all: [], cat: 'all', query: '', catalog: null };

        self.create = function () {
            injectStyles();
            el = document.createElement('div');
            el.className = 'us';
            el.innerHTML = '<div class="us-load"><div class="us-spin"></div><div>Загрузка каталога...</div></div>';
            self.load();
        };

        self.render = function () { return el; };

        self.start = function () {
            if (!el) return;
            try {
                // Устанавливаем коллекцию для навигации
                Lampa.Controller.collectionSet(el);
                // Ставим фокус на первый элемент
                var target = (lastFocused && el.contains(lastFocused)) ? lastFocused : el.querySelector('.selector');
                if (target) {
                    Lampa.Controller.collectionFocus(target, el);
                }
                // Активируем контроллер
                Lampa.Controller.toggle('urrowstore');
                console.log('[urrowstore] start: controller activated');
            } catch (e) {
                console.error('[urrowstore] start error:', e);
            }
        };

        self.back = function () {
            try { Lampa.Activity.backward(); } catch (e) {}
        };

        self.destroy = function () {
            el = null;
            lastFocused = null;
        };

        self.load = function () {
            fetchCatalog(false, function (catalog) {
                data.catalog = catalog;
                data.all = catalog.plugins || [];
                self.renderList();
            });
        };

        self.filtered = function () {
            return data.all.filter(function (p) {
                var mc = data.cat === 'all' || p.category === data.cat;
                var ms = !data.query || p.name.toLowerCase().indexOf(data.query) !== -1 || p.description.toLowerCase().indexOf(data.query) !== -1 || p.author.toLowerCase().indexOf(data.query) !== -1;
                return mc && ms;
            });
        };

        self.renderList = function () {
            var f = self.filtered();
            var ext = getExt();
            var h = '';

            h += '<div class="us-hdr">';
            h += '<div class="us-title">📦 URROW Store <span class="us-ver">v' + (data.catalog ? data.catalog.version : '?') + '</span></div>';
            h += '<div class="us-btns">';
            h += '<button class="selector us-b us-b--s" data-do="check">🔍 Проверить</button>';
            h += '<button class="selector us-b us-b--s" data-do="upall">🔄 Обновить всё</button>';
            h += '<button class="selector us-b us-b--p" data-do="refresh">↻ Обновить каталог</button>';
            h += '</div></div>';

            h += '<div class="us-stats">';
            h += '<div class="us-stat">Всего: <b>' + data.all.length + '</b></div>';
            h += '<div class="us-stat">Установлено: <b>' + ext.length + '</b></div>';
            h += '<div class="us-stat">Активных: <b>' + data.all.filter(function (p) { return p.status === 'active'; }).length + '</b></div>';
            h += '</div>';

            h += '<div class="us-search"><span class="us-si">🔍</span>';
            h += '<input class="selector" type="text" placeholder="Поиск..." data-do="search" value="' + data.query + '"></div>';

            var cs = {};
            data.all.forEach(function (p) { if (p.status !== 'broken') cs[p.category] = (cs[p.category] || 0) + 1; });
            h += '<div class="us-cats">';
            h += '<button class="selector us-cat ' + (data.cat === 'all' ? 'us-cat--on' : '') + '" data-cat="all">Все (' + data.all.length + ')</button>';
            Object.keys(cs).forEach(function (c) {
                h += '<button class="selector us-cat ' + (data.cat === c ? 'us-cat--on' : '') + '" data-cat="' + c + '">' + catName(c) + ' (' + cs[c] + ')</button>';
            });
            h += '</div>';

            h += '<div class="us-list">';
            f.forEach(function (p) {
                var inst = isInstalled(p.script_url);
                var cls = 'us-card selector' + (inst ? ' us-card--in' : '');
                var compat = checkCompat(p);
                var canInst = p.status === 'active' && compat !== 'outdated';

                h += '<div class="' + cls + '" data-pid="' + p.id + '" tabindex="0">';
                h += '<div class="us-top"><div class="us-info"><div class="us-name">' + p.name + '</div>';
                h += '<div class="us-author">by ' + p.author + '</div></div>';
                h += renderBadge(p);
                if (p.rating && p.rating.count) h += renderStars(p.rating);
                h += '</div>';
                h += '<div class="us-desc">' + p.description + '</div>';
                h += '<div class="us-row">';
                if (inst) {
                    h += '<button class="selector us-ab us-ab--r" data-do="uninstall" data-id="' + p.id + '">Удалить</button>';
                } else if (canInst) {
                    h += '<button class="selector us-ab us-ab--i" data-do="install" data-id="' + p.id + '">Установить</button>';
                } else if (compat === 'outdated') {
                    h += '<button class="selector us-ab us-ab--u" data-do="install" data-id="' + p.id + '">Установить (форс)</button>';
                }
                h += '</div>';
                h += '<div class="us-bottom"><div class="us-tags"><span class="us-tag">' + catName(p.category) + '</span>';
                if (p.downloads) h += '<span class="us-tag">⬇ ' + p.downloads + '</span>';
                h += '</div><span class="us-vtag">v' + p.version + '</span></div></div>';
            });
            h += '</div>';

            if (!f.length) h += '<div class="us-empty">🔍 Ничего не найдено</div>';

            el.innerHTML = h;
            self.bindEvents();
            self.start();
        };

        self.bindEvents = function () {
            // Карточки — hover:enter (пульт ОК)
            el.querySelectorAll('.us-card').forEach(function (card) {
                card.addEventListener('hover:enter', function () {
                    var pid = card.getAttribute('data-pid');
                    var p = data.all.find(function (x) { return x.id === pid; });
                    if (!p) return;
                    var inst = isInstalled(p.script_url);
                    if (inst) {
                        confirmDialog('Удалить ' + p.name + '?', function (yes) {
                            if (yes) { uninstallPlugin(p, self.renderList); }
                            else { self.start(); }
                        });
                    } else {
                        confirmDialog('Установить ' + p.name + '?', function (yes) {
                            if (yes) { installPlugin(p, self.renderList); }
                            else { self.start(); }
                        });
                    }
                });
                card.addEventListener('hover:focus', function () {
                    lastFocused = card;
                });
            });

            // Категории — hover:enter
            el.querySelectorAll('[data-cat]').forEach(function (b) {
                b.addEventListener('hover:enter', function () {
                    data.cat = b.getAttribute('data-cat');
                    lastFocused = null;
                    self.renderList();
                });
            });

            // Кнопки — hover:enter
            el.querySelectorAll('[data-do="refresh"]').forEach(function (b) {
                b.addEventListener('hover:enter', function () {
                    fetchCatalog(true, function (nc) {
                        data.catalog = nc;
                        data.all = nc.plugins || [];
                        lastFocused = null;
                        notify('🔄 Каталог обновлён');
                        self.renderList();
                    });
                });
            });

            el.querySelectorAll('[data-do="check"]').forEach(function (b) {
                b.addEventListener('hover:enter', function () {
                    var br = data.all.filter(function (p) { return p.status === 'broken'; });
                    var od = data.all.filter(function (p) { return checkCompat(p) === 'outdated'; });
                    var msg = '✓ Все плагины в порядке';
                    if (br.length) msg = '✗ Сломанных: ' + br.length;
                    if (od.length) msg += ' | Устаревших: ' + od.length;
                    notify(msg);
                    self.start();
                });
            });

            el.querySelectorAll('[data-do="upall"]').forEach(function (b) {
                b.addEventListener('hover:enter', function () {
                    var updatable = data.all.filter(function (p) { return p.status === 'active' && checkCompat(p) === 'ok' && !isInstalled(p.script_url); });
                    if (!updatable.length) { notify('✓ Нет доступных'); self.start(); return; }
                    confirmDialog('Установить все (' + updatable.length + ')?', function (yes) {
                        if (yes) {
                            var i = 0;
                            (function next() {
                                if (i >= updatable.length) { notify('✓ Готово'); self.renderList(); return; }
                                installPlugin(updatable[i], function () { i++; next(); });
                            })();
                        } else { self.start(); }
                    });
                });
            });

            // Поиск
            var si = el.querySelector('[data-do="search"]');
            if (si) {
                var st;
                si.oninput = function () {
                    clearTimeout(st);
                    st = setTimeout(function () {
                        data.query = si.value.toLowerCase().trim();
                        lastFocused = null;
                        self.renderList();
                    }, 200);
                };
            }
        };
    }

    // === OPEN STORE ===
    function openStore() {
        Lampa.Activity.push({
            url: 'urrowstore',
            component: 'urrowstore_main',
            title: 'URROW Store'
        });
    }

    // === ИНИЦИАЛИЗАЦИЯ ===
    function init() {
        console.log('[urrowstore] init, Lampa v=' + getLampaVersion());

        // Регистрация плагина
        try {
            Lampa.Manifest.plugin = { type: 'other', version: '2.6.0', name: 'URROW Store', description: 'Динамический магазин плагинов', component: 'urrowstore_main' };
        } catch (e) {}

        // Регистрация компонента
        try {
            Lampa.Component.add('urrowstore_main', UrrowStoreComponent);
            console.log('[urrowstore] Component.add выполнен');
        } catch (e) {
            console.error('[urrowstore] Component.add error:', e);
        }

        // Регистрация контроллера для пульта
        try {
            if (Lampa.Controller && typeof Lampa.Controller.add === 'function') {
                Lampa.Controller.add('urrowstore', {
                    toggle: function () {
                        try {
                            var render = (this.activity && this.activity.render) ? this.activity.render() : null;
                            if (!render) {
                                var el2 = document.querySelector('.us');
                                if (el2) render = el2;
                            }
                            if (render) {
                                Lampa.Controller.collectionSet(render);
                                var first = render.querySelector('.selector');
                                if (first) Lampa.Controller.collectionFocus(first, render);
                            }
                        } catch (e) {
                            console.error('[urrowstore] Controller.toggle error:', e);
                        }
                    },
                    move: function (direction) {
                        try { Lampa.Controller.move(direction); } catch (e) {}
                    },
                    enter: function () {
                        try {
                            var focused = document.querySelector('.selector.focus, .selector.hover');
                            if (focused) {
                                var evt = new MouseEvent('click', { bubbles: true });
                                focused.dispatchEvent(evt);
                            }
                        } catch (e) {}
                    },
                    back: function () {
                        try { Lampa.Activity.backward(); } catch (e) {}
                    }
                });
                console.log('[urrowstore] Controller.add выполнен');
            }
        } catch (e) {
            console.error('[urrowstore] Controller.add error:', e);
        }

        // Иконка в шапку (рядом с поиском)
        addHeaderIcon();

        // Иконка в боковое меню
        addMenuButton();

        // Раздел в настройках
        addSettingsSection();

        // Автообновление store.js
        var autoUpdate = getStorage('urrowstore_auto_update', true);
        if (autoUpdate) checkStoreUpdate();

        console.log('[urrowstore] init завершён');
    }

    function getStorage(name, def) {
        try { return Lampa.Storage.get(name, def); } catch (e) { return def; }
    }

    // === ЗАПУСК (стандартный паттерн Lampa) ===
    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();
