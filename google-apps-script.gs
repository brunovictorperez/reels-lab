/**
 * ============================================================================
 * REELS LAB — CONECTOR GRATUITO PARA GOOGLE DRIVE (Google Apps Script)
 * ============================================================================
 * Como instalar em 2 minutos (100% gratuito na sua conta Google):
 * 1. Acesse https://script.google.com e clique em "Novo projeto".
 * 2. Apague o código inicial e cole TODO este arquivo.
 * 3. Clique em Salvar (ícone de disquete).
 * 4. Clique em "Implantar" -> "Nova implantação".
 * 5. Tipo: "App da Web" | Executar como: "Eu" | Quem pode acessar: "Qualquer pessoa".
 * 6. Autorize o acesso ao seu Google Drive e copie a "URL do app da Web".
 * 7. Cole essa URL dentro do Reels Lab em "Conectar Google Drive".
 * ============================================================================
 */

var ROOT_FOLDER_NAME = 'Reels Lab - Studio';
var BACKUP_FILE_NAME = 'reels-lab-database.json';
var PROFILES_FOLDER_NAME = '_perfis';

/**
 * Execute esta função UMA VEZ no editor do Apps Script (botão ▶ Executar)
 * para liberar a permissão de buscar notícias reais no Google Notícias (UrlFetchApp).
 */
function autorizarGoogleNoticias() {
  var testUrl = 'https://news.google.com/rss/headlines/section/topic/NATION?hl=pt-BR&gl=BR&ceid=BR:pt';
  var res = UrlFetchApp.fetch(testUrl, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  var code = res.getResponseCode();
  var items = code >= 200 && code < 300 ? parseRssXmlGAS_(res.getContentText('UTF-8'), 'Brasil', 'brasil', 5) : [];
  Logger.log('HTTP ' + code + ' | Noticias lidas: ' + items.length);
  return 'OK (' + items.length + ' notícias)';
}

function decodeGasEntities_(str) {
  return String(str || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssXmlGAS_(xml, fallbackLabel, categoryId, maxItems) {
  var out = [];
  if (!xml) return out;
  try {
    var doc = XmlService.parse(xml);
    var channel = doc.getRootElement().getChild('channel');
    if (channel) {
      var items = channel.getChildren('item');
      for (var i = 0; i < Math.min(items.length, maxItems); i++) {
        var item = items[i];
        var rawTitle = item.getChildText('title') || '';
        var link = item.getChildText('link') || '';
        var pubDate = item.getChildText('pubDate') || '';
        var desc = decodeGasEntities_(item.getChildText('description') || '');
        var srcEl = item.getChild('source');
        var inferredSrc = rawTitle.match(/\s+-\s+([^-]+)$/);
        var sourceName = (srcEl && srcEl.getText()) ? srcEl.getText() : (inferredSrc ? inferredSrc[1] : fallbackLabel);
        var cleanTitle = decodeGasEntities_(rawTitle.replace(/\s+-\s+[^-]+$/, '').trim() || rawTitle.trim());
        var summary = (desc && desc.toLowerCase() !== cleanTitle.toLowerCase()) ? desc.slice(0, 260) : '';
        if (cleanTitle) {
          out.push({
            title: cleanTitle,
            link: link.trim(),
            pubDate: pubDate.trim(),
            sourceName: decodeGasEntities_(sourceName),
            summary: summary,
            channel: fallbackLabel,
            categoryId: categoryId || ''
          });
        }
      }
      if (out.length) return out;
    }
  } catch (xmlErr) {
    // Cai no fallback regex se houver XML fora do padrão
  }

  var itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  var match;
  while ((match = itemRegex.exec(xml)) !== null && out.length < maxItems) {
    var block = match[1];
    var readTag = function (tag) {
      var m = block.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
      return m ? decodeGasEntities_(m[1]) : '';
    };
    var rTitle = readTag('title');
    var rLink = readTag('link');
    var rDate = readTag('pubDate');
    var rSrc = readTag('source');
    var rDesc = readTag('description');
    var rClean = rTitle.replace(/\s+-\s+[^-]+$/, '').trim() || rTitle;
    var rMatchSrc = rTitle.match(/\s+-\s+([^-]+)$/);
    var rFinalSrc = rSrc || (rMatchSrc ? rMatchSrc[1].trim() : fallbackLabel);
    var rSum = (rDesc && rDesc.toLowerCase() !== rClean.toLowerCase()) ? rDesc.slice(0, 260) : '';
    if (rClean) {
      out.push({
        title: rClean,
        link: rLink,
        pubDate: rDate,
        sourceName: rFinalSrc,
        summary: rSum,
        channel: fallbackLabel,
        categoryId: categoryId || ''
      });
    }
  }
  return out;
}

function getOrCreateFolder_(parent, name) {
  var cleanName = String(name || 'Sem Nome').replace(/[\/\\:*?"<>|]/g, '-').trim();
  var folders = parent.getFoldersByName(cleanName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parent.createFolder(cleanName);
}

function getRootFolder_() {
  return getOrCreateFolder_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME);
}

function getProfilesFolder_(root) {
  return getOrCreateFolder_(root, PROFILES_FOLDER_NAME);
}

function profileFileName_(creatorId) {
  return 'profile_' + String(creatorId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
}

function readJsonFileOrNull_(file) {
  try {
    return JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  } catch (e) {
    return null;
  }
}

function buildCreatorBundle_(state, creatorId) {
  var creators = Array.isArray(state.creators) ? state.creators : [];
  var creator = null;
  for (var i = 0; i < creators.length; i++) {
    if (creators[i] && creators[i].id === creatorId) {
      creator = creators[i];
      break;
    }
  }
  if (!creator) return null;

  var series = (Array.isArray(state.series) ? state.series : []).filter(function (s) {
    return s && s.creatorId === creatorId;
  });
  var episodes = (Array.isArray(state.episodes) ? state.episodes : []).filter(function (ep) {
    return ep && ep.creatorId === creatorId;
  });
  var schedule = {};
  if (state.schedule && state.schedule[creatorId]) {
    schedule[creatorId] = state.schedule[creatorId];
  }
  var hotTopicsCache = {};
  if (state.hotTopicsCache && state.hotTopicsCache[creatorId]) {
    hotTopicsCache[creatorId] = state.hotTopicsCache[creatorId];
  }

  return {
    version: 'v13',
    savedAt: new Date().toISOString(),
    creator: creator,
    series: series,
    episodes: episodes,
    schedule: schedule,
    hotTopicsCache: hotTopicsCache
  };
}

function saveProfileBundles_(root, state) {
  var profilesFolder = getProfilesFolder_(root);
  var creators = Array.isArray(state.creators) ? state.creators : [];
  var count = 0;
  creators.forEach(function (creator) {
    if (!creator || !creator.id) return;
    var bundle = buildCreatorBundle_(state, creator.id);
    if (!bundle) return;
    var fileName = profileFileName_(creator.id);
    var jsonStr = JSON.stringify(bundle, null, 2);
    var existing = profilesFolder.getFilesByName(fileName);
    if (existing.hasNext()) {
      existing.next().setContent(jsonStr);
    } else {
      profilesFolder.createFile(fileName, jsonStr, MimeType.PLAIN_TEXT);
    }
    count++;
  });
  return count;
}

function mergeBackupState_(existing, incoming) {
  if (!existing || !Array.isArray(existing.creators)) return incoming;
  var incCreators = Array.isArray(incoming.creators) ? incoming.creators : [];
  var incMap = {};
  incCreators.forEach(function (c) {
    if (c && c.id) incMap[c.id] = true;
  });

  var mergedCreators = existing.creators.filter(function (c) {
    return c && c.id && !incMap[c.id];
  }).concat(incCreators);

  var mergedSeries = (Array.isArray(existing.series) ? existing.series : []).filter(function (s) {
    return s && !incMap[s.creatorId];
  }).concat(Array.isArray(incoming.series) ? incoming.series : []);

  var mergedEpisodes = (Array.isArray(existing.episodes) ? existing.episodes : []).filter(function (ep) {
    return ep && !incMap[ep.creatorId];
  }).concat(Array.isArray(incoming.episodes) ? incoming.episodes : []);

  var mergedSchedule = {};
  var exSched = existing.schedule || {};
  Object.keys(exSched).forEach(function (k) {
    if (!incMap[k]) mergedSchedule[k] = exSched[k];
  });
  var inSched = incoming.schedule || {};
  Object.keys(inSched).forEach(function (k) {
    mergedSchedule[k] = inSched[k];
  });

  var mergedHot = {};
  var exHot = existing.hotTopicsCache || {};
  Object.keys(exHot).forEach(function (k) {
    if (!incMap[k]) mergedHot[k] = exHot[k];
  });
  var inHot = incoming.hotTopicsCache || {};
  Object.keys(inHot).forEach(function (k) {
    mergedHot[k] = inHot[k];
  });

  return {
    version: incoming.version || existing.version || 2,
    activeCreatorId: incoming.activeCreatorId || existing.activeCreatorId || (mergedCreators[0] ? mergedCreators[0].id : ''),
    settings: incoming.settings || existing.settings || {},
    creators: mergedCreators,
    series: mergedSeries,
    episodes: mergedEpisodes,
    schedule: mergedSchedule,
    hotTopicsCache: mergedHot
  };
}

function listProfilesFromDrive_(root) {
  var profilesMap = {};
  var profilesFolder = getProfilesFolder_(root);
  var files = profilesFolder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.isTrashed()) continue;
    var name = f.getName() || '';
    if (name.indexOf('profile_') !== 0 || name.slice(-5) !== '.json') continue;
    var bundle = readJsonFileOrNull_(f);
    if (!bundle || !bundle.creator || !bundle.creator.id) continue;
    var cid = bundle.creator.id;
    profilesMap[cid] = {
      id: cid,
      name: bundle.creator.name || 'Criador Sem Nome',
      handle: bundle.creator.handle || '',
      niche: bundle.creator.niche || '',
      brandColor: bundle.creator.brandColor || '#8B5CF6',
      seriesCount: Array.isArray(bundle.series) ? bundle.series.length : 0,
      episodesCount: Array.isArray(bundle.episodes) ? bundle.episodes.length : 0,
      updatedAt: bundle.savedAt || (f.getLastUpdated() ? f.getLastUpdated().toISOString() : ''),
      source: 'profile_file'
    };
  }

  var backupFiles = root.getFilesByName(BACKUP_FILE_NAME);
  if (backupFiles.hasNext()) {
    var bf = backupFiles.next();
    var db = readJsonFileOrNull_(bf);
    if (db && Array.isArray(db.creators)) {
      var dbUpdated = bf.getLastUpdated() ? bf.getLastUpdated().toISOString() : '';
      db.creators.forEach(function (c) {
        if (!c || !c.id || profilesMap[c.id]) return;
        var sCount = (Array.isArray(db.series) ? db.series : []).filter(function (s) { return s && s.creatorId === c.id; }).length;
        var eCount = (Array.isArray(db.episodes) ? db.episodes : []).filter(function (ep) { return ep && ep.creatorId === c.id; }).length;
        profilesMap[c.id] = {
          id: c.id,
          name: c.name || 'Criador Sem Nome',
          handle: c.handle || '',
          niche: c.niche || '',
          brandColor: c.brandColor || '#8B5CF6',
          seriesCount: sCount,
          episodesCount: eCount,
          updatedAt: c.driveLastSync || dbUpdated,
          source: 'backup_db'
        };
      });
    }
  }

  return Object.keys(profilesMap).map(function (k) { return profilesMap[k]; }).sort(function (a, b) {
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });
}

function loadProfileFromDrive_(root, creatorId) {
  if (!creatorId) return null;
  var profilesFolder = getProfilesFolder_(root);
  var files = profilesFolder.getFilesByName(profileFileName_(creatorId));
  if (files.hasNext()) {
    var bundle = readJsonFileOrNull_(files.next());
    if (bundle && bundle.creator && bundle.creator.id) {
      return bundle;
    }
  }
  var backupFiles = root.getFilesByName(BACKUP_FILE_NAME);
  if (backupFiles.hasNext()) {
    var db = readJsonFileOrNull_(backupFiles.next());
    if (db) {
      return buildCreatorBundle_(db, creatorId);
    }
  }
  return null;
}

function deleteProfileFromDrive_(root, creatorId, creatorName, deleteReadableFolder) {
  var trashedProfileFile = false;
  var updatedBackup = false;
  var trashedFolder = false;

  if (creatorId) {
    var profilesFolder = getProfilesFolder_(root);
    var pfFiles = profilesFolder.getFilesByName(profileFileName_(creatorId));
    while (pfFiles.hasNext()) {
      pfFiles.next().setTrashed(true);
      trashedProfileFile = true;
    }

    var backupFiles = root.getFilesByName(BACKUP_FILE_NAME);
    if (backupFiles.hasNext()) {
      var bf = backupFiles.next();
      var db = readJsonFileOrNull_(bf);
      if (db && Array.isArray(db.creators)) {
        var resolvedName = creatorName;
        if (!resolvedName) {
          db.creators.forEach(function (c) {
            if (c && c.id === creatorId && c.name) resolvedName = c.name;
          });
        }
        creatorName = resolvedName;

        db.creators = db.creators.filter(function (c) { return c && c.id !== creatorId; });
        db.series = (Array.isArray(db.series) ? db.series : []).filter(function (s) { return s && s.creatorId !== creatorId; });
        db.episodes = (Array.isArray(db.episodes) ? db.episodes : []).filter(function (ep) { return ep && ep.creatorId !== creatorId; });
        if (db.schedule && db.schedule[creatorId]) delete db.schedule[creatorId];
        if (db.hotTopicsCache && db.hotTopicsCache[creatorId]) delete db.hotTopicsCache[creatorId];
        if (db.activeCreatorId === creatorId) {
          db.activeCreatorId = db.creators[0] ? db.creators[0].id : '';
        }
        bf.setContent(JSON.stringify(db, null, 2));
        updatedBackup = true;
      }
    }
  }

  if (deleteReadableFolder !== false && creatorName) {
    var cleanName = String(creatorName).replace(/[\/\\:*?"<>|]/g, '-').trim();
    if (cleanName && cleanName !== PROFILES_FOLDER_NAME) {
      var folders = root.getFoldersByName(cleanName);
      while (folders.hasNext()) {
        folders.next().setTrashed(true);
        trashedFolder = true;
      }
    }
  }

  return {
    ok: true,
    version: 'v13',
    deleted: true,
    creatorId: creatorId,
    trashedProfileFile: trashedProfileFile,
    updatedBackup: updatedBackup,
    trashedFolder: trashedFolder
  };
}

function formatBrDateParts_(offsetDays) {
  var now = new Date();
  var brMs = now.getTime() - (3 * 60 * 60 * 1000) + ((offsetDays || 0) * 24 * 60 * 60 * 1000);
  var dt = new Date(brMs);
  var y = dt.getUTCFullYear();
  var m = ('0' + (dt.getUTCMonth() + 1)).slice(-2);
  var d = ('0' + dt.getUTCDate()).slice(-2);
  var dayKey = offsetDays === 0 ? 'hoje' : (offsetDays === -1 ? 'ontem' : '2dias');
  var dayLabel = offsetDays === 0 ? ('Hoje (' + d + '/' + m + ')') : (offsetDays === -1 ? ('Ontem (' + d + '/' + m + ')') : ('Há 2 dias (' + d + '/' + m + ')'));
  return {
    iso: y + '-' + m + '-' + d,
    br: d + '/' + m,
    dayKey: dayKey,
    dayLabel: dayLabel
  };
}

function parseXTrendsHtmlGAS_(html, dayInfo, sourceHint) {
  var out = [];
  if (!html) return out;
  var seen = {};
  var rank = 0;

  var addTopic = function (rawTopic, rawVol, rawHref) {
    var topic = decodeGasEntities_(rawTopic);
    if (!topic || topic.length < 2 || topic.length > 80) return;
    if (/^(brazil|brasil|worldwide|trends24|getdaytrends|login|about|privacy|home|more|view all)$/i.test(topic)) return;
    var key = topic.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    rank++;
    var vol = decodeGasEntities_(rawVol || '').replace(/\s+/g, ' ').trim();
    var xSearchUrl = 'https://x.com/search?q=' + encodeURIComponent(topic) + '&src=trend_click&vertical=trends';
    out.push({
      id: dayInfo.dayKey + '::' + key,
      rank: rank,
      topic: topic,
      volume: vol,
      dayKey: dayInfo.dayKey,
      dayLabel: dayInfo.dayLabel,
      dateIso: dayInfo.iso,
      publishedAt: dayInfo.dayLabel,
      sourceName: sourceHint || 'X Brasil',
      xSearchUrl: xSearchUrl,
      sourceUrl: rawHref || xSearchUrl
    });
  };

  // GetDayTrends table rows
  var trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  var trMatch;
  while ((trMatch = trRegex.exec(html)) !== null && out.length < 25) {
    var row = trMatch[1];
    var linkMatch = row.match(/<a\b[^>]*href=["']([^"']*\/trend\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (linkMatch) {
      var href = linkMatch[1].indexOf('http') === 0 ? linkMatch[1] : ('https://getdaytrends.com' + linkMatch[1]);
      var volMatch = row.match(/<span\b[^>]*class=["'][^"']*(?:small|desc|count)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
        || row.match(/(\d[\d.,]*\s*[KkMm]?\s*(?:tweets?|posts?)?)\s*<\/td>/i);
      addTopic(linkMatch[2], volMatch ? volMatch[1] : '', href);
    }
  }

  // Trends24 ordered list items
  if (!out.length) {
    var liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
    var liMatch;
    while ((liMatch = liRegex.exec(html)) !== null && out.length < 25) {
      var liBlock = liMatch[1];
      if (!/trend-link|twitter\.com\/search|x\.com\/search/i.test(liBlock)) continue;
      var aMatch = liBlock.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (aMatch) {
        var countMatch = liBlock.match(/<span\b[^>]*class=["'][^"']*tweet-count[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
        addTopic(aMatch[2], countMatch ? countMatch[1] : '', aMatch[1]);
      }
    }
  }

  return out;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'ping';
    var root = getRootFolder_();

    if (action === 'load') {
      var files = root.getFilesByName(BACKUP_FILE_NAME);
      if (!files.hasNext()) {
        return jsonResponse_({ ok: true, found: false, message: 'Nenhum backup encontrado ainda no Drive.' });
      }
      var file = files.next();
      var content = file.getBlob().getDataAsString('UTF-8');
      return jsonResponse_({ ok: true, found: true, data: JSON.parse(content), updatedAt: file.getLastUpdated() });
    }

    if (action === 'ping_news') {
      return jsonResponse_({ ok: true, version: 'v13', status: 'Reels Lab Google Notícias & X Trends v13 ativo' });
    }

    return jsonResponse_({ ok: true, version: 'v13', status: 'Reels Lab Drive Sync v13 ativo', folder: root.getName() });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || 'sync';

    if (action === 'ping_news') {
      return jsonResponse_({ ok: true, version: 'v13' });
    }

    if (action === 'fetch_article') {
      var targetUrl = String(payload.url || '').trim();
      if (targetUrl.indexOf('http://') !== 0 && targetUrl.indexOf('https://') !== 0) {
        return jsonResponse_({ ok: false, error: 'URL inválida.' });
      }
      try {
        var artRes = UrlFetchApp.fetch(targetUrl, {
          muteHttpExceptions: true,
          followRedirects: true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        var artCode = artRes.getResponseCode();
        if (artCode < 200 || artCode >= 300) {
          return jsonResponse_({ ok: false, status: artCode, error: 'HTTP ' + artCode });
        }
        var html = artRes.getContentText('UTF-8');
        var titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        var metaMatch = html.match(/<meta[^>]+(?:name=["']description["']|property=["']og:description["'])[^>]+content=["']([\s\S]*?)["']/i);
        var cleanedBody = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
        var paragraphs = [];
        var pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
        var pm;
        while ((pm = pRegex.exec(cleanedBody)) !== null && paragraphs.length < 18) {
          var text = decodeGasEntities_(pm[1]);
          if (text.length >= 45) paragraphs.push(text);
        }
        var excerpt = [metaMatch ? decodeGasEntities_(metaMatch[1]) : '']
          .concat(paragraphs)
          .filter(Boolean)
          .join('\n')
          .slice(0, 2600);
        return jsonResponse_({
          ok: Boolean(excerpt),
          title: titleMatch ? decodeGasEntities_(titleMatch[1]) : '',
          excerpt: excerpt,
          finalUrl: targetUrl
        });
      } catch (artErr) {
        return jsonResponse_({ ok: false, error: String(artErr && artErr.message ? artErr.message : artErr) });
      }
    }

    if (action === 'fetch_google_news' || action === 'fetch_trends') {
      var q = String(payload.query || '').trim();
      var niche = String(payload.niche || '').trim();
      var rawUrls = Array.isArray(payload.urls) ? payload.urls : [];
      var rawLabels = Array.isArray(payload.labels) ? payload.labels : [];
      var rawCatIds = Array.isArray(payload.categoryIds) ? payload.categoryIds : [];
      var targetFeeds = [];

      rawUrls.forEach(function (u, idx) {
        var cleanUrl = String(u || '').trim();
        if (cleanUrl.indexOf('https://news.google.com/rss') === 0 && targetFeeds.length < 8) {
          targetFeeds.push({
            url: cleanUrl,
            label: String(rawLabels[idx] || 'Google Notícias'),
            categoryId: String(rawCatIds[idx] || '')
          });
        }
      });

      if (!targetFeeds.length) {
        var fallbackQuery = q || niche;
        if (fallbackQuery) {
          targetFeeds.push({
            url: 'https://news.google.com/rss/search?q=' + encodeURIComponent(fallbackQuery) + '&hl=pt-BR&gl=BR&ceid=BR:pt',
            label: 'Google Notícias (' + fallbackQuery + ')',
            categoryId: 'busca'
          });
        } else {
          targetFeeds.push({
            url: 'https://news.google.com/rss/headlines/section/topic/NATION?hl=pt-BR&gl=BR&ceid=BR:pt',
            label: 'Brasil',
            categoryId: 'brasil'
          });
        }
      }

      var maxPerFeed = targetFeeds.length > 2 ? 12 : 25;
      var requests = targetFeeds.map(function (feed) {
        return {
          url: feed.url,
          muteHttpExceptions: true,
          followRedirects: true,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        };
      });

      var collected = [];
      var seenKeys = {};
      var errors = [];
      var needsAuth = false;

      var processResponse = function (res, feed) {
        var code = res.getResponseCode();
        if (code < 200 || code >= 300) {
          errors.push(feed.label + ': HTTP ' + code);
          return;
        }
        var parsed = parseRssXmlGAS_(res.getContentText('UTF-8'), feed.label, feed.categoryId, maxPerFeed);
        if (!parsed.length) {
          errors.push(feed.label + ': XML sem itens');
          return;
        }
        parsed.forEach(function (it) {
          var key = (feed.categoryId || feed.label) + '::' + (it.link || it.title);
          if (!seenKeys[key]) {
            seenKeys[key] = true;
            collected.push(it);
          }
        });
      };

      try {
        var responses = UrlFetchApp.fetchAll(requests);
        for (var rIdx = 0; rIdx < responses.length; rIdx++) {
          processResponse(responses[rIdx], targetFeeds[rIdx]);
        }
      } catch (batchErr) {
        var batchMsg = String(batchErr && batchErr.message ? batchErr.message : batchErr);
        errors.push(batchMsg);
        if (/permiss|external_request|autoriz|auth/i.test(batchMsg)) {
          needsAuth = true;
        } else {
          for (var sIdx = 0; sIdx < targetFeeds.length; sIdx++) {
            try {
              processResponse(UrlFetchApp.fetch(requests[sIdx].url, requests[sIdx]), targetFeeds[sIdx]);
            } catch (singleErr) {
              var sMsg = String(singleErr && singleErr.message ? singleErr.message : singleErr);
              errors.push(targetFeeds[sIdx].label + ': ' + sMsg);
              if (/permiss|external_request|autoriz|auth/i.test(sMsg)) needsAuth = true;
            }
          }
        }
      }

      return jsonResponse_({
        ok: collected.length > 0,
        version: 'v13',
        items: collected,
        errors: errors,
        needsAuth: needsAuth,
        fetchedAt: new Date().toISOString()
      });
    }

    if (action === 'fetch_x_trends') {
      var days = [formatBrDateParts_(0), formatBrDateParts_(-1), formatBrDateParts_(-2)];
      var targets = [
        { day: days[0], source: 'X / GetDayTrends', url: 'https://getdaytrends.com/brazil/' },
        { day: days[0], source: 'X / Trends24', url: 'https://trends24.in/brazil/' },
        { day: days[1], source: 'X / GetDayTrends', url: 'https://getdaytrends.com/brazil/' + days[1].iso + '/20/' },
        { day: days[1], source: 'X / GetDayTrends', url: 'https://getdaytrends.com/brazil/' + days[1].iso + '/14/' },
        { day: days[2], source: 'X / GetDayTrends', url: 'https://getdaytrends.com/brazil/' + days[2].iso + '/20/' },
        { day: days[2], source: 'X / GetDayTrends', url: 'https://getdaytrends.com/brazil/' + days[2].iso + '/14/' }
      ];

      var xReqs = targets.map(function (t) {
        return {
          url: t.url,
          muteHttpExceptions: true,
          followRedirects: true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8'
          }
        };
      });

      var byDay = { hoje: [], ontem: [], '2dias': [] };
      var daySeen = { hoje: {}, ontem: {}, '2dias': {} };
      var xErrors = [];
      var xNeedsAuth = false;

      var pushDayItems = function (dayKey, parsedList) {
        parsedList.forEach(function (item) {
          var norm = String(item.topic || '').toLowerCase().trim();
          if (!norm || daySeen[dayKey][norm]) return;
          if (byDay[dayKey].length >= 25) return;
          daySeen[dayKey][norm] = true;
          item.rank = byDay[dayKey].length + 1;
          byDay[dayKey].push(item);
        });
      };

      try {
        var xResponses = UrlFetchApp.fetchAll(xReqs);
        for (var xi = 0; xi < xResponses.length; xi++) {
          var xRes = xResponses[xi];
          var xTarget = targets[xi];
          var xCode = xRes.getResponseCode();
          if (xCode >= 200 && xCode < 300) {
            var parsedX = parseXTrendsHtmlGAS_(xRes.getContentText('UTF-8'), xTarget.day, xTarget.source);
            if (parsedX.length) {
              pushDayItems(xTarget.day.dayKey, parsedX);
            }
          } else {
            xErrors.push(xTarget.source + ' (' + xTarget.day.dayKey + '): HTTP ' + xCode);
          }
        }
      } catch (xErr) {
        var xErrMsg = String(xErr && xErr.message ? xErr.message : xErr);
        xErrors.push(xErrMsg);
        if (/permiss|external_request|autoriz|auth/i.test(xErrMsg)) {
          xNeedsAuth = true;
        }
      }

      // Fallback real para dias que bloquearem scraper HTML: notícias sobre assuntos que bombaram no X Brasil nos últimos 3 dias
      var missingDays = days.filter(function (d) { return byDay[d.dayKey].length === 0; });
      if (missingDays.length && !xNeedsAuth) {
        try {
          var rssXUrl = 'https://news.google.com/rss/search?q=' + encodeURIComponent('("no X" OR "no Twitter" OR "trending topics" OR viralizou) Brasil when:3d') + '&hl=pt-BR&gl=BR&ceid=BR:pt';
          var rssXRes = UrlFetchApp.fetch(rssXUrl, {
            muteHttpExceptions: true,
            followRedirects: true,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          if (rssXRes.getResponseCode() >= 200 && rssXRes.getResponseCode() < 300) {
            var rssItems = parseRssXmlGAS_(rssXRes.getContentText('UTF-8'), 'X Brasil (Repercussão)', 'x', 35);
            rssItems.forEach(function (it) {
              var dt = it.pubDate ? new Date(it.pubDate) : null;
              var dayObj = days[0];
              if (dt && !isNaN(dt.getTime())) {
                var brIso = new Date(dt.getTime() - (3 * 60 * 60 * 1000)).toISOString().slice(0, 10);
                for (var di = 0; di < days.length; di++) {
                  if (days[di].iso === brIso) { dayObj = days[di]; break; }
                }
              }
              if (byDay[dayObj.dayKey].length < 15) {
                pushDayItems(dayObj.dayKey, [{
                  id: dayObj.dayKey + '::rss::' + it.title.toLowerCase().slice(0, 40),
                  rank: 1,
                  topic: it.title,
                  volume: it.sourceName || '',
                  dayKey: dayObj.dayKey,
                  dayLabel: dayObj.dayLabel,
                  dateIso: dayObj.iso,
                  publishedAt: dayObj.dayLabel,
                  sourceName: 'Repercussão no X · ' + (it.sourceName || 'Google Notícias'),
                  xSearchUrl: 'https://x.com/search?q=' + encodeURIComponent(it.title.slice(0, 60)) + '&src=trend_click&vertical=trends',
                  sourceUrl: it.link || ''
                }]);
              }
            });
          }
        } catch (rssXErr) {
          xErrors.push('RSS X Brasil: ' + (rssXErr.message || rssXErr));
        }
      }

      var collectedX = [].concat(byDay.hoje, byDay.ontem, byDay['2dias']);
      return jsonResponse_({
        ok: collectedX.length > 0,
        version: 'v13',
        items: collectedX,
        days: days,
        errors: xErrors,
        needsAuth: xNeedsAuth,
        fetchedAt: new Date().toISOString()
      });
    }

    var root = getRootFolder_();

    if (action === 'list_profiles') {
      return jsonResponse_({
        ok: true,
        version: 'v13',
        profiles: listProfilesFromDrive_(root),
        folderUrl: root.getUrl()
      });
    }

    if (action === 'load_profile') {
      var targetLoadId = String(payload.creatorId || '').trim();
      var bundle = loadProfileFromDrive_(root, targetLoadId);
      if (!bundle) {
        return jsonResponse_({ ok: true, version: 'v13', found: false });
      }
      return jsonResponse_({ ok: true, version: 'v13', found: true, profile: bundle });
    }

    if (action === 'delete_profile') {
      return jsonResponse_(
        deleteProfileFromDrive_(
          root,
          String(payload.creatorId || '').trim(),
          String(payload.creatorName || '').trim(),
          payload.deleteReadableFolder !== false
        )
      );
    }

    if (action === 'load') {
      var loadFiles = root.getFilesByName(BACKUP_FILE_NAME);
      if (!loadFiles.hasNext()) {
        return jsonResponse_({ ok: true, found: false });
      }
      var loadFile = loadFiles.next();
      return jsonResponse_({
        ok: true,
        found: true,
        data: JSON.parse(loadFile.getBlob().getDataAsString('UTF-8'))
      });
    }

    if (action === 'sync' && payload.state) {
      var incomingState = payload.state;
      var existingBackup = root.getFilesByName(BACKUP_FILE_NAME);
      var existingState = existingBackup.hasNext() ? readJsonFileOrNull_(existingBackup.next()) : null;
      var mergedState = (payload.mergeProfiles !== false && existingState)
        ? mergeBackupState_(existingState, incomingState)
        : incomingState;

      // 1. Salva banco mesclado JSON para sincronização entre dispositivos (preserva outros perfis já no Drive)
      var jsonStr = JSON.stringify(mergedState, null, 2);
      var backupToWrite = root.getFilesByName(BACKUP_FILE_NAME);
      if (backupToWrite.hasNext()) {
        backupToWrite.next().setContent(jsonStr);
      } else {
        root.createFile(BACKUP_FILE_NAME, jsonStr, MimeType.PLAIN_TEXT);
      }

      // 2. Salva snapshots individuais por perfil em _perfis/ para resgate e exclusão bidirecional
      var savedProfilesCount = saveProfileBundles_(root, incomingState);

      var state = incomingState;

      // 2. Organiza pastas legíveis por Criador -> Série -> Episódios (.txt + .png)
      if (payload.exportReadableFiles !== false && Array.isArray(state.creators)) {
        var creatorsMap = {};
        state.creators.forEach(function (c) { creatorsMap[c.id] = c; });
        var seriesMap = {};
        (state.series || []).forEach(function (s) { seriesMap[s.id] = s; });

        (state.episodes || []).forEach(function (ep) {
          var creator = creatorsMap[ep.creatorId];
          var serie = ep.seriesId ? seriesMap[ep.seriesId] : null;
          if (!creator) return;

          var creatorFolder = getOrCreateFolder_(root, creator.name || 'Criador');
          var serieFolder = serie
            ? getOrCreateFolder_(creatorFolder, serie.name || 'Serie')
            : getOrCreateFolder_(creatorFolder, 'Sem Pasta Definida (Avulsos)');
          var partPad = ('00' + (ep.partNumber || 1)).slice(-2);
          var txtPrefix = serie ? ('Parte_' + partPad + '_') : 'Avulso_';
          var txtName = txtPrefix + (ep.title || 'Roteiro').slice(0, 35).replace(/[\/\\:*?"<>|]/g, '-') + '.txt';

          var txtBody = [
            'REELS LAB — EPISÓDIO SALVO',
            'Criador: ' + (creator.name || '') + ' (' + (creator.handle || '') + ')',
            'Série: ' + (serie ? serie.name : 'Sem pasta definida (Avulso)'),
            'Parte: ' + (ep.partNumber || (serie ? 1 : 'Avulso')) + ' | Status: ' + (ep.status || 'Roteiro'),
            'Funil: ' + (ep.funnelStage || '') + ' | Objetivo Viral: ' + (ep.viralGoal || ''),
            (ep.sourceNews && ep.sourceNews.url) ? ('Notícia Fonte: ' + ep.sourceNews.url) : '',
            '============================================================',
            'TEXTO NA TELA (ACIMA DA CABEÇA):',
            ep.onScreenText || '',
            '',
            'HEADLINES VIRAIS PARA CAPA:',
            (ep.headlines || []).join('\n'),
            '',
            'ROTEIRO FALADO COMPLETO:',
            ep.script || '',
            '',
            'LEGENDA DO POST:',
            ep.caption || '',
            '',
            'PROMPT DE EDIÇÃO COM IA & GRAVAÇÃO:',
            ep.editingPrompt || '',
            '',
            'PROMPT VISUAL DA CAPA:',
            ep.coverImagePrompt || ''
          ].join('\n');

          var existingTxt = serieFolder.getFilesByName(txtName);
          if (existingTxt.hasNext()) {
            existingTxt.next().setContent(txtBody);
          } else {
            serieFolder.createFile(txtName, txtBody, MimeType.PLAIN_TEXT);
          }

          // Salva capa PNG se existir
          if (ep.coverDataUrl && ep.coverDataUrl.indexOf('data:image/png;base64,') === 0) {
            var pngName = 'Parte_' + partPad + '_Capa.png';
            var existingPng = serieFolder.getFilesByName(pngName);
            if (!existingPng.hasNext()) {
              var b64 = ep.coverDataUrl.split(',')[1];
              var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/png', pngName);
              serieFolder.createFile(blob);
            }
          }
        });
      }

      return jsonResponse_({
        ok: true,
        version: 'v13',
        savedProfiles: savedProfilesCount,
        syncedAt: new Date().toISOString(),
        folderName: root.getName(),
        folderUrl: root.getUrl()
      });
    }

    return jsonResponse_({ ok: false, error: 'Ação desconhecida.' });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}
