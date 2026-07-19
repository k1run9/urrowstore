/* URROW Store v3.1.0 — Магазин плагинов для Lampa */
(function () {
    'use strict';
    if (window.__urrow_store) return;
    window.__urrow_store = true;
    console.log('[urrowstore] loaded');

    var CATALOG_URL = 'https://k1run9.github.io/urrowstore/plugins.json';
    var VERSION_URL = 'https://k1run9.github.io/urrowstore/version.json';
    var CACHE_KEY = 'urrow_catalog_cache';
    var CACHE_TIME_KEY = 'urrow_catalog_cache_time';
    var CACHE_TTL = 3 * 3600 * 1000;
    var STORE_VERSION = '3.1.0';

    function notify(msg) { try { Lampa.Noty.show(msg); } catch (e) {} }
    function getVer() { try { return parseInt(Lampa.Manifest.version) || 0; } catch (e) { return 0; } }

    function isLampaUrl(url) {
        return typeof url === 'string' && /Lampa\./.test(url);
    }

    // === AUTO-UPDATE ===
    function checkUpdate() {
        try {
            var cur = Lampa.Storage.get('urrowstore_ver', STORE_VERSION);
            var ctrl = new AbortController();
            var t = setTimeout(function () { ctrl.abort(); }, 5000);
            fetch(VERSION_URL + '?t=' + Date.now(), { signal: ctrl.signal })
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    clearTimeout(t);
                    if (d.version && d.version !== cur) {
                        Lampa.Storage.set('urrowstore_ver', d.version);
                        notify('📦 Доступна версия ' + d.version + '. Обновите Lampa.');
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
                } catch (e) {
                    var raw = typeof d === 'string' ? d : '';
                    console.error('[urrowstore] JSON parse error:', e.message, '| response (first 200):', raw.substring(0, 200));
                    cb(cached || { version: '0', plugins: [] });
                }
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

    function activatePluginScript(url, name, cb) {
        try {
            if (document.querySelector('script[data-urrow-plugin="' + url + '"]')) { if (cb) cb(true); return; }
            if (typeof Lampa === 'undefined') { if (cb) cb(false); return; }
            var script = document.createElement('script');
            script.src = url + (url.indexOf('?') > -1 ? '&' : '?') + '_t=' + Date.now();
            script.setAttribute('data-urrow-plugin', url);
            script.onload = function () { console.log('[urrowstore] Активирован:', name); if (cb) cb(true); };
            script.onerror = function () { console.error('[urrowstore] Ошибка:', name); if (cb) cb(false); };
            document.body.appendChild(script);
        } catch (e) { if (cb) cb(false); }
    }

    function installPlugin(p, cb) {
        ensureAgreement();
        try {
            if (!p.url || !isLampaUrl(p.url)) {
                notify('Невалидный URL плагина (требуется Lampa.*): ' + (p.url || ''));
                if (cb) cb();
                return;
            }
            var curVer = getVer();
            var minVer = parseInt(p.min_version) || 0;
            var incompatible = minVer && curVer < minVer;
            if (incompatible) {
                var warnMsg = '⚠ ' + p.name + ': требуется v' + minVer + '+, у вас v' + curVer;
                Lampa.Select.show({
                    title: 'Несовместимость',
                    items: [
                        { title: 'Всё равно установить', onSelect: function () { doInstall(p, cb); } },
                        { title: 'Отмена', onSelect: function () { if (cb) cb(); } }
                    ]
                });
                notify(warnMsg);
                return;
            }
            doInstall(p, cb);
        } catch (e) { notify('Ошибка'); if (cb) cb(); }
    }

    function doInstall(p, cb) {
        try {
            var ext = getExt();
            if (!ext.some(function (e) { return e.url === p.url; })) {
                ext.push({ url: p.url, name: p.name, author: p.author, status: 1 });
                Lampa.Storage.set('plugins', ext);
            }
            activatePluginScript(p.url, p.name, function (ok) {
                notify(ok ? p.name + ' ✓' : p.name + ' (перезагрузите)');
                if (cb) cb();
            });
        } catch (e) { notify('Ошибка'); if (cb) cb(); }
    }

    function uninstallPlugin(p, cb) {
        try {
            Lampa.Storage.set('plugins', getExt().filter(function (e) { return e.url !== p.url; }));
            if (Lampa.Plugins && Lampa.Plugins.remove) Lampa.Plugins.remove({ url: p.url });
            var oldScript = document.querySelector('script[data-urrow-plugin="' + p.url + '"]');
            if (oldScript) oldScript.remove();
            notify(p.name + ' удалён');
            if (cb) cb();
        } catch (e) { if (cb) cb(); }
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
                self.renderList();
            });
            return el;
        };

        self.render = function () { return el; };

        self.start = function () {
            if (!el) return;
            try {
                var zones = el.querySelectorAll('.us-zone');
                if (zones.length) {
                    Lampa.Controller.collectionSet(Array.prototype.slice.call(zones));
                } else {
                    Lampa.Controller.collectionSet(el);
                }
                var first = el.querySelector('.selector');
                if (first) Lampa.Controller.collectionFocus(first, el);
            } catch (e) {}
        };

        self.back = function () { try { Lampa.Activity.backward(); } catch (e) {} };
        self.destroy = function () { el = null; };

        self.filtered = function () {
            return state.all.filter(function (p) {
                return (state.cat === 'all' || p.category === state.cat) && p.enabled !== false;
            });
        };

        self.renderList = function () {
            var f = self.filtered();
            var ext = getExt();
            var page = state.page;
            var PER_PAGE = 20;
            var total = f.length;
            var pages = Math.ceil(total / PER_PAGE);
            var shown = f.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
            var h = '';

            h += '<div class="us-zone us-actions">';
            h += '<button class="selector us-b us-b--p" data-do="refresh">↻ Каталог</button>';
            h += '<button class="selector us-b us-b--s" data-do="check">✓ Проверить</button>';
            h += '<span style="flex:1"></span>';
            h += '<span style="font-size:0.75em;color:rgba(255,255,255,0.3)">' + total + ' плагинов · ' + ext.length + ' установлено</span>';
            h += '</div>';

            var cats = {};
            state.all.forEach(function (p) { if (p.enabled !== false) cats[p.category] = (cats[p.category] || 0) + 1; });
            var catNames = { system:'Система', content:'Контент', online:'Онлайн', ui:'Интерфейс', utility:'Утилиты', ai:'ИИ', music:'Музыка', other:'Прочее' };
            h += '<div class="us-zone us-tabs">';
            h += '<button class="selector us-tab ' + (state.cat === 'all' ? 'us-tab--on' : '') + '" data-cat="all">Все</button>';
            Object.keys(cats).forEach(function (c) {
                h += '<button class="selector us-tab ' + (state.cat === c ? 'us-tab--on' : '') + '" data-cat="' + c + '">' + (catNames[c] || c) + '</button>';
            });
            h += '</div>';

            h += '<div class="us-zone us-list">';
            shown.forEach(function (p) {
                var inst = isInst(p.url);
                var cls = 'us-card selector' + (inst ? ' us-card--in' : '');
                var badge = p.enabled === false ? '<span class="us-card__badge us-card__badge--br">✗</span>'
                    : inst ? '<span class="us-card__badge us-card__badge--ok">✓</span>'
                    : '<span class="us-card__badge us-card__badge--old">+</span>';

                h += '<div class="' + cls + '" data-pid="' + p.id + '">';
                h += '<div class="us-card__info">';
                h += '<div class="us-card__name">' + p.name + '</div>';
                h += '<div class="us-card__desc">' + p.description + '</div>';
                h += '</div>';
                h += badge;
                h += '</div>';
            });
            h += '</div>';

            if (page < pages - 1) h += '<div class="us-more selector" data-do="more">Показать ещё (' + (total - (page + 1) * 20) + ')</div>';
            if (!total) h += '<div class="us-empty">Ничего не найдено</div>';

            if (!el) return;
            el.innerHTML = h;
            self.bind();
            self.start();
        };

        self.bind = function () {
            if (!el) return;
            el.querySelectorAll('.us-card').forEach(function (card) {
                card.addEventListener('hover:enter', function () {
                    var pid = card.getAttribute('data-pid');
                    var p = state.all.find(function (x) { return x.id === pid; });
                    if (p) self.showActions(p, isInst(p.url));
                });
                card.addEventListener('hover:focus', function () {
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                });
            });

            el.querySelectorAll('[data-cat]').forEach(function (b) {
                b.addEventListener('hover:enter', function () {
                    state.cat = b.getAttribute('data-cat');
                    state.page = 0;
                    setTimeout(function () { self.renderList(); }, 50);
                });
            });

            el.querySelectorAll('[data-do="more"]').forEach(function (b) {
                b.addEventListener('hover:enter', function () {
                    state.page++;
                    setTimeout(function () { self.renderList(); }, 50);
                });
            });

            el.querySelectorAll('[data-do="refresh"]').forEach(function (b) {
                b.addEventListener('hover:enter', function () {
                    fetchCatalog(true, function (c) {
                        state.catalog = c; state.all = c.plugins || [];
                        notify('Каталог обновлён');
                        self.renderList();
                    });
                });
            });

            el.querySelectorAll('[data-do="check"]').forEach(function (b) {
                b.addEventListener('hover:enter', function () {
                    var br = state.all.filter(function (p) { return p.enabled === false; }).length;
                    notify(br ? 'Отключённых: ' + br : '✓ Все ок');
                    self.start();
                });
            });
        };

        self.showActions = function (p, inst) {
            var items = inst
                ? [{ title: 'Удалить', onSelect: function () { uninstallPlugin(p, function () { self.renderList(); }); } }]
                : [{ title: 'Установить', onSelect: function () { installPlugin(p, function () { self.renderList(); }); } }];

            Lampa.Select.show({ title: p.name, items: items });
        };
    }

    // === OPEN ===
    var _opening = false;
    function openStore() {
        if (_opening) return;
        _opening = true;
        setTimeout(function () { _opening = false; }, 2000);
        Lampa.Activity.push({ url: 'urrowstore', component: 'urrowstore_main', title: 'URROW Store' });
    }

    // === CSS ===
    function injectCSS() {
        if (document.getElementById('urrow-store-css')) return;
        var s = document.createElement('style');
        s.id = 'urrow-store-css';
        s.textContent = [
            '.us{padding:1em;max-width:900px;margin:0 auto}',
            '.us-zone{margin-bottom:0.5em}',
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
                            var zones = r.querySelectorAll('.us-zone');
                            if (zones.length) {
                                Lampa.Controller.collectionSet(Array.prototype.slice.call(zones));
                            } else {
                                Lampa.Controller.collectionSet(r);
                            }
                            var f = r.querySelector('.selector');
                            if (f) Lampa.Controller.collectionFocus(f, r);
                        }
                    } catch (e) {}
                },
                move: function (d) { try { Lampa.Controller.move(d); } catch (e) {} },
                enter: function () {
                    try {
                        var f = document.querySelector('.selector.focus');
                        if (f) {
                            if (typeof $ !== 'undefined') {
                                $(f).trigger('hover:enter');
                            } else {
                                f.dispatchEvent(new CustomEvent('hover:enter'));
                            }
                        }
                    } catch (e) {}
                },
                back: function () { try { Lampa.Activity.backward(); } catch (e) {} }
            });
        } catch (e) {}

        try {
            if (Lampa.Head && Lampa.Head.addIcon) {
                Lampa.Head.addIcon({
                    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M12 8v8"/></svg>',
                    onSelect: openStore
                });
            }
        } catch (e) {}

        try {
            if (Lampa.Menu && Lampa.Menu.render) {
                var menuSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M12 8v8"/></svg>';
                var menuBtn = $('<li class="menu__item selector"><div class="menu__ico">' + menuSvg + '</div><div class="menu__text">URROW Store</div></li>');
                menuBtn.on('hover:enter', openStore);
                var menuList = Lampa.Menu.render().find('.menu__list');
                if (menuList.length) menuList.eq(0).append(menuBtn);
            }
        } catch (e) {}

        try {
            if (Lampa.SettingsApi) {
                Lampa.SettingsApi.addComponent({ component: 'urrowstore', icon: '📦', name: 'URROW Store' });
                Lampa.SettingsApi.addParam({ component: 'urrowstore', param: { name: 'urrowstore_ver', type: 'static' }, field: { name: 'Версия', description: Lampa.Storage.get('urrowstore_ver', STORE_VERSION) } });
            }
        } catch (e) {}

        checkUpdate();
        console.log('[urrowstore] ready');
    }

    if (window.appready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') init(); });
})();
