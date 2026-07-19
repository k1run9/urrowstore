/* URROW Store v2 — Магазин плагинов для Lampa */
(function () {
    'use strict';

    if (window.__urrow_store) return;
    window.__urrow_store = true;

    // === КОНФИГУРАЦИЯ ===
    var CATALOG_URL = 'https://k1run9.github.io/urrowstore/catalog.json';
    var RATINGS_URL = 'https://k1run9.github.io/urrowstore/ratings.json';
    var CACHE_KEY = 'urrow_catalog_cache';
    var CACHE_TIME_KEY = 'urrow_catalog_cache_time';
    var CACHE_TTL = 3 * 3600 * 1000; // 3 часа

    // === ОЖИДАНИЕ LAMPA ===
    function waitForLampa(cb) {
        if (window.Lampa && Lampa.Manifest && Lampa.Activity && Lampa.Storage) cb();
        else setTimeout(function () { waitForLampa(cb); }, 100);
    }

    waitForLampa(function () {

        // === УТИЛИТЫ ===
        function notify(msg) {
            if (Lampa.Noty) Lampa.Noty.show(msg);
        }
        function askReload() {
            if (Lampa.Utils && Lampa.Utils.showReload) Lampa.Utils.showReload();
        }

        // === CATALOG LOADER ===
        function fetchCatalog(force, cb) {
            var now = Date.now();
            var cacheTime = parseInt(Lampa.Storage.get(CACHE_TIME_KEY, '0')) || 0;
            var cached = Lampa.Storage.get(CACHE_KEY, null);

            if (!force && cached && (now - cacheTime) < CACHE_TTL) {
                cb(cached);
                return;
            }

            var req = new Lampa.Reguest();
            req.timeout = 15000;
            req.silent(CATALOG_URL, function (data) {
                try {
                    if (typeof data === 'string') data = JSON.parse(data);
                    Lampa.Storage.set(CACHE_KEY, data);
                    Lampa.Storage.set(CACHE_TIME_KEY, String(now));
                    cb(data);
                } catch (e) {
                    cb(cached || { version: '0.0.0', plugins: [] });
                }
            }, function () {
                cb(cached || { version: '0.0.0', plugins: [] });
            });
        }

        // === ПРОВЕРКА ВЕРСИИ LAMPA ===
        function getLampaVersion() {
            try {
                if (Lampa.Manifest && Lampa.Manifest.version) return parseInt(Lampa.Manifest.version) || 0;
                var scripts = document.querySelectorAll('script[src*="app.min.js"]');
                for (var i = 0; i < scripts.length; i++) {
                    var m = scripts[i].src.match(/v=(\d+)/);
                    if (m) return parseInt(m[1]);
                }
            } catch (e) {}
            return 0;
        }

        function checkCompat(plugin) {
            var current = getLampaVersion();
            var min = parseInt(plugin.min_lampa_version) || 0;
            var max = parseInt(plugin.max_lampa_version) || 0;
            if (min && current && current < min) return 'outdated';
            if (max && current && current > max) return 'unstable';
            return 'ok';
        }

        // === EXTENSIONS STORAGE ===
        function getExtensions() {
            try {
                var ext = Lampa.Storage.get('extensions', []);
                return Array.isArray(ext) ? ext : [];
            } catch (e) { return []; }
        }

        function isInstalled(scriptUrl) {
            return getExtensions().some(function (e) { return e.url === scriptUrl; });
        }

        function installPlugin(plugin, cb) {
            try {
                var ext = getExtensions();
                var exists = ext.some(function (e) { return e.url === plugin.script_url; });
                if (!exists) {
                    ext.push({ url: plugin.script_url, name: plugin.name, author: plugin.author, enabled: 1, status: 1 });
                    Lampa.Storage.set('extensions', ext);
                }

                // Загружаем скрипт
                if (Lampa.Utils && Lampa.Utils.putScriptAsync) {
                    Lampa.Utils.putScriptAsync([plugin.script_url], function () {
                        notify(plugin.name + ' установлен');
                        if (cb) cb();
                    }, function () {
                        notify(plugin.name + ' добавлен (перезагрузите)');
                        if (cb) cb();
                    });
                } else {
                    var s = document.createElement('script');
                    s.src = plugin.script_url;
                    document.body.appendChild(s);
                    notify(plugin.name + ' установлен');
                    if (cb) cb();
                }
            } catch (e) {
                notify('Ошибка установки');
                if (cb) cb();
            }
        }

        function uninstallPlugin(plugin, cb) {
            try {
                var ext = getExtensions();
                ext = ext.filter(function (e) { return e.url !== plugin.script_url; });
                Lampa.Storage.set('extensions', ext);
                notify(plugin.name + ' удалён');
            } catch (e) {}
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
                '.us-b{padding:0.5em 1em;border-radius:0.5em;border:none;cursor:pointer;font-size:0.85em;font-weight:600;color:#fff;transition:all .2s}',
                '.us-b--p{background:linear-gradient(135deg,#667eea,#764ba2)}',
                '.us-b--s{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.8)}',
                '.us-stats{display:flex;gap:1em;margin-bottom:1.2em;flex-wrap:wrap}',
                '.us-stat{font-size:0.8em;color:rgba(255,255,255,0.4)}',
                '.us-stat b{color:rgba(255,255,255,0.7)}',
                '.us-search{position:relative;margin-bottom:1em}',
                '.us-search input{width:100%;padding:0.7em 1em 0.7em 2.5em;border-radius:0.5em;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:0.85em;outline:none}',
                '.us-search input:focus{border-color:rgba(102,126,234,0.5)}',
                '.us-si{position:absolute;left:0.8em;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.3)}',
                '.us-cats{display:flex;gap:0.4em;margin-bottom:1.2em;flex-wrap:wrap}',
                '.us-cat{padding:0.35em 0.8em;border-radius:1.2em;font-size:0.75em;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);background:transparent;transition:all .2s}',
                '.us-cat--on{background:linear-gradient(135deg,#667eea,#764ba2);border-color:transparent;color:#fff}',
                '.us-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(20em,1fr));gap:0.7em}',
                '.us-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:0.7em;padding:1em;transition:all .2s}',
                '.us-card--in{border-color:rgba(102,126,234,0.25);background:rgba(102,126,234,0.05)}',
                '.us-top{display:flex;align-items:flex-start;gap:0.7em}',
                '.us-info{flex:1;min-width:0}',
                '.us-name{font-size:0.95em;font-weight:700;color:#fff}',
                '.us-author{font-size:0.7em;color:rgba(255,255,255,0.4)}',
                '.us-desc{font-size:0.75em;color:rgba(255,255,255,0.55);margin-top:0.4em;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
                '.us-row{display:flex;gap:0.35em;margin-top:0.7em;flex-wrap:wrap;align-items:center}',
                '.us-ab{padding:0.35em 0.8em;border-radius:0.35em;border:none;cursor:pointer;font-size:0.75em;font-weight:600;color:#fff;transition:all .2s}',
                '.us-ab--i{background:linear-gradient(135deg,#667eea,#764ba2)}',
                '.us-ab--r{background:rgba(231,76,60,0.15);color:#e74c3c}',
                '.us-ab--u{background:rgba(241,196,15,0.15);color:#f1c40f}',
                '.us-badge{display:inline-flex;align-items:center;gap:0.25em;font-size:0.7em;padding:0.15em 0.5em;border-radius:0.25em;font-weight:600}',
                '.us-badge--ok{background:rgba(46,204,113,0.15);color:#2ecc71}',
                '.us-badge--br{background:rgba(231,76,60,0.15);color:#e74c3c}',
                '.us-badge--old{background:rgba(241,196,15,0.15);color:#f1c40f}',
                '.us-badge--dep{background:rgba(155,155,155,0.15);color:#999}',
                '.us-stars{color:#f1c40f;font-size:0.75em}',
                '.us-sec{font-size:0.9em;font-weight:700;color:rgba(255,255,255,0.9);margin:1.2em 0 0.7em;display:flex;align-items:center;gap:0.5em}',
                '.us-cnt{font-size:0.7em;background:rgba(255,255,255,0.1);padding:0.15em 0.5em;border-radius:0.6em;color:rgba(255,255,255,0.5)}',
                '.us-tags{display:flex;gap:0.2em;flex-wrap:wrap;margin-top:0.5em}',
                '.us-tag{font-size:0.65em;padding:0.1em 0.35em;border-radius:0.2em;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.4)}',
                '.us-bottom{display:flex;align-items:center;justify-content:space-between;margin-top:0.5em}',
                '.us-vtag{font-size:0.65em;color:rgba(255,255,255,0.3)}',
                '.us-empty{text-align:center;padding:3em;color:rgba(255,255,255,0.3)}',
                '.us-load{text-align:center;padding:4em;color:rgba(255,255,255,0.4)}',
                '.us-spin{display:inline-block;width:2em;height:2em;border:3px solid rgba(255,255,255,0.1);border-top-color:#667eea;border-radius:50%;animation:uss .8s linear infinite;margin-bottom:0.8em}',
                '@keyframes uss{to{transform:rotate(360deg)}}'
            ].join('');
            document.head.appendChild(s);
        }

        // === RATING ===
        function renderStars(rating) {
            if (!rating || !rating.count) return '';
            var full = Math.floor(rating.average);
            var half = rating.average - full >= 0.5 ? 1 : 0;
            var empty = 5 - full - half;
            var s = '';
            for (var i = 0; i < full; i++) s += '★';
            for (var i = 0; i < half; i++) s += '½';
            for (var i = 0; i < empty; i++) s += '☆';
            return '<span class="us-stars">' + s + '</span> <span style="font-size:0.7em;color:rgba(255,255,255,0.4)">' + rating.average.toFixed(1) + ' (' + rating.count + ')</span>';
        }

        function renderBadge(plugin) {
            var compat = checkCompat(plugin);
            if (plugin.status === 'broken') return '<span class="us-badge us-badge--br">✗ Сломан</span>';
            if (plugin.status === 'deprecated') return '<span class="us-badge us-badge--dep">Устарел</span>';
            if (compat === 'outdated') return '<span class="us-badge us-badge--old">⚠ Требуется обновление Lampa</span>';
            if (compat === 'unstable') return '<span class="us-badge us-badge--old">⚠ Может не работать</span>';
            return '<span class="us-badge us-badge--ok">✓ Активен</span>';
        }

        function getCategoryName(c) {
            return { interface:'🎨 Интерфейс', player:'▶️ Плеер', catalog:'📂 Каталог', torrent:'🎯 Торренты', misc:'🔧 Прочее' }[c] || c;
        }

        // === RENDER ===
        function renderStore(onReady) {
            var el = document.createElement('div');
            el.className = 'us';
            el.innerHTML = '<div class="us-load"><div class="us-spin"></div><div>Загрузка каталога...</div></div>';
            injectStyles();

            fetchCatalog(false, function (catalog) {
                var all = catalog.plugins || [];
                var cat = 'all';
                var query = '';
                var installed = getExtensions();

                function isInst(p) {
                    return installed.some(function (e) { return e.url === p.script_url; });
                }

                function filtered() {
                    return all.filter(function (p) {
                        var mc = cat === 'all' || p.category === cat;
                        var ms = !query || p.name.toLowerCase().indexOf(query) !== -1 || p.description.toLowerCase().indexOf(query) !== -1 || p.author.toLowerCase().indexOf(query) !== -1;
                        return mc && ms;
                    });
                }

                function cats() {
                    var c = {};
                    all.forEach(function (p) { if (p.status !== 'broken') c[p.category] = (c[p.category] || 0) + 1; });
                    return c;
                }

                function findP(id) { return all.find(function (p) { return p.id === id; }); }

                function render() {
                    var f = filtered();
                    var cs = cats();
                    var ic = installed.length;
                    var h = '';

                    // Шапка
                    h += '<div class="us-hdr">';
                    h += '<div class="us-title">📦 URROW Store <span class="us-ver">v' + catalog.version + '</span></div>';
                    h += '<div class="us-btns">';
                    h += '<button class="selector us-b us-b--s" data-do="check">🔍 Проверить</button>';
                    h += '<button class="selector us-b us-b--s" data-do="upall">🔄 Обновить всё</button>';
                    h += '<button class="selector us-b us-b--p" data-do="refresh">↻ Обновить каталог</button>';
                    h += '</div></div>';

                    // Статистика
                    h += '<div class="us-stats">';
                    h += '<div class="us-stat">Всего: <b>' + all.length + '</b></div>';
                    h += '<div class="us-stat">Установлено: <b>' + ic + '</b></div>';
                    h += '<div class="us-stat">Активных: <b>' + all.filter(function (p) { return p.status === 'active'; }).length + '</b></div>';
                    h += '</div>';

                    // Поиск
                    h += '<div class="us-search"><span class="us-si">🔍</span>';
                    h += '<input class="selector" type="text" placeholder="Поиск по названию, описанию, автору..." data-do="search" value="' + query + '"></div>';

                    // Категории
                    h += '<div class="us-cats">';
                    h += '<button class="selector us-cat ' + (cat === 'all' ? 'us-cat--on' : '') + '" data-cat="all">Все (' + all.length + ')</button>';
                    Object.keys(cs).forEach(function (c) {
                        h += '<button class="selector us-cat ' + (cat === c ? 'us-cat--on' : '') + '" data-cat="' + c + '">' + getCategoryName(c) + ' (' + cs[c] + ')</button>';
                    });
                    h += '</div>';

                    // Карточки
                    if (f.length) {
                        h += '<div class="us-grid">';
                        f.forEach(function (p) { h += card(p); });
                        h += '</div>';
                    } else {
                        h += '<div class="us-empty">🔍 Ничего не найдено</div>';
                    }

                    el.innerHTML = h;
                    bind();
                }

                function card(p) {
                    var inst = isInst(p);
                    var cls = 'us-card' + (inst ? ' us-card--in' : '');
                    var compat = checkCompat(p);
                    var canInstall = p.status === 'active' && compat !== 'outdated';

                    var s = '<div class="' + cls + '" data-pid="' + p.id + '">';
                    s += '<div class="us-top">';
                    s += '<div class="us-info">';
                    s += '<div class="us-name">' + p.name + '</div>';
                    s += '<div class="us-author">by ' + p.author + '</div>';
                    s += '</div>';
                    s += renderBadge(p);
                    if (p.rating && p.rating.count) s += renderStars(p.rating);
                    s += '</div>';
                    s += '<div class="us-desc">' + p.description + '</div>';

                    // Кнопки
                    s += '<div class="us-row">';
                    if (inst) {
                        s += '<button class="selector us-ab us-ab--r" data-do="uninstall" data-id="' + p.id + '">Удалить</button>';
                    } else if (canInstall) {
                        s += '<button class="selector us-ab us-ab--i" data-do="install" data-id="' + p.id + '">Установить</button>';
                    } else if (compat === 'outdated') {
                        s += '<button class="selector us-ab us-ab--u" data-do="install-force" data-id="' + p.id + '">Установить (форс)</button>';
                    }
                    s += '</div>';

                    // Теги
                    s += '<div class="us-bottom">';
                    s += '<div class="us-tags"><span class="us-tag">' + getCategoryName(p.category) + '</span>';
                    if (p.downloads) s += '<span class="us-tag">⬇ ' + p.downloads + '</span>';
                    s += '</div>';
                    s += '<span class="us-vtag">v' + p.version + '</span>';
                    s += '</div></div>';
                    return s;
                }

                function bind() {
                    // Категории
                    el.querySelectorAll('[data-cat]').forEach(function (b) {
                        b.onclick = function () { cat = b.getAttribute('data-cat'); render(); };
                    });

                    // Установка
                    el.querySelectorAll('[data-do="install"]').forEach(function (b) {
                        b.onclick = function (e) {
                            e.stopPropagation();
                            var p = findP(b.getAttribute('data-id'));
                            if (p) installPlugin(p, render);
                        };
                    });

                    // Форс-установка
                    el.querySelectorAll('[data-do="install-force"]').forEach(function (b) {
                        b.onclick = function (e) {
                            e.stopPropagation();
                            var p = findP(b.getAttribute('data-id'));
                            if (p) installPlugin(p, render);
                        };
                    });

                    // Удаление
                    el.querySelectorAll('[data-do="uninstall"]').forEach(function (b) {
                        b.onclick = function (e) {
                            e.stopPropagation();
                            var p = findP(b.getAttribute('data-id'));
                            if (p) uninstallPlugin(p, render);
                        };
                    });

                    // Обновить каталог
                    el.querySelectorAll('[data-do="refresh"]').forEach(function (b) {
                        b.onclick = function () {
                            fetchCatalog(true, function (newCatalog) {
                                catalog = newCatalog;
                                all = catalog.plugins || [];
                                installed = getExtensions();
                                notify('🔄 Каталог обновлён');
                                render();
                            });
                        };
                    });

                    // Проверка сломанных
                    el.querySelectorAll('[data-do="check"]').forEach(function (b) {
                        b.onclick = function () {
                            var broken = all.filter(function (p) { return p.status === 'broken'; });
                            var outdated = all.filter(function (p) { return checkCompat(p) === 'outdated'; });
                            var msg = '✓ Все плагины в порядке';
                            if (broken.length) msg = '✗ Сломанных: ' + broken.length;
                            if (outdated.length) msg += ' | Требуют обновления Lampa: ' + outdated.length;
                            notify(msg);
                        };
                    });

                    // Поиск
                    var si = el.querySelector('[data-do="search"]');
                    if (si) {
                        var st;
                        si.oninput = function () {
                            clearTimeout(st);
                            st = setTimeout(function () { query = si.value.toLowerCase().trim(); render(); }, 200);
                        };
                    }

                    if (onReady) onReady(el);
                }

                render();
            });

            return el;
        }

        // === ACTIVITY COMPONENT ===
        function UrrowStoreComponent(object) {
            var self = this;
            var el = null;

            self.create = function () {
                el = renderStore(function () { self.start(); });
            };

            self.render = function () { return el; };

            self.start = function () {
                if (!el) return;
                Lampa.Controller.collectionSet(el);
                var first = el.querySelector('.selector');
                if (first) Lampa.Controller.collectionFocus(first, el);
            };

            self.back = function () { Lampa.Activity.backward(); };
            self.destroy = function () { el = null; };
        }

        // === ОТКРЫТИЕ МАГАЗИНА ===
        function openStore() {
            Lampa.Activity.push({ url: 'urrowstore', component: 'urrow_store', title: 'URROW Store' });
        }

        // === КНОПКА В ШАПКЕ ===
        function addHeaderButton() {
            if (Lampa.Head && Lampa.Head.addIcon) {
                Lampa.Head.addIcon(
                    '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="2"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
                    function () { openStore(); }
                );
            }
        }

        // === РЕГИСТРАЦИЯ ===
        Lampa.Manifest.plugin = { type: 'other', version: '2.0.0', name: 'URROW Store', description: 'Динамический магазин плагинов', component: 'urrow_store' };

        if (Lampa.Component) Lampa.Component.add('urrow_store', UrrowStoreComponent);

        addHeaderButton();

        if (Lampa.Menu && Lampa.Menu.addButton) {
            Lampa.Menu.addButton({
                name: 'URROW Store',
                description: 'Магазин плагинов',
                icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="2"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
                onSelect: openStore
            });
        }

        console.log('[URROW Store v2] loaded');
    });
})();
