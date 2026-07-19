/* URROW Store v3.0 — Упрощённый магазин для Lampa */
(function () {
    'use strict';
    if (window.__urrow_store) return;
    window.__urrow_store = true;
    console.log('[urrowstore] loaded');

    var CATALOG_URL = 'https://k1run9.github.io/urrowstore/catalog.json';
    var VERSION_URL = 'https://k1run9.github.io/urrowstore/version.json';
    var STORE_URL = 'https://k1run9.github.io/urrowstore/store.js';
    var CACHE_KEY = 'urrow_catalog_cache';
    var CACHE_TIME_KEY = 'urrow_catalog_cache_time';
    var CACHE_TTL = 3 * 3600 * 1000;
    var PER_PAGE = 20;

    function notify(msg) { try { Lampa.Noty.show(msg); } catch (e) {} }
    function getVer() { try { return parseInt(Lampa.Manifest.version) || 0; } catch (e) { return 0; } }

    // === AUTO-UPDATE ===
    function checkUpdate() {
        try {
            var cur = Lampa.Storage.get('urrowstore_ver', '0');
            var ctrl = new AbortController();
            var t = setTimeout(function () { ctrl.abort(); }, 5000);
            fetch(VERSION_URL + '?t=' + Date.now(), { signal: ctrl.signal })
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    clearTimeout(t);
                    if (d.version && d.version !== cur) {
                        Lampa.Storage.set('urrowstore_ver', d.version);
                        var s = document.createElement('script');
                        s.src = STORE_URL + '?v=' + d.version;
                        document.body.appendChild(s);
                    }
                }).catch(function () {});
        } catch (e) {}
    }

    // === CATALOG ===
    function fetchCatalog(force, cb) {
        var now = Date.now();
        var ct = parseInt(Lampa.Storage.get(CACHE_TIME_KEY, '0')) || 0;
        var cached = Lampa.Storage.get(CACHE_KEY, null);
        if (!force && cached && (now - ct) < CACHE_TTL) { cb(cached); return; }
        try {
            var req = new Lampa.Reguest();
            req.timeout = 15000;
            req.silent(CATALOG_URL, function (d) {
                try {
                    if (typeof d === 'string') d = JSON.parse(d);
                    Lampa.Storage.set(CACHE_KEY, d);
                    Lampa.Storage.set(CACHE_TIME_KEY, String(now));
                    cb(d);
                } catch (e) { cb(cached || { version: '0', plugins: [] }); }
            }, function () { cb(cached || { version: '0', plugins: [] }); });
        } catch (e) { cb(cached || { version: '0', plugins: [] }); }
    }

    // === EXTENSIONS ===
    function getExt() {
        try { var e = Lampa.Storage.get('plugins', []); return Array.isArray(e) ? e : []; }
        catch (x) { return []; }
    }
    function isInst(url) { return getExt().some(function (e) { return e.url === url; }); }

    function ensureAgreement() {
        try { if (!Lampa.Storage.get('agree_installation', false)) Lampa.Storage.set('agree_installation', true); } catch (e) {}
    }

    function installPlugin(p, cb) {
        ensureAgreement();
        try {
            var ext = getExt();
            if (!ext.some(function (e) { return e.url === p.script_url; })) {
                var plug = { url: p.script_url, name: p.name, author: p.author, status: 1 };
                ext.push(plug);
                Lampa.Storage.set('plugins', ext);
                if (Lampa.Plugins && Lampa.Plugins.push) Lampa.Plugins.push(plug);
            }
            notify(p.name + ' ✓');
            if (cb) cb();
        } catch (e) { notify('Ошибка'); if (cb) cb(); }
    }

    function uninstallPlugin(p, cb) {
        try {
            Lampa.Storage.set('plugins', getExt().filter(function (e) { return e.url !== p.script_url; }));
            if (Lampa.Plugins && Lampa.Plugins.remove) Lampa.Plugins.remove({ url: p.script_url });
            notify(p.name + ' удалён');
            if (cb) cb();
        } catch (e) { if (cb) cb(); }
    }

    // === CSS ===
    function injectCSS() {
        if (document.getElementById('urrow-store-css')) return;
        var s = document.createElement('style');
        s.id = 'urrow-store-css';
        s.textContent = [
            '.us{padding:1em;max-width:900px;margin:0 auto}',
            '.us-row{display:flex;gap:0.5em;margin-bottom:1em;align-items:center}',
            '.us-b{padding:0.5em 1em;border-radius:0.5em;border:2px solid transparent;cursor:pointer;font-size:0.85em;font-weight:600;color:#fff;transition:all .2s ease}',
            '.us-b--p{background:linear-gradient(135deg,#667eea,#764ba2)}',
            '.us-b--s{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.8)}',
            '.us-b.selector.focus{border-color:#667eea;box-shadow:0 0 16px rgba(102,126,234,0.6);transform:scale(1.08)}',
            '.us-tabs{display:flex;gap:0.4em;margin-bottom:1em}',
            '.us-tab{padding:0.4em 1em;border-radius:2em;font-size:0.8em;font-weight:600;cursor:pointer;border:2px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);background:transparent;transition:all .2s ease}',
            '.us-tab--on{background:linear-gradient(135deg,#667eea,#764ba2);border-color:transparent;color:#fff}',
            '.us-tab.selector.focus{border-color:#667eea;color:#fff;transform:scale(1.08);box-shadow:0 0 12px rgba(102,126,234,0.5)}',
            '.us-list{display:flex;flex-direction:column;gap:0.4em}',
            '.us-card{background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.06);border-radius:0.6em;padding:0.8em 1em;transition:all .2s ease;cursor:pointer;display:flex;align-items:center;gap:1em}',
            '.us-card.selector.focus{border-color:#667eea;background:rgba(102,126,234,0.1);box-shadow:0 0 20px rgba(102,126,234,0.4);transform:scale(1.01)}',
            '.us-card--in{border-color:rgba(46,204,113,0.2);background:rgba(46,204,113,0.04)}',
            '.us-card--in.selector.focus{border-color:#2ecc71;box-shadow:0 0 16px rgba(46,204,113,0.3)}',
            '.us-card__icon{font-size:1.8em;width:2em;height:2em;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.06);border-radius:0.5em;flex-shrink:0}',
            '.us-card__info{flex:1;min-width:0}',
            '.us-card__name{font-size:0.9em;font-weight:700;color:#fff}',
            '.us-card__author{font-size:0.7em;color:rgba(255,255,255,0.4)}',
            '.us-card__desc{font-size:0.7em;color:rgba(255,255,255,0.45);margin-top:0.2em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.us-card__badge{font-size:0.7em;padding:0.2em 0.6em;border-radius:0.3em;font-weight:600;flex-shrink:0}',
            '.us-card__badge--ok{background:rgba(46,204,113,0.15);color:#2ecc71}',
            '.us-card__badge--br{background:rgba(231,76,60,0.15);color:#e74c3c}',
            '.us-card__badge--old{background:rgba(241,196,15,0.15);color:#f1c40f}',
            '.us-more{text-align:center;padding:1em;color:rgba(255,255,255,0.5);cursor:pointer;border:2px solid rgba(255,255,255,0.1);border-radius:0.5em;transition:all .2s ease}',
            '.us-more.selector.focus{border-color:#667eea;transform:scale(1.02)}',
            '.us-empty{text-align:center;padding:2em;color:rgba(255,255,255,0.3)}',
            '.us-load{text-align:center;padding:3em;color:rgba(255,255,255,0.4)}',
            '.us-spin{display:inline-block;width:2em;height:2em;border:3px solid rgba(255,255,255,0.1);border-top-color:#667eea;border-radius:50%;animation:uss .8s linear infinite}',
            '@keyframes uss{to{transform:rotate(360deg)}}'
        ].join('');
        document.head.appendChild(s);
    }

    // === COMPONENT ===
    function UrrowStoreComp(obj) {
        var self = this;
        var el = null;
        var state = { all: [], cat: 'all', page: 0, catalog: null };

        self.create = function () {
            injectCSS();
            el = document.createElement('div');
            el.className = 'us';
            el.innerHTML = '<div class="us-load"><div class="us-spin"></div></div>';
            fetchCatalog(false, function (c) {
                state.catalog = c;
                state.all = c.plugins || [];
                self.render();
            });
        };

        self.render = function () { return el; };

        self.start = function () {
            if (!el) return;
            try {
                Lampa.Controller.collectionSet(el);
                var first = el.querySelector('.selector');
                if (first) Lampa.Controller.collectionFocus(first, el);
            } catch (e) {}
        };

        self.back = function () { try { Lampa.Activity.backward(); } catch (e) {} };
        self.destroy = function () { el = null; };

        self.filtered = function () {
            return state.all.filter(function (p) {
                var mc = state.cat === 'all' || p.category === state.cat;
                return mc && p.status !== 'broken';
            });
        };

        self.render = function () {
            var f = self.filtered();
            var ext = getExt();
            var page = state.page;
            var total = f.length;
            var pages = Math.ceil(total / PER_PAGE);
            var shown = f.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
            var h = '';

            // Верхняя панель
            h += '<div class="us-row">';
            h += '<button class="selector us-b us-b--p" data-do="refresh">↻ Каталог</button>';
            h += '<button class="selector us-b us-b--s" data-do="check">✓ Проверить</button>';
            h += '<span style="flex:1"></span>';
            h += '<span style="font-size:0.75em;color:rgba(255,255,255,0.3)">' + total + ' плагинов · ' + ext.length + ' установлено</span>';
            h += '</div>';

            // Вкладки (макс 5)
            var cats = {};
            state.all.forEach(function (p) { if (p.status !== 'broken') cats[p.category] = (cats[p.category] || 0) + 1; });
            var catNames = { interface:'Интерфейс', player:'Плеер', catalog:'Каталог', torrent:'Торренты', misc:'Прочее' };
            h += '<div class="us-tabs">';
            h += '<button class="selector us-tab ' + (state.cat === 'all' ? 'us-tab--on' : '') + '" data-cat="all">Все</button>';
            Object.keys(cats).forEach(function (c) {
                h += '<button class="selector us-tab ' + (state.cat === c ? 'us-tab--on' : '') + '" data-cat="' + c + '">' + (catNames[c] || c) + '</button>';
            });
            h += '</div>';

            // Список карточек
            h += '<div class="us-list">';
            shown.forEach(function (p) {
                var inst = isInst(p.script_url);
                var cls = 'us-card selector' + (inst ? ' us-card--in' : '');
                var badge = '';
                if (p.status === 'broken') badge = '<span class="us-card__badge us-card__badge--br">✗</span>';
                else if (inst) badge = '<span class="us-card__badge us-card__badge--ok">✓</span>';
                else badge = '<span class="us-card__badge us-card__badge--old">+</span>';

                h += '<div class="' + cls + '" data-pid="' + p.id + '">';
                h += '<div class="us-card__icon">' + p.icon + '</div>';
                h += '<div class="us-card__info">';
                h += '<div class="us-card__name">' + p.name + '</div>';
                h += '<div class="us-card__author">' + p.author + ' · v' + p.version + '</div>';
                h += '<div class="us-card__desc">' + p.description + '</div>';
                h += '</div>';
                h += badge;
                h += '</div>';
            });
            h += '</div>';

            // Кнопка "Показать ещё"
            if (page < pages - 1) {
                h += '<div class="us-more selector" data-do="more">Показать ещё (' + (total - (page + 1) * PER_PAGE) + ')</div>';
            }

            if (!total) h += '<div class="us-empty">Ничего не найдено</div>';

            el.innerHTML = h;
            self.bind();
            self.start();
        };

        self.bind = function () {
            // Карточки — весь элемент кликабелен
            el.querySelectorAll('.us-card').forEach(function (card) {
                card.addEventListener('hover:enter', function () {
                    var pid = card.getAttribute('data-pid');
                    var p = state.all.find(function (x) { return x.id === pid; });
                    if (!p) return;
                    var inst = isInst(p.script_url);
                    self.showActions(p, inst);
                });
                card.addEventListener('hover:focus', function () {
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                });
            });

            // Вкладки
            el.querySelectorAll('[data-cat]').forEach(function (b) {
                b.addEventListener('hover:enter', function () {
                    state.cat = b.getAttribute('data-cat');
                    state.page = 0;
                    setTimeout(function () { self.render(); }, 50);
                });
            });

            // Показать ещё
            el.querySelectorAll('[data-do="more"]').forEach(function (b) {
                b.addEventListener('hover:enter', function () {
                    state.page++;
                    setTimeout(function () { self.render(); }, 50);
                });
            });

            // Кнопки
            el.querySelectorAll('[data-do="refresh"]').forEach(function (b) {
                b.addEventListener('hover:enter', function () {
                    fetchCatalog(true, function (c) {
                        state.catalog = c; state.all = c.plugins || [];
                        notify('Каталог обновлён');
                        self.render();
                    });
                });
            });

            el.querySelectorAll('[data-do="check"]').forEach(function (b) {
                b.addEventListener('hover:enter', function () {
                    var br = state.all.filter(function (p) { return p.status === 'broken'; }).length;
                    notify(br ? 'Сломанных: ' + br : '✓ Все ок');
                    self.start();
                });
            });
        };

        // Меню действий через Lampa.Select
        self.showActions = function (p, inst) {
            var items = [];
            if (inst) {
                items.push({ title: 'Удалить', action: 'uninstall' });
            } else {
                items.push({ title: 'Установить', action: 'install' });
            }
            items.push({ title: 'Назад', action: 'back' });

            Lampa.Select.show({
                title: p.name,
                items: items.map(function (i) {
                    return {
                        title: i.title,
                        onSelect: function () {
                            if (i.action === 'install') {
                                installPlugin(p, function () { self.render(); });
                            } else if (i.action === 'uninstall') {
                                uninstallPlugin(p, function () { self.render(); });
                            }
                        }
                    };
                })
            });
        };
    }

    // === OPEN ===
    function openStore() {
        Lampa.Activity.push({ url: 'urrowstore', component: 'urrowstore_main', title: 'URROW Store' });
    }

    // === INIT ===
    function init() {
        console.log('[urrowstore] init v=' + getVer());
        try { Lampa.Component.add('urrowstore_main', UrrowStoreComp); } catch (e) {}

        try {
            Lampa.Controller.add('urrowstore', {
                toggle: function () {
                    try {
                        var r = (this.activity && this.activity.render) ? this.activity.render() : null;
                        if (!r) r = document.querySelector('.us');
                        if (r) {
                            Lampa.Controller.collectionSet(r);
                            var f = r.querySelector('.selector');
                            if (f) Lampa.Controller.collectionFocus(f, r);
                        }
                    } catch (e) {}
                },
                move: function (d) { try { Lampa.Controller.move(d); } catch (e) {} },
                enter: function () {
                    try {
                        var f = document.querySelector('.selector.focus');
                        if (f) f.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    } catch (e) {}
                },
                back: function () { try { Lampa.Activity.backward(); } catch (e) {} }
            });
        } catch (e) {}

        try {
            if (Lampa.Head && Lampa.Head.addIcon) {
                Lampa.Head.addIcon('<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" stroke-width="2"/><path d="M7 12h10M12 7v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>', function () { openStore(); });
            }
        } catch (e) {}

        try {
            if (Lampa.Menu && Lampa.Menu.addButton) {
                Lampa.Menu.addButton({ name: 'URROW Store', description: 'Магазин плагинов',
                    icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" stroke-width="2"/><path d="M7 12h10M12 7v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
                    onSelect: openStore });
            }
        } catch (e) {}

        try {
            if (Lampa.SettingsApi) {
                Lampa.SettingsApi.addComponent({ component: 'urrowstore', icon: '📦', name: 'URROW Store' });
                Lampa.SettingsApi.addParam({ component: 'urrowstore', param: { name: 'urrowstore_ver', type: 'static' }, field: { name: 'Версия', description: Lampa.Storage.get('urrowstore_ver', '3.0.0') } });
            }
        } catch (e) {}

        checkUpdate();
        console.log('[urrowstore] ready');
    }

    if (window.appready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') init(); });
})();
