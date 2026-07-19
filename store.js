/* URROW Store — Магазин плагинов для Lampa */
(function () {
    'use strict';

    if (window.__urrow_store) return;
    window.__urrow_store = true;

    var CATALOG_URL = 'https://urrow.github.io/urrowstore/plugins.json';
    var STORAGE_KEY = 'urrow_store_installed';
    var STORAGE_CACHE = 'urrow_store_catalog_cache';
    var STORAGE_CACHE_TIME = 'urrow_store_cache_time';
    var CACHE_TTL = 3600000;

    function waitForLampa(callback) {
        if (window.Lampa && Lampa.Manifest) callback();
        else setTimeout(function () { waitForLampa(callback); }, 100);
    }

    waitForLampa(function () {

        function getStorage(name, def) {
            try { return Lampa.Storage.get(name, def); }
            catch (e) { return def; }
        }

        function setStorage(name, val) {
            try { Lampa.Storage.set(name, val); } catch (e) {}
        }

        function getInstalled() {
            return getStorage(STORAGE_KEY, {});
        }

        function saveInstalled(data) {
            setStorage(STORAGE_KEY, data);
        }

        function fetchCatalog(callback) {
            var now = Date.now();
            var cacheTime = getStorage(STORAGE_CACHE_TIME, 0);
            var cached = getStorage(STORAGE_CACHE, null);

            if (cached && (now - cacheTime) < CACHE_TTL) {
                callback(cached);
                return;
            }

            var req = new Lampa.Reguest();
            req.timeout = 15000;

            req.silent(CATALOG_URL, function (data) {
                try {
                    if (typeof data === 'string') data = JSON.parse(data);
                    setStorage(STORAGE_CACHE, data);
                    setStorage(STORAGE_CACHE_TIME, Date.now());
                    callback(data);
                } catch (e) {
                    callback(cached || { plugins: [], version: '0.0.0' });
                }
            }, function () {
                callback(cached || { plugins: [], version: '0.0.0' });
            });
        }

        function verifyPlugin(url, callback) {
            var req = new Lampa.Reguest();
            req.timeout = 10000;

            req.silent(url, function (text) {
                var valid = typeof text === 'string' && text.indexOf('Lampa.') !== -1;
                callback(valid);
            }, function () {
                callback(false);
            });
        }

        function notify(msg) {
            if (Lampa.Noty) {
                Lampa.Noty.show(msg);
            }
        }

        function askReload() {
            if (Lampa.Utils && Lampa.Utils.showReload) {
                Lampa.Utils.showReload();
            }
        }

        function isInstalled(pluginId) {
            var installed = getInstalled();
            return !!installed[pluginId];
        }

        function getInstalledStatus(pluginId) {
            var installed = getInstalled();
            return installed[pluginId] || null;
        }

        function installPlugin(plugin) {
            var installed = getInstalled();
            installed[plugin.id] = {
                id: plugin.id,
                name: plugin.name,
                url: plugin.url,
                version: plugin.version,
                icon: plugin.icon,
                enabled: true,
                installed_at: Date.now()
            };
            saveInstalled(installed);

            try {
                Lampa.Plugins.push({
                    url: plugin.url,
                    name: plugin.name,
                    author: plugin.author || 'Unknown'
                });
            } catch (e) {}

            notify(plugin.icon + ' ' + plugin.name + ' установлен');
            setTimeout(askReload, 1500);
        }

        function uninstallPlugin(plugin) {
            var installed = getInstalled();
            delete installed[plugin.id];
            saveInstalled(installed);
            notify(plugin.icon + ' ' + plugin.name + ' удалён');
            setTimeout(askReload, 1500);
        }

        function togglePlugin(pluginId) {
            var installed = getInstalled();
            if (installed[pluginId]) {
                installed[pluginId].enabled = !installed[pluginId].enabled;
                saveInstalled(installed);
                var status = installed[pluginId].enabled ? 'включён' : 'выключен';
                notify(status);
            }
        }

        function checkUpdates(callback) {
            fetchCatalog(function (catalog) {
                var installed = getInstalled();
                var updates = [];

                catalog.plugins.forEach(function (p) {
                    if (installed[p.id] && installed[p.id].version !== p.version) {
                        updates.push(p);
                    }
                });

                updates.forEach(function (p) {
                    installed[p.id].version = p.version;
                    installed[p.id].url = p.url;
                });

                if (updates.length) saveInstalled(installed);
                if (callback) callback(updates);
            });
        }

        function cleanupBroken(callback) {
            var installed = getInstalled();
            var keys = Object.keys(installed);
            var broken = [];
            var checked = 0;

            if (!keys.length) {
                if (callback) callback(broken);
                return;
            }

            keys.forEach(function (key) {
                var plugin = installed[key];
                verifyPlugin(plugin.url, function (valid) {
                    checked++;
                    if (!valid) broken.push(plugin);
                    if (checked === keys.length) {
                        broken.forEach(function (p) {
                            delete installed[p.id];
                        });
                        if (broken.length) saveInstalled(installed);
                        if (callback) callback(broken);
                    }
                });
            });
        }

        /* ===== CSS ===== */
        function injectStyles() {
            if (document.getElementById('urrow-store-css')) return;
            var style = document.createElement('style');
            style.id = 'urrow-store-css';
            style.textContent = [
                '.urrow-store{padding:20px;max-width:1200px;margin:0 auto;font-family:inherit}',
                '.urrow-store__header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.08)}',
                '.urrow-store__title{font-size:24px;font-weight:700;color:#fff;display:flex;align-items:center;gap:10px}',
                '.urrow-store__title-icon{font-size:28px}',
                '.urrow-store__version{font-size:12px;color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:4px}',
                '.urrow-store__actions{display:flex;gap:8px}',
                '.urrow-store__btn{padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:600;transition:all .2s;display:flex;align-items:center;gap:6px}',
                '.urrow-store__btn--primary{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}',
                '.urrow-store__btn--primary:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(102,126,234,0.4)}',
                '.urrow-store__btn--secondary{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.8)}',
                '.urrow-store__btn--secondary:hover{background:rgba(255,255,255,0.12)}',
                '.urrow-store__categories{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}',
                '.urrow-store__cat{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);background:transparent}',
                '.urrow-store__cat--active{background:linear-gradient(135deg,#667eea,#764ba2);border-color:transparent;color:#fff}',
                '.urrow-store__cat:hover{border-color:rgba(102,126,234,0.5);color:#fff}',
                '.urrow-store__section-title{font-size:15px;font-weight:700;color:rgba(255,255,255,0.9);margin:20px 0 12px;display:flex;align-items:center;gap:8px}',
                '.urrow-store__section-count{font-size:11px;background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:10px;color:rgba(255,255,255,0.5)}',
                '.urrow-store__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}',
                '.urrow-store__card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;transition:all .2s;cursor:pointer}',
                '.urrow-store__card:hover{background:rgba(255,255,255,0.07);border-color:rgba(102,126,234,0.3);transform:translateY(-2px)}',
                '.urrow-store__card--installed{border-color:rgba(102,126,234,0.25);background:rgba(102,126,234,0.05)}',
                '.urrow-store__card-top{display:flex;align-items:flex-start;gap:12px}',
                '.urrow-store__card-icon{font-size:32px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.06);border-radius:10px;flex-shrink:0}',
                '.urrow-store__card-info{flex:1;min-width:0}',
                '.urrow-store__card-name{font-size:15px;font-weight:700;color:#fff;margin-bottom:2px}',
                '.urrow-store__card-author{font-size:11px;color:rgba(255,255,255,0.4)}',
                '.urrow-store__card-desc{font-size:12px;color:rgba(255,255,255,0.55);margin-top:6px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
                '.urrow-store__card-bottom{display:flex;align-items:center;justify-content:space-between;margin-top:12px}',
                '.urrow-store__card-tags{display:flex;gap:4px;flex-wrap:wrap}',
                '.urrow-store__tag{font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.4)}',
                '.urrow-store__card-version{font-size:10px;color:rgba(255,255,255,0.3)}',
                '.urrow-store__card-actions{display:flex;gap:6px;margin-top:10px}',
                '.urrow-store__install-btn{padding:6px 14px;border-radius:6px;border:none;cursor:pointer;font-size:12px;font-weight:600;transition:all .2s}',
                '.urrow-store__install-btn--install{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}',
                '.urrow-store__install-btn--install:hover{box-shadow:0 2px 8px rgba(102,126,234,0.4)}',
                '.urrow-store__install-btn--remove{background:rgba(231,76,60,0.15);color:#e74c3c}',
                '.urrow-store__install-btn--remove:hover{background:rgba(231,76,60,0.25)}',
                '.urrow-store__install-btn--toggle{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7)}',
                '.urrow-store__install-btn--toggle:hover{background:rgba(255,255,255,0.12)}',
                '.urrow-store__install-btn--update{background:rgba(241,196,15,0.15);color:#f1c40f}',
                '.urrow-store__install-btn--update:hover{background:rgba(241,196,15,0.25)}',
                '.urrow-store__status{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 8px;border-radius:4px;font-weight:600}',
                '.urrow-store__status--installed{background:rgba(46,204,113,0.15);color:#2ecc71}',
                '.urrow-store__status--available{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.4)}',
                '.urrow-store__status--update{background:rgba(241,196,15,0.15);color:#f1c40f}',
                '.urrow-store__loading{text-align:center;padding:60px 20px;color:rgba(255,255,255,0.4)}',
                '.urrow-store__loading-spinner{display:inline-block;width:32px;height:32px;border:3px solid rgba(255,255,255,0.1);border-top-color:#667eea;border-radius:50%;animation:urrow-spin .8s linear infinite;margin-bottom:12px}',
                '@keyframes urrow-spin{to{transform:rotate(360deg)}}',
                '.urrow-store__empty{text-align:center;padding:40px;color:rgba(255,255,255,0.3)}',
                '.urrow-store__empty-icon{font-size:48px;margin-bottom:12px}',
                '.urrow-store__search{position:relative;margin-bottom:16px}',
                '.urrow-store__search input{width:100%;padding:10px 14px 10px 36px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:13px;outline:none;transition:border-color .2s}',
                '.urrow-store__search input:focus{border-color:rgba(102,126,234,0.5)}',
                '.urrow-store__search input::placeholder{color:rgba(255,255,255,0.3)}',
                '.urrow-store__search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.3);font-size:14px}',
                '.urrow-store__stats{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap}',
                '.urrow-store__stat{font-size:12px;color:rgba(255,255,255,0.4);display:flex;align-items:center;gap:4px}',
                '.urrow-store__stat-value{color:rgba(255,255,255,0.7);font-weight:700}'
            ].join('');
            document.head.appendChild(style);
        }

        /* ===== UI ===== */
        function renderStore() {
            var container = document.createElement('div');
            container.className = 'urrow-store';
            container.innerHTML = '<div class="urrow-store__loading"><div class="urrow-store__loading-spinner"></div><div>Загрузка магазина...</div></div>';

            injectStyles();

            fetchCatalog(function (catalog) {
                var installed = getInstalled();
                var allPlugins = catalog.plugins || [];
                var activeCategory = 'all';
                var searchQuery = '';

                function getFiltered() {
                    return allPlugins.filter(function (p) {
                        var matchCategory = activeCategory === 'all' || p.category === activeCategory;
                        var matchSearch = !searchQuery || p.name.toLowerCase().indexOf(searchQuery) !== -1 || p.description.toLowerCase().indexOf(searchQuery) !== -1 || (p.tags || []).join(' ').toLowerCase().indexOf(searchQuery) !== -1;
                        return matchCategory && matchSearch;
                    });
                }

                function getCategories() {
                    var cats = {};
                    allPlugins.forEach(function (p) {
                        cats[p.category] = (cats[p.category] || 0) + 1;
                    });
                    return cats;
                }

                function getCategoryName(cat) {
                    var names = {
                        system: '⚙️ Системные',
                        online: '🎬 Онлайн',
                        content: '📂 Контент',
                        iptv: '📺 IPTV',
                        ui: '🎨 Интерфейс',
                        utility: '🔧 Утилиты',
                        other: '📦 Прочее'
                    };
                    return names[cat] || cat;
                }

                function render() {
                    var filtered = getFiltered();
                    var categories = getCategories();
                    var installedCount = Object.keys(installed).length;

                    var html = '';

                    html += '<div class="urrow-store__header">';
                    html += '<div class="urrow-store__title"><span class="urrow-store__title-icon">📦</span> URROW Store <span class="urrow-store__version">v' + catalog.version + '</span></div>';
                    html += '<div class="urrow-store__actions">';
                    html += '<button class="urrow-store__btn urrow-store__btn--secondary" data-action="cleanup">🔍 Проверить</button>';
                    html += '<button class="urrow-store__btn urrow-store__btn--secondary" data-action="updates">🔄 Обновить всё</button>';
                    html += '<button class="urrow-store__btn urrow-store__btn--primary" data-action="refresh">↻ Обновить каталог</button>';
                    html += '</div>';
                    html += '</div>';

                    html += '<div class="urrow-store__stats">';
                    html += '<div class="urrow-store__stat">Всего: <span class="urrow-store__stat-value">' + allPlugins.length + '</span></div>';
                    html += '<div class="urrow-store__stat">Установлено: <span class="urrow-store__stat-value">' + installedCount + '</span></div>';
                    html += '<div class="urrow-store__stat">Доступно: <span class="urrow-store__stat-value">' + (allPlugins.length - installedCount) + '</span></div>';
                    html += '</div>';

                    html += '<div class="urrow-store__search">';
                    html += '<span class="urrow-store__search-icon">🔍</span>';
                    html += '<input type="text" placeholder="Поиск плагинов..." data-action="search" value="' + searchQuery + '">';
                    html += '</div>';

                    html += '<div class="urrow-store__categories">';
                    html += '<button class="urrow-store__cat ' + (activeCategory === 'all' ? 'urrow-store__cat--active' : '') + '" data-cat="all">Все</button>';
                    Object.keys(categories).forEach(function (cat) {
                        html += '<button class="urrow-store__cat ' + (activeCategory === cat ? 'urrow-store__cat--active' : '') + '" data-cat="' + cat + '">' + getCategoryName(cat) + ' (' + categories[cat] + ')</button>';
                    });
                    html += '</div>';

                    var installedPlugins = [];
                    var availablePlugins = [];

                    filtered.forEach(function (p) {
                        if (isInstalled(p.id)) {
                            installedPlugins.push(p);
                        } else {
                            availablePlugins.push(p);
                        }
                    });

                    if (installedPlugins.length) {
                        html += '<div class="urrow-store__section-title">Установленные <span class="urrow-store__section-count">' + installedPlugins.length + '</span></div>';
                        html += '<div class="urrow-store__grid">';
                        installedPlugins.forEach(function (p) { html += renderCard(p, true); });
                        html += '</div>';
                    }

                    if (availablePlugins.length) {
                        html += '<div class="urrow-store__section-title">Доступные <span class="urrow-store__section-count">' + availablePlugins.length + '</span></div>';
                        html += '<div class="urrow-store__grid">';
                        availablePlugins.forEach(function (p) { html += renderCard(p, false); });
                        html += '</div>';
                    }

                    if (!filtered.length) {
                        html += '<div class="urrow-store__empty">';
                        html += '<div class="urrow-store__empty-icon">🔍</div>';
                        html += '<div>Ничего не найдено</div>';
                        html += '</div>';
                    }

                    container.innerHTML = html;
                    bindEvents();
                }

                function renderCard(plugin, installed) {
                    var status = getInstalledStatus(plugin.id);
                    var hasUpdate = status && status.version !== plugin.version;
                    var cardClass = 'urrow-store__card' + (installed ? ' urrow-store__card--installed' : '');

                    var html = '<div class="' + cardClass + '" data-plugin-id="' + plugin.id + '">';
                    html += '<div class="urrow-store__card-top">';
                    html += '<div class="urrow-store__card-icon">' + plugin.icon + '</div>';
                    html += '<div class="urrow-store__card-info">';
                    html += '<div class="urrow-store__card-name">' + plugin.name + '</div>';
                    html += '<div class="urrow-store__card-author">by ' + plugin.author + '</div>';
                    html += '</div>';

                    if (installed) {
                        if (hasUpdate) {
                            html += '<span class="urrow-store__status urrow-store__status--update">⚡ Обновление</span>';
                        } else {
                            html += '<span class="urrow-store__status urrow-store__status--installed">✓ Установлен</span>';
                        }
                    } else {
                        html += '<span class="urrow-store__status urrow-store__status--available">Доступен</span>';
                    }

                    html += '</div>';
                    html += '<div class="urrow-store__card-desc">' + plugin.description + '</div>';

                    html += '<div class="urrow-store__card-actions">';
                    if (installed) {
                        html += '<button class="urrow-store__install-btn urrow-store__install-btn--remove" data-action="uninstall" data-id="' + plugin.id + '">Удалить</button>';
                        html += '<button class="urrow-store__install-btn urrow-store__install-btn--toggle" data-action="toggle" data-id="' + plugin.id + '">' + (status && status.enabled ? 'Выключить' : 'Включить') + '</button>';
                        if (hasUpdate) {
                            html += '<button class="urrow-store__install-btn urrow-store__install-btn--update" data-action="update" data-id="' + plugin.id + '">Обновить</button>';
                        }
                    } else {
                        html += '<button class="urrow-store__install-btn urrow-store__install-btn--install" data-action="install" data-id="' + plugin.id + '">Установить</button>';
                    }
                    html += '</div>';

                    html += '<div class="urrow-store__card-bottom">';
                    html += '<div class="urrow-store__card-tags">';
                    (plugin.tags || []).forEach(function (tag) {
                        html += '<span class="urrow-store__tag">' + tag + '</span>';
                    });
                    html += '</div>';
                    html += '<div class="urrow-store__card-version">v' + plugin.version + '</div>';
                    html += '</div>';

                    html += '</div>';
                    return html;
                }

                function findPlugin(id) {
                    return allPlugins.find(function (p) { return p.id === id; });
                }

                function bindEvents() {
                    container.querySelectorAll('[data-cat]').forEach(function (btn) {
                        btn.addEventListener('click', function () {
                            activeCategory = btn.getAttribute('data-cat');
                            render();
                        });
                    });

                    container.querySelectorAll('[data-action="install"]').forEach(function (btn) {
                        btn.addEventListener('click', function (e) {
                            e.stopPropagation();
                            var plugin = findPlugin(btn.getAttribute('data-id'));
                            if (plugin) installPlugin(plugin);
                        });
                    });

                    container.querySelectorAll('[data-action="uninstall"]').forEach(function (btn) {
                        btn.addEventListener('click', function (e) {
                            e.stopPropagation();
                            var plugin = findPlugin(btn.getAttribute('data-id'));
                            if (plugin) uninstallPlugin(plugin);
                        });
                    });

                    container.querySelectorAll('[data-action="toggle"]').forEach(function (btn) {
                        btn.addEventListener('click', function (e) {
                            e.stopPropagation();
                            togglePlugin(btn.getAttribute('data-id'));
                            render();
                        });
                    });

                    container.querySelectorAll('[data-action="update"]').forEach(function (btn) {
                        btn.addEventListener('click', function (e) {
                            e.stopPropagation();
                            var plugin = findPlugin(btn.getAttribute('data-id'));
                            if (plugin) installPlugin(plugin);
                        });
                    });

                    container.querySelectorAll('[data-action="refresh"]').forEach(function (btn) {
                        btn.addEventListener('click', function () {
                            setStorage(STORAGE_CACHE_TIME, 0);
                            notify('🔄 Каталог обновлён');
                            render();
                        });
                    });

                    container.querySelectorAll('[data-action="updates"]').forEach(function (btn) {
                        btn.addEventListener('click', function () {
                            btn.textContent = '⏳ Проверка...';
                            btn.disabled = true;
                            checkUpdates(function (updates) {
                                if (updates.length) {
                                    notify('✅ Обновлено плагинов: ' + updates.length);
                                } else {
                                    notify('✓ Все плагины актуальны');
                                }
                                btn.textContent = '🔄 Обновить всё';
                                btn.disabled = false;
                                render();
                            });
                        });
                    });

                    container.querySelectorAll('[data-action="cleanup"]').forEach(function (btn) {
                        btn.addEventListener('click', function () {
                            btn.textContent = '⏳ Проверка...';
                            btn.disabled = true;
                            cleanupBroken(function (broken) {
                                if (broken.length) {
                                    notify('🗑 Удалено нерабочих: ' + broken.length);
                                } else {
                                    notify('✓ Все плагины работоспособны');
                                }
                                btn.textContent = '🔍 Проверить';
                                btn.disabled = false;
                                render();
                            });
                        });
                    });

                    var searchInput = container.querySelector('[data-action="search"]');
                    if (searchInput) {
                        var searchTimeout;
                        searchInput.addEventListener('input', function () {
                            clearTimeout(searchTimeout);
                            searchTimeout = setTimeout(function () {
                                searchQuery = searchInput.value.toLowerCase().trim();
                                render();
                            }, 300);
                        });
                    }
                }

                render();
            });

            return container;
        }

        /* ===== Activity ===== */
        function createStoreActivity() {
            return renderStore();
        }

        /* ===== Registration ===== */
        Lampa.Manifest.plugin = {
            type: 'other',
            version: '1.0.0',
            name: 'URROW Store',
            description: 'Магазин плагинов для Lampa',
            component: 'urrow_store'
        };

        if (Lampa.Component) {
            Lampa.Component.add('urrow_store', createStoreActivity);
        }

        if (Lampa.Menu && Lampa.Menu.addButton) {
            Lampa.Menu.addButton({
                name: 'URROW Store',
                description: 'Магазин плагинов',
                icon: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="2"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
                onSelect: function () {
                    Lampa.Activity.push({
                        url: 'urrowstore',
                        component: 'urrow_store',
                        title: 'URROW Store'
                    });
                }
            });
        }

        if (Lampa.SettingsApi) {
            Lampa.SettingsApi.addComponent({
                component: 'urrow_store',
                name: 'URROW Store',
                icon: '📦'
            });

            Lampa.SettingsApi.addParam({
                component: 'urrow_store',
                param: { name: 'urrow_auto_update', type: 'trigger', default: true },
                field: { name: 'Авто-обновление плагинов' }
            });

            Lampa.SettingsApi.addParam({
                component: 'urrow_store',
                param: { name: 'urrow_auto_cleanup', type: 'trigger', default: false },
                field: { name: 'Автоудаление нерабочих плагинов' }
            });
        }

        setTimeout(function () {
            var autoUpdate = getStorage('urrow_auto_update', true);
            if (autoUpdate) {
                checkUpdates(function (updates) {
                    if (updates.length) {
                        notify('📦 URROW Store: доступно обновлений — ' + updates.length);
                    }
                });
            }
        }, 5000);

        console.log('[URROW Store] loaded');
    });
})();
