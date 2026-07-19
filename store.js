/* URROW Store — Магазин плагинов для Lampa */
(function () {
    'use strict';

    if (window.__urrow_store) return;
    window.__urrow_store = true;

    var CATALOG_URL = 'https://k1run9.github.io/urrowstore/plugins.json';
    var STORAGE_KEY = 'urrow_store_installed';
    var STORAGE_CACHE = 'urrow_store_catalog_cache';
    var STORAGE_CACHE_TIME = 'urrow_store_cache_time';
    var CACHE_TTL = 3600000;

    function waitForLampa(cb) {
        if (window.Lampa && Lampa.Manifest && Lampa.Activity) cb();
        else setTimeout(function () { waitForLampa(cb); }, 100);
    }

    waitForLampa(function () {

        function gs(name, def) {
            try { return Lampa.Storage.get(name, def); } catch (e) { return def; }
        }
        function ss(name, val) {
            try { Lampa.Storage.set(name, val); } catch (e) {}
        }
        function getInstalled() { return gs(STORAGE_KEY, {}); }
        function saveInstalled(d) { ss(STORAGE_KEY, d); }
        function isInstalled(id) { return !!getInstalled()[id]; }
        function getStatus(id) { return getInstalled()[id] || null; }

        function notify(msg) {
            if (Lampa.Noty) Lampa.Noty.show(msg);
        }
        function askReload() {
            if (Lampa.Utils && Lampa.Utils.showReload) Lampa.Utils.showReload();
        }

        /* ===== Fetch Catalog ===== */
        function fetchCatalog(cb) {
            var now = Date.now();
            var cacheTime = gs(STORAGE_CACHE_TIME, 0);
            var cached = gs(STORAGE_CACHE, null);
            if (cached && (now - cacheTime) < CACHE_TTL) { cb(cached); return; }
            var req = new Lampa.Reguest();
            req.timeout = 15000;
            req.silent(CATALOG_URL, function (data) {
                try {
                    if (typeof data === 'string') data = JSON.parse(data);
                    ss(STORAGE_CACHE, data);
                    ss(STORAGE_CACHE_TIME, Date.now());
                    cb(data);
                } catch (e) { cb(cached || { plugins: [], version: '0.0.0' }); }
            }, function () { cb(cached || { plugins: [], version: '0.0.0' }); });
        }

        /* ===== Plugin Actions ===== */
        function installPlugin(plugin, renderCb) {
            var installed = getInstalled();
            installed[plugin.id] = {
                id: plugin.id, name: plugin.name, url: plugin.url,
                version: plugin.version, icon: plugin.icon,
                enabled: true, installed_at: Date.now()
            };
            saveInstalled(installed);

            try {
                var all = Lampa.Storage.get('plugins', []);
                if (!Array.isArray(all)) all = [];
                var exists = all.some(function (p) { return p.url === plugin.url; });
                if (!exists) {
                    all.push({ url: plugin.url, name: plugin.name, author: plugin.author || 'Unknown', status: 1 });
                    Lampa.Storage.set('plugins', all);
                }

                if (Lampa.Utils && Lampa.Utils.putScriptAsync) {
                    Lampa.Utils.putScriptAsync([plugin.url], function () {
                        notify(plugin.icon + ' ' + plugin.name + ' установлен и загружен');
                    }, function (url) {
                        notify('⚠️ Ошибка загрузки: ' + plugin.name);
                    }, function (url) {
                        notify(plugin.icon + ' ' + plugin.name + ' загружен');
                    });
                }
            } catch (e) {
                notify(plugin.icon + ' ' + plugin.name + ' добавлен в список');
            }

            if (renderCb) setTimeout(renderCb, 300);
        }

        function uninstallPlugin(plugin, renderCb) {
            var installed = getInstalled();
            delete installed[plugin.id];
            saveInstalled(installed);

            try {
                var all = Lampa.Storage.get('plugins', []);
                if (!Array.isArray(all)) all = [];
                all = all.filter(function (p) { return p.url !== plugin.url; });
                Lampa.Storage.set('plugins', all);
            } catch (e) {}

            notify(plugin.icon + ' ' + plugin.name + ' удалён');
            if (renderCb) setTimeout(renderCb, 300);
        }

        function togglePlugin(pluginId, renderCb) {
            var installed = getInstalled();
            if (installed[pluginId]) {
                installed[pluginId].enabled = !installed[pluginId].enabled;
                saveInstalled(installed);

                try {
                    var all = Lampa.Storage.get('plugins', []);
                    if (!Array.isArray(all)) all = [];
                    all.forEach(function (p) {
                        if (p.url === installed[pluginId].url) {
                            p.status = installed[pluginId].enabled ? 1 : 0;
                        }
                    });
                    Lampa.Storage.set('plugins', all);
                } catch (e) {}

                notify(installed[pluginId].enabled ? 'Включён' : 'Выключен');
            }
            if (renderCb) setTimeout(renderCb, 300);
        }

        function checkUpdates(cb) {
            fetchCatalog(function (catalog) {
                var installed = getInstalled();
                var updates = [];
                catalog.plugins.forEach(function (p) {
                    if (installed[p.id] && installed[p.id].version !== p.version) {
                        installed[p.id].version = p.version;
                        installed[p.id].url = p.url;
                        updates.push(p);
                    }
                });
                if (updates.length) saveInstalled(installed);
                if (cb) cb(updates);
            });
        }

        function cleanupBroken(cb) {
            var installed = getInstalled();
            var keys = Object.keys(installed);
            if (!keys.length) { if (cb) cb([]); return; }
            var broken = [], checked = 0;
            keys.forEach(function (key) {
                var req = new Lampa.Reguest();
                req.timeout = 8000;
                req.silent(installed[key].url, function (text) {
                    if (typeof text !== 'string' || text.indexOf('Lampa.') === -1) broken.push(installed[key]);
                    checkDone();
                }, function () { broken.push(installed[key]); checkDone(); });
                function checkDone() {
                    checked++;
                    if (checked === keys.length) {
                        broken.forEach(function (p) { delete installed[p.id]; });
                        if (broken.length) saveInstalled(installed);
                        if (cb) cb(broken);
                    }
                }
            });
        }

        /* ===== CSS ===== */
        function injectStyles() {
            if (document.getElementById('urrow-store-css')) return;
            var s = document.createElement('style');
            s.id = 'urrow-store-css';
            s.textContent = [
                '.urrow-store{padding:1.5em;max-width:1200px;margin:0 auto}',
                '.urrow-store__header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5em;padding-bottom:1em;border-bottom:1px solid rgba(255,255,255,0.08)}',
                '.urrow-store__title{font-size:1.6em;font-weight:700;color:#fff;display:flex;align-items:center;gap:0.5em}',
                '.urrow-store__ver{font-size:0.6em;color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.06);padding:0.15em 0.5em;border-radius:0.25em}',
                '.urrow-store__actions{display:flex;gap:0.5em}',
                '.urrow-store__btn{padding:0.5em 1em;border-radius:0.5em;border:none;cursor:pointer;font-size:0.85em;font-weight:600;transition:all .2s;display:flex;align-items:center;gap:0.4em;color:#fff}',
                '.urrow-store__btn--p{background:linear-gradient(135deg,#667eea,#764ba2)}',
                '.urrow-store__btn--s{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.8)}',
                '.urrow-store__stats{display:flex;gap:1em;margin-bottom:1.2em;flex-wrap:wrap}',
                '.urrow-store__stat{font-size:0.8em;color:rgba(255,255,255,0.4)}',
                '.urrow-store__stat b{color:rgba(255,255,255,0.7)}',
                '.urrow-store__search{position:relative;margin-bottom:1em}',
                '.urrow-store__search input{width:100%;padding:0.7em 1em 0.7em 2.5em;border-radius:0.5em;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:0.85em;outline:none}',
                '.urrow-store__search input:focus{border-color:rgba(102,126,234,0.5)}',
                '.urrow-store__search-icon{position:absolute;left:0.8em;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.3)}',
                '.urrow-store__cats{display:flex;gap:0.4em;margin-bottom:1.2em;flex-wrap:wrap}',
                '.urrow-store__cat{padding:0.35em 0.8em;border-radius:1.2em;font-size:0.75em;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);background:transparent;transition:all .2s}',
                '.urrow-store__cat--on{background:linear-gradient(135deg,#667eea,#764ba2);border-color:transparent;color:#fff}',
                '.urrow-store__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(20em,1fr));gap:0.7em}',
                '.urrow-store__card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:0.7em;padding:1em;transition:all .2s}',
                '.urrow-store__card--in{border-color:rgba(102,126,234,0.25);background:rgba(102,126,234,0.05)}',
                '.urrow-store__top{display:flex;align-items:flex-start;gap:0.7em}',
                '.urrow-store__icon{font-size:2em;width:2.5em;height:2.5em;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.06);border-radius:0.6em;flex-shrink:0}',
                '.urrow-store__info{flex:1;min-width:0}',
                '.urrow-store__name{font-size:0.95em;font-weight:700;color:#fff;margin-bottom:0.1em}',
                '.urrow-store__author{font-size:0.7em;color:rgba(255,255,255,0.4)}',
                '.urrow-store__desc{font-size:0.75em;color:rgba(255,255,255,0.55);margin-top:0.4em;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
                '.urrow-store__actions-row{display:flex;gap:0.35em;margin-top:0.7em}',
                '.urrow-store__abtn{padding:0.35em 0.8em;border-radius:0.35em;border:none;cursor:pointer;font-size:0.75em;font-weight:600;transition:all .2s;color:#fff}',
                '.urrow-store__abtn--i{background:linear-gradient(135deg,#667eea,#764ba2)}',
                '.urrow-store__abtn--r{background:rgba(231,76,60,0.15);color:#e74c3c}',
                '.urrow-store__abtn--t{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7)}',
                '.urrow-store__abtn--u{background:rgba(241,196,15,0.15);color:#f1c40f}',
                '.urrow-store__badge{display:inline-flex;align-items:center;gap:0.25em;font-size:0.7em;padding:0.15em 0.5em;border-radius:0.25em;font-weight:600}',
                '.urrow-store__badge--ok{background:rgba(46,204,113,0.15);color:#2ecc71}',
                '.urrow-store__badge--av{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.4)}',
                '.urrow-store__badge--up{background:rgba(241,196,15,0.15);color:#f1c40f}',
                '.urrow-store__sec{font-size:0.9em;font-weight:700;color:rgba(255,255,255,0.9);margin:1.2em 0 0.7em;display:flex;align-items:center;gap:0.5em}',
                '.urrow-store__cnt{font-size:0.7em;background:rgba(255,255,255,0.1);padding:0.15em 0.5em;border-radius:0.6em;color:rgba(255,255,255,0.5)}',
                '.urrow-store__tags{display:flex;gap:0.2em;flex-wrap:wrap}',
                '.urrow-store__tag{font-size:0.65em;padding:0.1em 0.35em;border-radius:0.2em;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.4)}',
                '.urrow-store__bottom{display:flex;align-items:center;justify-content:space-between;margin-top:0.7em}',
                '.urrow-store__ver-tag{font-size:0.65em;color:rgba(255,255,255,0.3)}',
                '.urrow-store__empty{text-align:center;padding:3em;color:rgba(255,255,255,0.3)}',
                '.urrow-store__loading{text-align:center;padding:4em;color:rgba(255,255,255,0.4)}',
                '.urrow-store__spin{display:inline-block;width:2em;height:2em;border:3px solid rgba(255,255,255,0.1);border-top-color:#667eea;border-radius:50%;animation:uspin .8s linear infinite;margin-bottom:0.8em}',
                '@keyframes uspin{to{transform:rotate(360deg)}}'
            ].join('');
            document.head.appendChild(s);
        }

        /* ===== Build Store UI ===== */
        function renderStore(onReady) {
            var el = document.createElement('div');
            el.className = 'urrow-store';
            el.innerHTML = '<div class="urrow-store__loading"><div class="urrow-store__spin"></div><div>Загрузка...</div></div>';
            injectStyles();

            fetchCatalog(function (catalog) {
                var installed = getInstalled();
                var all = catalog.plugins || [];
                var cat = 'all';
                var query = '';

                function filtered() {
                    return all.filter(function (p) {
                        var mc = cat === 'all' || p.category === cat;
                        var ms = !query || p.name.toLowerCase().indexOf(query) !== -1 || p.description.toLowerCase().indexOf(query) !== -1 || (p.tags || []).join(' ').indexOf(query) !== -1;
                        return mc && ms;
                    });
                }
                function cats() {
                    var c = {};
                    all.forEach(function (p) { c[p.category] = (c[p.category] || 0) + 1; });
                    return c;
                }
                function catName(c) {
                    return { system:'⚙️ Системные', online:'🎬 Онлайн', content:'📂 Контент', iptv:'📺 IPTV', ui:'🎨 Интерфейс', utility:'🔧 Утилиты', ai:'🤖 AI', music:'🎵 Музыка', other:'📦 Прочее' }[c] || c;
                }
                function findP(id) { return all.find(function (p) { return p.id === id; }); }

                function render() {
                    var f = filtered();
                    var cs = cats();
                    var ic = Object.keys(installed).length;
                    var h = '';

                    h += '<div class="urrow-store__header">';
                    h += '<div class="urrow-store__title">📦 URROW Store <span class="urrow-store__ver">v' + catalog.version + '</span></div>';
                    h += '<div class="urrow-store__actions">';
                    h += '<button class="selector urrow-store__btn urrow-store__btn--s" data-do="check">🔍 Проверить</button>';
                    h += '<button class="selector urrow-store__btn urrow-store__btn--s" data-do="upall">🔄 Обновить всё</button>';
                    h += '<button class="selector urrow-store__btn urrow-store__btn--p" data-do="refresh">↻ Обновить каталог</button>';
                    h += '</div></div>';

                    h += '<div class="urrow-store__stats">';
                    h += '<div class="urrow-store__stat">Всего: <b>' + all.length + '</b></div>';
                    h += '<div class="urrow-store__stat">Установлено: <b>' + ic + '</b></div>';
                    h += '<div class="urrow-store__stat">Доступно: <b>' + (all.length - ic) + '</b></div>';
                    h += '</div>';

                    h += '<div class="urrow-store__search"><span class="urrow-store__search-icon">🔍</span>';
                    h += '<input class="selector" type="text" placeholder="Поиск плагинов..." data-do="search" value="' + query + '"></div>';

                    h += '<div class="urrow-store__cats">';
                    h += '<button class="selector urrow-store__cat ' + (cat === 'all' ? 'urrow-store__cat--on' : '') + '" data-cat="all">Все</button>';
                    Object.keys(cs).forEach(function (c) {
                        h += '<button class="selector urrow-store__cat ' + (cat === c ? 'urrow-store__cat--on' : '') + '" data-cat="' + c + '">' + catName(c) + ' (' + cs[c] + ')</button>';
                    });
                    h += '</div>';

                    var ip = [], ap = [];
                    f.forEach(function (p) { (isInstalled(p.id) ? ip : ap).push(p); });

                    if (ip.length) {
                        h += '<div class="urrow-store__sec">Установленные <span class="urrow-store__cnt">' + ip.length + '</span></div>';
                        h += '<div class="urrow-store__grid">';
                        ip.forEach(function (p) { h += card(p, true); });
                        h += '</div>';
                    }
                    if (ap.length) {
                        h += '<div class="urrow-store__sec">Доступные <span class="urrow-store__cnt">' + ap.length + '</span></div>';
                        h += '<div class="urrow-store__grid">';
                        ap.forEach(function (p) { h += card(p, false); });
                        h += '</div>';
                    }
                    if (!f.length) {
                        h += '<div class="urrow-store__empty">🔍 Ничего не найдено</div>';
                    }

                    el.innerHTML = h;
                    bind();
                }

                function card(p, inst) {
                    var st = getStatus(p.id);
                    var upd = st && st.version !== p.version;
                    var cls = 'urrow-store__card' + (inst ? ' urrow-store__card--in' : '');

                    var s = '<div class="' + cls + '" data-pid="' + p.id + '">';
                    s += '<div class="urrow-store__top">';
                    s += '<div class="urrow-store__icon">' + p.icon + '</div>';
                    s += '<div class="urrow-store__info">';
                    s += '<div class="urrow-store__name">' + p.name + '</div>';
                    s += '<div class="urrow-store__author">by ' + p.author + '</div>';
                    s += '</div>';
                    if (inst) {
                        s += upd ? '<span class="urrow-store__badge urrow-store__badge--up">⚡ Обновление</span>' : '<span class="urrow-store__badge urrow-store__badge--ok">✓ Установлен</span>';
                    } else {
                        s += '<span class="urrow-store__badge urrow-store__badge--av">Доступен</span>';
                    }
                    s += '</div>';
                    s += '<div class="urrow-store__desc">' + p.description + '</div>';
                    s += '<div class="urrow-store__actions-row">';
                    if (inst) {
                        s += '<button class="selector urrow-store__abtn urrow-store__abtn--r" data-do="uninstall" data-id="' + p.id + '">Удалить</button>';
                        s += '<button class="selector urrow-store__abtn urrow-store__abtn--t" data-do="toggle" data-id="' + p.id + '">' + (st && st.enabled ? 'Выкл' : 'Вкл') + '</button>';
                        if (upd) s += '<button class="selector urrow-store__abtn urrow-store__abtn--u" data-do="update" data-id="' + p.id + '">Обновить</button>';
                    } else {
                        s += '<button class="selector urrow-store__abtn urrow-store__abtn--i" data-do="install" data-id="' + p.id + '">Установить</button>';
                    }
                    s += '</div>';
                    s += '<div class="urrow-store__bottom">';
                    s += '<div class="urrow-store__tags">';
                    (p.tags || []).forEach(function (t) { s += '<span class="urrow-store__tag">' + t + '</span>'; });
                    s += '</div>';
                    s += '<span class="urrow-store__ver-tag">v' + p.version + '</span>';
                    s += '</div></div>';
                    return s;
                }

                function bind() {
                    el.querySelectorAll('[data-cat]').forEach(function (b) {
                        b.onclick = function () { cat = b.getAttribute('data-cat'); render(); };
                    });

                    el.querySelectorAll('[data-do="install"]').forEach(function (b) {
                        b.onclick = function (e) { e.stopPropagation(); var p = findP(b.getAttribute('data-id')); if (p) installPlugin(p, render); };
                    });
                    el.querySelectorAll('[data-do="uninstall"]').forEach(function (b) {
                        b.onclick = function (e) { e.stopPropagation(); var p = findP(b.getAttribute('data-id')); if (p) uninstallPlugin(p, render); };
                    });
                    el.querySelectorAll('[data-do="toggle"]').forEach(function (b) {
                        b.onclick = function (e) { e.stopPropagation(); togglePlugin(b.getAttribute('data-id'), render); };
                    });
                    el.querySelectorAll('[data-do="update"]').forEach(function (b) {
                        b.onclick = function (e) { e.stopPropagation(); var p = findP(b.getAttribute('data-id')); if (p) installPlugin(p, render); };
                    });
                    el.querySelectorAll('[data-do="refresh"]').forEach(function (b) {
                        b.onclick = function () { ss(STORAGE_CACHE_TIME, 0); notify('🔄 Каталог обновлён'); render(); };
                    });
                    el.querySelectorAll('[data-do="upall"]').forEach(function (b) {
                        b.onclick = function () {
                            b.textContent = '⏳ Проверка...';
                            checkUpdates(function (u) {
                                notify(u.length ? '✅ Обновлено: ' + u.length : '✓ Все актуальны');
                                b.textContent = '🔄 Обновить всё';
                                render();
                            });
                        };
                    });
                    el.querySelectorAll('[data-do="check"]').forEach(function (b) {
                        b.onclick = function () {
                            b.textContent = '⏳ Проверка...';
                            cleanupBroken(function (br) {
                                notify(br.length ? '🗑 Нерабочих: ' + br.length : '✓ Все работают');
                                b.textContent = '🔍 Проверить';
                                render();
                            });
                        };
                    });

                    var si = el.querySelector('[data-do="search"]');
                    if (si) {
                        var st;
                        si.oninput = function () { clearTimeout(st); st = setTimeout(function () { query = si.value.toLowerCase().trim(); render(); }, 300); };
                    }

                    if (onReady) onReady(el);
                }

                render();
            });

            return el;
        }

        /* ===== Activity Component ===== */
        function UrrowStoreComponent(object) {
            var self = this;
            var el = null;

            self.create = function () {
                el = renderStore(function () {
                    self.start();
                });
            };

            self.render = function () { return el; };

            self.start = function () {
                if (!el) return;
                Lampa.Controller.collectionSet(el);
                var first = el.querySelector('.selector');
                if (first) Lampa.Controller.collectionFocus(first, el);
            };

            self.back = function () {
                Lampa.Activity.backward();
            };

            self.destroy = function () { el = null; };
        }

        /* ===== Open Store ===== */
        function openStore() {
            Lampa.Activity.push({
                url: 'urrowstore',
                component: 'urrow_store',
                title: 'URROW Store'
            });
        }

        /* ===== Header Button ===== */
        function addHeaderButton() {
            if (Lampa.Head && Lampa.Head.addIcon) {
                Lampa.Head.addIcon(
                    '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="2"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
                    function () { openStore(); }
                );
            }
        }

        /* ===== Register ===== */
        Lampa.Manifest.plugin = { type: 'other', version: '1.0.0', name: 'URROW Store', description: 'Магазин плагинов', component: 'urrow_store' };

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

        if (Lampa.SettingsApi) {
            Lampa.SettingsApi.addComponent({ component: 'urrow_store', name: 'URROW Store', icon: '📦' });
            Lampa.SettingsApi.addParam({ component: 'urrow_store', param: { name: 'urrow_auto_update', type: 'trigger', default: true }, field: { name: 'Авто-обновление' } });
        }

        setTimeout(function () {
            if (gs('urrow_auto_update', true)) {
                checkUpdates(function (u) { if (u.length) notify('📦 Доступно обновлений: ' + u.length); });
            }
        }, 5000);

        console.log('[URROW Store] loaded');
    });
})();
