#!/usr/bin/env node
// === СКРИПТ СБОРКИ КАТАЛОГА ПЛАГИНОВ ===
// Читает sources.json, проверяет каждый плагин, генерирует catalog.json (схема: url/enabled/min_version)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CATALOG_PATH = path.join(__dirname, 'catalog.json');
const SOURCES_PATH = path.join(__dirname, 'sources.json');
const PLUGINS_PATH = path.join(__dirname, 'plugins.json');
const CHANGELOG_PATH = path.join(__dirname, 'CHANGELOG.md');
const RATINGS_PATH = path.join(__dirname, 'ratings.json');

// === ЗАГРУЗКА ДАННЫХ ===
function loadJSON(filepath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch (e) {
        return fallback;
    }
}

function saveJSON(filepath, data) {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

// === ПРОВЕРКА ПЛАГИНА ===
async function checkPlugin(source, prevCatalog) {
    const prev = prevCatalog.find(p => p.id === source.id) || {};
    const result = {
        id: source.id,
        name: source.name,
        description: source.description,
        author: source.author,
        url: source.script_url,
        version: prev.version || '1.0.0',
        min_version: source.min_version || '3.0.0',
        category: source.category || 'other',
        enabled: true,
        checksum: prev.checksum || '',
        last_checked: new Date().toISOString()
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(source.script_url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
            result.enabled = false;
            console.log(`  ✗ ${source.id}: HTTP ${response.status}`);
            return result;
        }

        const text = await response.text();
        const normalized = text
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const newChecksum = crypto.createHash('sha256').update(normalized).digest('hex');

        // Проверка на валидность Lampa плагина (должен содержать "Lampa.")
        if (!/Lampa\./.test(text) && text.indexOf('window.Lampa') === -1) {
            result.enabled = false;
            console.log(`  ⚠ ${source.id}: не похоже на Lampa плагин (нет "Lampa.")`);
            return result;
        }

        // Если был отключён, но теперь содержит Lampa. — восстанавливаем
        if (prev.enabled === false) {
            result.enabled = true;
            console.log(`  ↩ ${source.id}: восстановлен disabled → enabled`);
        }

        // Если чексумма изменилась — увеличиваем patch версию
        if (prev.checksum && prev.checksum !== newChecksum) {
            const parts = result.version.split('.');
            parts[2] = parseInt(parts[2] || 0) + 1;
            result.version = parts.join('.');
            console.log(`  ↑ ${source.id}: обновлён v${result.version}`);
        }

        result.checksum = newChecksum;
        console.log(`  ✓ ${source.id}: OK v${result.version}`);

    } catch (e) {
        result.enabled = false;
        console.log(`  ✗ ${source.id}: ${e.message}`);
    }

    return result;
}

// === ГЕНЕРАЦИЯ CHANGELOG ===
function updateChangelog(prevCatalog, newCatalog) {
    const lines = [`# CHANGELOG\n\n## ${new Date().toISOString().slice(0, 10)}\n\n`];
    let hasChanges = false;

    newCatalog.forEach(p => {
        const prev = prevCatalog.find(x => x.id === p.id);
        if (!prev) {
            lines.push(`- + **${p.name}** (${p.id}) — новый плагин\n`);
            hasChanges = true;
        } else if (prev.enabled !== p.enabled) {
            lines.push(`- ! **${p.name}** (${p.id}): ${prev.enabled ? 'enabled' : 'disabled'} → ${p.enabled ? 'enabled' : 'disabled'}\n`);
            hasChanges = true;
        } else if (prev.version !== p.version) {
            lines.push(`- ↑ **${p.name}** (${p.id}): v${prev.version} → v${p.version}\n`);
            hasChanges = true;
        }
    });

    if (!hasChanges) {
        lines.push('Изменений нет.\n');
    }

    const existing = fs.existsSync(CHANGELOG_PATH) ? fs.readFileSync(CHANGELOG_PATH, 'utf8') : '';
    fs.writeFileSync(CHANGELOG_PATH, lines.join('') + '\n' + existing, 'utf8');
}

// === MAIN ===
async function main() {
    console.log('=== URROW Store: сборка каталога ===\n');

    const sources = loadJSON(SOURCES_PATH, []);
    const prevCatalog = loadJSON(CATALOG_PATH, { version: '1.0.0', updated: '', plugins: [] });
    const ratings = loadJSON(RATINGS_PATH, {});

    console.log(`Источников: ${sources.length}`);
    console.log(`Предыдущий каталог: ${prevCatalog.plugins.length} плагинов\n`);

    const newPlugins = [];

    for (const source of sources) {
        if (!source.id || !source.name || !source.script_url) {
            console.error(`  ✗ SKIP: missing required field(s) — ${JSON.stringify({id: source.id, name: source.name, script_url: source.script_url})}`);
            continue;
        }
        const plugin = await checkPlugin(source, prevCatalog.plugins);
        // Восстанавливаем рейтинг из ratings.json
        if (ratings[plugin.id]) {
            plugin.rating = ratings[plugin.id];
        }
        newPlugins.push(plugin);
    }

    const newCatalog = {
        version: prevCatalog.version,
        updated: new Date().toISOString(),
        plugins: newPlugins
    };

    // Обновляем CHANGELOG
    updateChangelog(prevCatalog.plugins, newPlugins);

    // Сохраняем каталог
    saveJSON(CATALOG_PATH, newCatalog);
    console.log(`\nКаталог сохранён: ${newPlugins.length} плагинов`);

    const broken = newPlugins.filter(p => p.enabled === false);
    if (broken.length) {
        console.log(`\n⚠ Отключённые плагины: ${broken.map(p => p.id).join(', ')}`);
    }
}

main().catch(e => {
    console.error('Ошибка:', e);
    process.exit(1);
});
