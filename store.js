/* URROW Store v2.1 — Магазин плагинов для Lampa (TV Remote Ready) */
(function () {
    'use strict';

    if (window.__urrow_store) return;
    window.__urrow_store = true;

    var CATALOG_URL = 'https://k1run9.github.io/urrowstore/catalog.json';
    var CACHE_KEY = 'urrow_catalog_cache';
    var CACHE_TIME_KEY = 'urrow_catalog_cache_time';
    var CACHE_TTL = 3 * 3600 * 1000;

    function waitForLampa(cb) {
        if (window.Lampa && Lampa.Manifest && Lampa.Activity && Lampa.Storage && Lampa.Controller) cb();
        else setTimeout(function () { waitForLampa(cb); }, 100);
    }

    waitForLampa(function () {

        function notify(msg) { if (Lampa.Noty) Lampa.Noty.show(msg); }

        // === CATALOG ===
        function fetchCatalog(force, cb) {
            var now = Date.now();
            var ct = parseInt(Lampa.Storage.get(CACHE_TIME_KEY, '0')) || 0;
            var cached = Lampa.Storage.get(CACHE_KEY, null);
            if (!force && cached && (now - ct) < CACHE_TTL) { cb(cached); return; }
            var req = new Lampa.Reguest();
            req.timeout = 15000;
            req.silent(CATALOG_URL, function (d) {
                try {
                    if (typeof d === 'string') d = JSON.parse(d);
                    Lampa.Storage.set(CACHE_KEY, d);
                    Lampa.Storage.set(CACHE_TIME_KEY, String(now));
                    cb(d);
                } catch (e) { cb(cached || { version: '0.0.0', plugins: [] }); }
            }, function () { cb(cached || { version: '0.0.0', plugins: [] }); });
        }

        // === VERSION CHECK ===
        function getLampaVersion() {
            try {
                if (Lampa.Manifest && Lampa.Manifest.version) return parseInt(Lampa.Manifest.version) || 0;
                var sc = document.querySelectorAll('script[src*="app.min.js"]');
                for (var i = 0; i < sc.length; i++) { var m = sc[i].src.match(/v=(\d+)/); if (m) return parseInt(m[1]); }
            } catch (e) {}
            return 0;
        }

        function checkCompat(p) {
            var cur = getLampaVersion(), mn = parseInt(p.min_lampa_version) || 0, mx = parseInt(p.max_lampa_version) || 0;
            if (mn && cur && cur < mn) return 'outdated';
            if (mx && cur && cur > mx) return 'unstable';
            return 'ok';
        }

        // === EXTENSIONS ===
        function getExt() {
            try { var e = Lampa.Storage.get('extensions', []); return Array.isArray(e) ? e : []; }
            catch (x) { return []; }
        }

        function isInst(url) { return getExt().some(function (e) { return e.url === url; }); }

        function installPlugin(p, cb) {
            try {
                var ext = getExt();
                if (!ext.some(function (e) { return e.url === p.script_url; })) {
                    ext.push({ url: p.script_url, name: p.name, author: p.author, enabled: 1, status: 1 });
                    Lampa.Storage.set('extensions', ext);
                }
                if (Lampa.Utils && Lampa.Utils.putScriptAsync) {
                    Lampa.Utils.putScriptAsync([p.script_url], function () { notify(p.name + ' ✓'); if (cb) cb(); }, function () { notify(p.name + ' добавлен'); if (cb) cb(); });
                } else {
                    var s = document.createElement('script'); s.src = p.script_url; document.body.appendChild(s);
                    notify(p.name + ' ✓'); if (cb) cb();
                }
            } catch (e) { notify('Ошибка'); if (cb) cb(); }
        }

        function uninstallPlugin(p, cb) {
            try {
                var ext = getExt().filter(function (e) { return e.url !== p.script_url; });
                Lampa.Storage.set('extensions', ext);
                notify(p.name + ' удалён');
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
                '.us-b{padding:0.5em 1em;border-radius:0.5em;border:2px solid transparent;cursor:pointer;font-size:0.85em;font-weight:600;color:#fff;transition:all .15s}',
                '.us-b--p{background:linear-gradient(135deg,#667eea,#764ba2)}',
                '.us-b--s{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.8)}',
                '.us-b.selector:focus,.us-b.selector.hover{border-color:#667eea;box-shadow:0 0 12px rgba(102,126,234,0.5);transform:scale(1.05)}',
                '.us-stats{display:flex;gap:1em;margin-bottom:1.2em;flex-wrap:wrap}',
                '.us-stat{font-size:0.8em;color:rgba(255,255,255,0.4)}',
                '.us-stat b{color:rgba(255,255,255,0.7)}',
                '.us-search{position:relative;margin-bottom:1em}',
                '.us-search input{width:100%;padding:0.7em 1em 0.7em 2.5em;border-radius:0.5em;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:0.85em;outline:none;transition:border-color .2s}',
                '.us-search input:focus{border-color:#667eea}',
                '.us-si{position:absolute;left:0.8em;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.3)}',
                '.us-cats{display:flex;gap:0.4em;margin-bottom:1.2em;flex-wrap:wrap}',
                '.us-cat{padding:0.35em 0.8em;border-radius:1.2em;font-size:0.75em;font-weight:600;cursor:pointer;border:2px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);background:transparent;transition:all .15s}',
                '.us-cat--on{background:linear-gradient(135deg,#667eea,#764ba2);border-color:transparent;color:#fff}',
                '.us-cat.selector:focus,.us-cat.selector.hover{border-color:#667eea;color:#fff}',
                '.us-list{display:flex;flex-direction:column;gap:0.5em}',
                '.us-card{background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.06);border-radius:0.7em;padding:1em;transition:all .15s;cursor:pointer}',
                '.us-card.selector:focus,.us-card.selector.hover{border-color:#667eea;background:rgba(102,126,234,0.08);box-shadow:0 0 16px rgba(102,126,234,0.3)}',
                '.us-card--in{border-color:rgba(46,204,113,0.2);background:rgba(46,204,113,0.04)}',
                '.us-card--in.selector:focus,.us-card--in.selector.hover{border-color:#2ecc71;box-shadow:0 0 16px rgba(46,204,113,0.3)}',
                '.us-top{display:flex;align-items:flex-start;gap:0.7em}',
                '.us-info{flex:1;min-width:0}',
                '.us-name{font-size:0.95em;font-weight:700;color:#fff}',
                '.us-author{font-size:0.7em;color:rgba(255,255,255,0.4)}',
                '.us-desc{font-size:0.75em;color:rgba(255,255,255,0.55);margin-top:0.4em;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
                '.us-row{display:flex;gap:0.35em;margin-top:0.7em;flex-wrap:wrap;align-items:center}',
                '.us-ab{padding:0.4em 0.9em;border-radius:0.35em;border:2px solid transparent;cursor:pointer;font-size:0.75em;font-weight:600;color:#fff;transition:all .15s}',
                '.us-ab.selector:focus,.us-ab.selector.hover{transform:scale(1.05);box-shadow:0 0 8px rgba(102,126,234,0.4)}',
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
                '.us-confirm__btn{padding:0.5em 1.5em;border-radius:0.5em;border:2px solid transparent;cursor:pointer;font-size:0.85em;font-weight:600;transition:all .15s}',
                '.us-confirm__btn.selector:focus,.us-confirm__btn.selector.hover{transform:scale(1.05);box-shadow:0 0 12px rgba(102,126,234,0.4)}',
                '.us-confirm__btn--yes{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}',
                '.us-confirm__btn--no{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7)}'
            ].join('');
            document.head.appendChild(s);
        }

        // === HELPERS ===
        function stars(r) {
            if (!r || !r.count) return '';
            var f = Math.floor(r.average), h = r.average - f >= 0.5 ? 1 : 0, e = 5 - f - h;
            var s = ''; for (var i = 0; i < f; i++) s += '★'; for (var i = 0; i < h; i++) s += '½'; for (var i = 0; i < e; i++) s += '☆';
            return '<span class="us-stars">' + s + '</span> <span style="font-size:0.7em;color:rgba(255,255,255,0.4)">' + r.average.toFixed(1) + ' (' + r.count + ')</span>';
        }

        function badge(p) {
            var c = checkCompat(p);
            if (p.status === 'broken') return '<span class="us-badge us-badge--br">✗ Сломан</span>';
            if (p.status === 'deprecated') return '<span class="us-badge us-badge--dep">Устарел</span>';
            if (c === 'outdated') return '<span class="us-badge us-badge--old">⚠ Требуется обновление Lampa</span>';
            if (c === 'unstable') return '<span class="us-badge us-badge--old">⚠ Может не работать</span>';
            return '<span class="us-badge us-badge--ok">✓ Активен</span>';
        }

        function catName(c) {
            return { interface:'🎨 Интерфейс', player:'▶️ Плеер', catalog:'📂 Каталог', torrent:'🎯 Торренты', misc:'🔧 Прочее' }[c] || c;
        }

        // === CONFIRM DIALOG ===
        function confirm(msg, cb) {
            var overlay = document.createElement('div');
            overlay.className = 'us-confirm';
            overlay.innerHTML = '<div class="us-confirm__box"><div class="us-confirm__title">Подтверждение</div><div class="us-confirm__text">' + msg + '</div><div class="us-confirm__btns"><button class="selector us-confirm__btn us-confirm__btn--yes" data-c="yes">Да</button><button class="selector us-confirm__btn us-confirm__btn--no" data-c="no">Нет</button></div></div>';
            document.body.appendChild(overlay);

            Lampa.Controller.collectionSet(overlay);
            var yesBtn = overlay.querySelector('[data-c="yes"]');
            var noBtn = overlay.querySelector('[data-c="no"]');
            Lampa.Controller.collectionFocus(yesBtn, overlay);

            yesBtn.addEventListener('hover:enter', function () { overlay.remove(); cb(true); });
            noBtn.addEventListener('hover:enter', function () { overlay.remove(); cb(false); });
            yesBtn.addEventListener('click', function () { overlay.remove(); cb(true); });
            noBtn.addEventListener('click', function () { overlay.remove(); cb(false); });

            overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.remove(); cb(false); } });
        }

        // === SCROLL TO FOCUSED ===
        function scrollTo(el, target) {
            if (!target) return;
            var raf = window.requestAnimationFrame || function (cb) { setTimeout(cb, 16); };
            raf(function () {
                try {
                    var root = el;
                    var rect = target.getBoundingClientRect();
                    var rootRect = root.getBoundingClientRect();
                    if (rect.top < rootRect.top || rect.bottom > rootRect.bottom) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                } catch (e) {}
            });
        }

        // === MAIN RENDER ===
        function renderStore(onReady) {
            var el = document.createElement('div');
            el.className = 'us';
            el.innerHTML = '<div class="us-load"><div class="us-spin"></div><div>Загрузка каталога...</div></div>';
            injectStyles();

            fetchCatalog(false, function (catalog) {
                var all = catalog.plugins || [];
                var cat = 'all';
                var query = '';
                var lastFocused = null;

                function getInst() { return getExt(); }
                function isI(p) { return getInst().some(function (e) { return e.url === p.script_url; }); }
                function findP(id) { return all.find(function (p) { return p.id === id; }); }

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

                function render() {
                    var f = filtered();
                    var cs = cats();
                    var ic = getInst().length;
                    var h = '';

                    h += '<div class="us-hdr">';
                    h += '<div class="us-title">📦 URROW Store <span class="us-ver">v' + catalog.version + '</span></div>';
                    h += '<div class="us-btns">';
                    h += '<button class="selector us-b us-b--s" data-do="check">🔍 Проверить</button>';
                    h += '<button class="selector us-b us-b--s" data-do="upall">🔄 Обновить всё</button>';
                    h += '<button class="selector us-b us-b--p" data-do="refresh">↻ Обновить каталог</button>';
                    h += '</div></div>';

                    h += '<div class="us-stats">';
                    h += '<div class="us-stat">Всего: <b>' + all.length + '</b></div>';
                    h += '<div class="us-stat">Установлено: <b>' + ic + '</b></div>';
                    h += '<div class="us-stat">Активных: <b>' + all.filter(function (p) { return p.status === 'active'; }).length + '</b></div>';
                    h += '</div>';

                    h += '<div class="us-search"><span class="us-si">🔍</span>';
                    h += '<input class="selector" type="text" placeholder="Поиск..." data-do="search" value="' + query + '"></div>';

                    h += '<div class="us-cats">';
                    h += '<button class="selector us-cat ' + (cat === 'all' ? 'us-cat--on' : '') + '" data-cat="all">Все (' + all.length + ')</button>';
                    Object.keys(cs).forEach(function (c) {
                        h += '<button class="selector us-cat ' + (cat === c ? 'us-cat--on' : '') + '" data-cat="' + c + '">' + catName(c) + ' (' + cs[c] + ')</button>';
                    });
                    h += '</div>';

                    // Список (не сетка — для пульта)
                    h += '<div class="us-list">';
                    f.forEach(function (p) { h += card(p); });
                    h += '</div>';

                    if (!f.length) h += '<div class="us-empty">🔍 Ничего не найдено</div>';

                    el.innerHTML = h;
                    bind();
                }

                function card(p) {
                    var inst = isI(p);
                    var cls = 'us-card selector' + (inst ? ' us-card--in' : '');
                    var compat = checkCompat(p);
                    var canInst = p.status === 'active' && compat !== 'outdated';

                    var s = '<div class="' + cls + '" data-pid="' + p.id + '" tabindex="0">';
                    s += '<div class="us-top">';
                    s += '<div class="us-info">';
                    s += '<div class="us-name">' + p.name + '</div>';
                    s += '<div class="us-author">by ' + p.author + '</div>';
                    s += '</div>';
                    s += badge(p);
                    if (p.rating && p.rating.count) s += stars(p.rating);
                    s += '</div>';
                    s += '<div class="us-desc">' + p.description + '</div>';
                    s += '<div class="us-row">';
                    if (inst) {
                        s += '<button class="selector us-ab us-ab--r" data-do="uninstall" data-id="' + p.id + '">Удалить</button>';
                    } else if (canInst) {
                        s += '<button class="selector us-ab us-ab--i" data-do="install" data-id="' + p.id + '">Установить</button>';
                    } else if (compat === 'outdated') {
                        s += '<button class="selector us-ab us-ab--u" data-do="install-force" data-id="' + p.id + '">Установить (форс)</button>';
                    }
                    s += '</div>';
                    s += '<div class="us-bottom">';
                    s += '<div class="us-tags"><span class="us-tag">' + catName(p.category) + '</span>';
                    if (p.downloads) s += '<span class="us-tag">⬇ ' + p.downloads + '</span>';
                    s += '</div>';
                    s += '<span class="us-vtag">v' + p.version + '</span>';
                    s += '</div></div>';
                    return s;
                }

                function bind() {
                    // hover:enter для карточек (пульт ОК)
                    el.querySelectorAll('.us-card').forEach(function (card) {
                        card.addEventListener('hover:enter', function () {
                            var pid = card.getAttribute('data-pid');
                            var p = findP(pid);
                            if (!p) return;
                            if (isI(p)) {
                                confirm('Удалить ' + p.name + '?', function (yes) {
                                    if (yes) uninstallPlugin(p, render);
                                });
                            } else {
                                var compat = checkCompat(p);
                                if (p.status === 'active' && compat !== 'outdated') {
                                    confirm('Установить ' + p.name + '?', function (yes) {
                                        if (yes) installPlugin(p, render);
                                    });
                                } else if (compat === 'outdated') {
                                    confirm('Плагин может не работать. Установить?', function (yes) {
                                        if (yes) installPlugin(p, render);
                                    });
                                }
                            }
                        });
                        card.addEventListener('hover:focus', function () {
                            lastFocused = card;
                        });
                    });

                    // hover:enter для кнопок установки/удаления
                    el.querySelectorAll('[data-do="install"]').forEach(function (b) {
                        b.addEventListener('hover:enter', function (e) {
                            e.stopPropagation();
                            var p = findP(b.getAttribute('data-id'));
                            if (p) confirm('Установить ' + p.name + '?', function (yes) { if (yes) installPlugin(p, render); });
                        });
                    });
                    el.querySelectorAll('[data-do="install-force"]').forEach(function (b) {
                        b.addEventListener('hover:enter', function (e) {
                            e.stopPropagation();
                            var p = findP(b.getAttribute('data-id'));
                            if (p) confirm('Установить (форс)?', function (yes) { if (yes) installPlugin(p, render); });
                        });
                    });
                    el.querySelectorAll('[data-do="uninstall"]').forEach(function (b) {
                        b.addEventListener('hover:enter', function (e) {
                            e.stopPropagation();
                            var p = findP(b.getAttribute('data-id'));
                            if (p) confirm('Удалить ' + p.name + '?', function (yes) { if (yes) uninstallPlugin(p, render); });
                        });
                    });

                    // Категории
                    el.querySelectorAll('[data-cat]').forEach(function (b) {
                        b.addEventListener('hover:enter', function () { cat = b.getAttribute('data-cat'); render(); });
                    });

                    // Кнопки в шапке
                    el.querySelectorAll('[data-do="refresh"]').forEach(function (b) {
                        b.addEventListener('hover:enter', function () {
                            fetchCatalog(true, function (nc) {
                                catalog = nc; all = catalog.plugins || [];
                                notify('🔄 Каталог обновлён');
                                render();
                            });
                        });
                    });

                    el.querySelectorAll('[data-do="check"]').forEach(function (b) {
                        b.addEventListener('hover:enter', function () {
                            var br = all.filter(function (p) { return p.status === 'broken'; });
                            var od = all.filter(function (p) { return checkCompat(p) === 'outdated'; });
                            var msg = '✓ Все плагины в порядке';
                            if (br.length) msg = '✗ Сломанных: ' + br.length;
                            if (od.length) msg += ' | Устаревших: ' + od.length;
                            notify(msg);
                        });
                    });

                    el.querySelectorAll('[data-do="upall"]').forEach(function (b) {
                        b.addEventListener('hover:enter', function () {
                            var updatable = all.filter(function (p) { return p.status === 'active' && checkCompat(p) === 'ok' && !isI(p); });
                            if (!updatable.length) { notify('✓ Нет доступных обновлений'); return; }
                            confirm('Обновить все плагины (' + updatable.length + ')?', function (yes) {
                                if (yes) {
                                    var i = 0;
                                    function next() {
                                        if (i >= updatable.length) { notify('✓ Готово'); render(); return; }
                                        installPlugin(updatable[i], function () { i++; next(); });
                                    }
                                    next();
                                }
                            });
                        });
                    });

                    // Поиск
                    var si = el.querySelector('[data-do="search"]');
                    if (si) {
                        var st;
                        si.oninput = function () { clearTimeout(st); st = setTimeout(function () { query = si.value.toLowerCase().trim(); render(); }, 200); };
                    }

                    // Восстанавливаем фокус после re-render
                    if (lastFocused) {
                        var pid = lastFocused.getAttribute('data-pid');
                        if (pid) {
                            var newCard = el.querySelector('[data-pid="' + pid + '"]');
                            if (newCard) {
                                Lampa.Controller.collectionSet(el);
                                Lampa.Controller.collectionFocus(newCard, el);
                                return;
                            }
                        }
                    }

                    if (onReady) onReady(el);
                }

                render();
            });

            return el;
        }

        // === COMPONENT ===
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

        // === OPEN ===
        function openStore() {
            Lampa.Activity.push({ url: 'urrowstore', component: 'urrow_store', title: 'URROW Store' });
        }

        // === HEADER ===
        function addHeaderButton() {
            if (Lampa.Head && Lampa.Head.addIcon) {
                Lampa.Head.addIcon(
                    '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="2"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
                    function () { openStore(); }
                );
            }
        }

        // === REGISTER ===
        Lampa.Manifest.plugin = { type: 'other', version: '2.1.0', name: 'URROW Store', description: 'Динамический магазин плагинов', component: 'urrow_store' };
        if (Lampa.Component) Lampa.Component.add('urrow_store', UrrowStoreComponent);
        addHeaderButton();
        if (Lampa.Menu && Lampa.Menu.addButton) {
            Lampa.Menu.addButton({
                name: 'URROW Store', description: 'Магазин плагинов',
                icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="2"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
                onSelect: openStore
            });
        }

        console.log('[URROW Store v2.1] loaded');
    });
})();
