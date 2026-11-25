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
var PROFILE_HISTORY_FILE_NAME = 'reels-lab-profile-history.json';
var X_TRENDS_CACHE_FILE_NAME = 'reels-lab-x-trends-3d.json';

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

function readJsonFileFromFolder_(folder, fileName) {
  try {
    var files = folder.getFilesByName(fileName);
    if (!files.hasNext()) return null;
    var content = files.next().getBlob().getDataAsString('UTF-8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

function writeJsonFileToFolder_(folder, fileName, obj) {
  var jsonStr = JSON.stringify(obj, null, 2);
  var existing = folder.getFilesByName(fileName);
  if (existing.hasNext()) {
    existing.next().setContent(jsonStr);
  } else {
    folder.createFile(fileName, jsonStr, MimeType.PLAIN_TEXT);
  }
}

function mergeProfileHistoryGAS_(existing, incoming) {
  var listA = Array.isArray(existing) ? existing : [];
  var listB = Array.isArray(incoming) ? incoming : [];
  var byKey = {};
  var addEntry = function (entry) {
    if (!entry || !entry.snapshot) return;
    var key = entry.id || ((entry.creatorId || 'creator') + '::' + (entry.savedAt || ''));
    var prev = byKey[key];
    if (!prev || new Date(entry.savedAt || 0).getTime() >= new Date(prev.savedAt || 0).getTime()) {
      byKey[key] = entry;
    }
  };
  listA.forEach(addEntry);
  listB.forEach(addEntry);
  var out = Object.keys(byKey).map(function (k) { return byKey[k]; });
  out.sort(function (a, b) {
    return new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime();
  });
  return out.slice(0, 120);
}

function parseTrends24HtmlGAS_(html, nowIso) {
  var out = [];
  if (!html) return out;
  var seen = {};
  var ignoreRe = /^(trends24|brazil|brasil|worldwide|home|login|signup|about|privacy|terms|twitter|trends|trending|search|all)$/i;
  var cardRegex = /<ol[^>]*>([\s\S]*?)<\/ol>/gi;
  var olMatch;
  while ((olMatch = cardRegex.exec(html)) !== null && out.length < 35) {
    var olHtml = olMatch[1];
    var liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    var liMatch;
    while ((liMatch = liRegex.exec(olHtml)) !== null && out.length < 35) {
      var liBody = liMatch[1];
      var aMatch = liBody.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
      var rawTitle = aMatch ? decodeGasEntities_(aMatch[1]) : '';
      if (!rawTitle || rawTitle.length < 2 || rawTitle.length > 90 || ignoreRe.test(rawTitle)) continue;
      var countMatch = liBody.match(/class=["'][^"']*(?:tweet-count|count|volume)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      var volume = countMatch ? decodeGasEntities_(countMatch[1]) : '';
      var normKey = rawTitle.toLowerCase();
      if (seen[normKey]) continue;
      seen[normKey] = true;
      out.push({
        title: rawTitle,
        topicTag: rawTitle,
        link: 'https://x.com/search?q=' + encodeURIComponent(rawTitle) + '&src=trend_click',
        pubDate: nowIso,
        sourceName: 'Trends24 · X Brasil',
        volume: volume,
        summary: volume ? ('Volume reportado no X: ' + volume) : 'Assunto em alta nos Trending Topics do X Brasil.',
        channel: 'X Brasil (3 dias)',
        categoryId: 'x_brasil'
      });
    }
  }
  return out;
}

function parseGetDayTrendsHtmlGAS_(html, nowIso) {
  var out = [];
  if (!html) return out;
  var seen = {};
  var linkRegex = /<a[^>]+href=["'][^"']*\/brazil\/trend\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  while ((m = linkRegex.exec(html)) !== null && out.length < 30) {
    var cleanTitle = decodeGasEntities_(m[1]);
    if (!cleanTitle || cleanTitle.length < 2 || cleanTitle.length > 90) continue;
    var normKey = cleanTitle.toLowerCase();
    if (seen[normKey]) continue;
    seen[normKey] = true;
    out.push({
      title: cleanTitle,
      topicTag: cleanTitle,
      link: 'https://x.com/search?q=' + encodeURIComponent(cleanTitle) + '&src=trend_click',
      pubDate: nowIso,
      sourceName: 'GetDayTrends · X Brasil',
      volume: '',
      summary: 'Trending Topic capturado no ranking Brasil do X.',
      channel: 'X Brasil (3 dias)',
      categoryId: 'x_brasil'
    });
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

    if (action === 'list_profile_history') {
      var histData = readJsonFileFromFolder_(root, PROFILE_HISTORY_FILE_NAME);
      var histItems = Array.isArray(histData) ? histData : (histData && Array.isArray(histData.items) ? histData.items : []);
      if (!histItems.length) {
        var bkp = readJsonFileFromFolder_(root, BACKUP_FILE_NAME);
        if (bkp && Array.isArray(bkp.profileHistory)) histItems = bkp.profileHistory;
      }
      return jsonResponse_({ ok: true, version: 'v13', items: histItems });
    }

    if (action === 'ping_news') {
      return jsonResponse_({ ok: true, version: 'v13', status: 'Reels Lab Google Notícias & X Brasil v13 ativo' });
    }

    return jsonResponse_({ ok: true, version: 'v13', status: 'Reels Lab Drive Sync ativo', folder: root.getName() });
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

    if (action === 'fetch_x_trends') {
      var nowIso = new Date().toISOString();
      var nowMs = new Date().getTime();
      var threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      var xRequests = [
        {
          url: 'https://trends24.in/brazil/',
          muteHttpExceptions: true,
          followRedirects: true,
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' }
        },
        {
          url: 'https://getdaytrends.com/brazil/',
          muteHttpExceptions: true,
          followRedirects: true,
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' }
        },
        {
          url: 'https://news.google.com/rss/search?q=' + encodeURIComponent('(twitter OR "no X" OR "trending topics" OR viralizou OR "assuntos mais comentados") brasil when:3d') + '&hl=pt-BR&gl=BR&ceid=BR:pt',
          muteHttpExceptions: true,
          followRedirects: true,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }
      ];

      var xCollected = [];
      var xErrors = [];
      var xNeedsAuth = false;

      try {
        var xResponses = UrlFetchApp.fetchAll(xRequests);
        if (xResponses[0] && xResponses[0].getResponseCode() >= 200 && xResponses[0].getResponseCode() < 300) {
          xCollected = xCollected.concat(parseTrends24HtmlGAS_(xResponses[0].getContentText('UTF-8'), nowIso));
        } else {
          xErrors.push('Trends24 HTTP ' + (xResponses[0] ? xResponses[0].getResponseCode() : 'err'));
        }
        if (xResponses[1] && xResponses[1].getResponseCode() >= 200 && xResponses[1].getResponseCode() < 300) {
          xCollected = xCollected.concat(parseGetDayTrendsHtmlGAS_(xResponses[1].getContentText('UTF-8'), nowIso));
        } else {
          xErrors.push('GetDayTrends HTTP ' + (xResponses[1] ? xResponses[1].getResponseCode() : 'err'));
        }
        if (xResponses[2] && xResponses[2].getResponseCode() >= 200 && xResponses[2].getResponseCode() < 300) {
          var rssX = parseRssXmlGAS_(xResponses[2].getContentText('UTF-8'), 'X Brasil (3 dias)', 'x_brasil', 25);
          rssX.forEach(function (it) {
            it.sourceName = 'X / ' + (it.sourceName || 'Notícias');
            xCollected.push(it);
          });
        }
      } catch (xErr) {
        var xMsg = String(xErr && xErr.message ? xErr.message : xErr);
        xErrors.push(xMsg);
        if (/permiss|external_request|autoriz|auth/i.test(xMsg)) {
          xNeedsAuth = true;
        }
      }

      // Mescla com arquivo deslizante de 72h no Drive (se Drive estiver acessível)
      try {
        var xRoot = getRootFolder_();
        var prevCache = readJsonFileFromFolder_(xRoot, X_TRENDS_CACHE_FILE_NAME);
        var prevItems = (prevCache && Array.isArray(prevCache.items)) ? prevCache.items : [];
        var mergedMap = {};
        var addTrendItem = function (it) {
          if (!it || !it.title) return;
          var ts = it.pubDate ? Date.parse(it.pubDate) : nowMs;
          if (!isNaN(ts) && (nowMs - ts) > threeDaysMs) return;
          var key = String(it.title).toLowerCase().trim();
          if (!mergedMap[key]) {
            mergedMap[key] = it;
          }
        };
        xCollected.forEach(addTrendItem);
        prevItems.forEach(addTrendItem);
        xCollected = Object.keys(mergedMap).map(function (k) { return mergedMap[k]; }).slice(0, 60);
        if (xCollected.length) {
          writeJsonFileToFolder_(xRoot, X_TRENDS_CACHE_FILE_NAME, { updatedAt: nowIso, items: xCollected });
        }
      } catch (cacheErr) {
        // Ignora erro de cache no Drive para não bloquear resposta dos trends
      }

      return jsonResponse_({
        ok: xCollected.length > 0,
        version: 'v13',
        items: xCollected.slice(0, 60),
        errors: xErrors,
        needsAuth: xNeedsAuth,
        fetchedAt: nowIso
      });
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

    var root = getRootFolder_();

    if (action === 'list_profile_history') {
      var histFile = readJsonFileFromFolder_(root, PROFILE_HISTORY_FILE_NAME);
      var histItems = Array.isArray(histFile) ? histFile : (histFile && Array.isArray(histFile.items) ? histFile.items : []);
      if (!histItems.length) {
        var backupObj = readJsonFileFromFolder_(root, BACKUP_FILE_NAME);
        if (backupObj && Array.isArray(backupObj.profileHistory)) {
          histItems = backupObj.profileHistory;
        }
      }
      return jsonResponse_({
        ok: true,
        version: 'v13',
        items: histItems
      });
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
      var state = payload.state;

      // 1. Salva banco completo JSON para sincronização entre dispositivos (sem duplicar arquivos)
      var jsonStr = JSON.stringify(state, null, 2);
      var existingBackup = root.getFilesByName(BACKUP_FILE_NAME);
      if (existingBackup.hasNext()) {
        existingBackup.next().setContent(jsonStr);
      } else {
        root.createFile(BACKUP_FILE_NAME, jsonStr, MimeType.PLAIN_TEXT);
      }

      // 2. Mescla e salva histórico de versões de perfis automaticamente no Drive
      var existingHistoryObj = readJsonFileFromFolder_(root, PROFILE_HISTORY_FILE_NAME);
      var existingHistory = Array.isArray(existingHistoryObj)
        ? existingHistoryObj
        : (existingHistoryObj && Array.isArray(existingHistoryObj.items) ? existingHistoryObj.items : []);
      var mergedHistory = mergeProfileHistoryGAS_(existingHistory, state.profileHistory || []);
      if (mergedHistory.length) {
        writeJsonFileToFolder_(root, PROFILE_HISTORY_FILE_NAME, {
          updatedAt: new Date().toISOString(),
          items: mergedHistory
        });
      }

      // 3. Organiza pastas legíveis por Criador -> Série (mesmo vazias!) -> Episódios (.txt + .png)
      if (payload.exportReadableFiles !== false && Array.isArray(state.creators)) {
        var creatorsMap = {};
        var creatorFoldersMap = {};
        state.creators.forEach(function (c) {
          creatorsMap[c.id] = c;
          creatorFoldersMap[c.id] = getOrCreateFolder_(root, c.name || 'Criador');
        });
        var seriesMap = {};
        (state.series || []).forEach(function (s) {
          seriesMap[s.id] = s;
          var cFolder = creatorFoldersMap[s.creatorId];
          if (cFolder) {
            getOrCreateFolder_(cFolder, s.name || 'Serie');
          }
        });

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
        syncedAt: new Date().toISOString(),
        folderName: root.getName(),
        folderUrl: root.getUrl(),
        seriesCount: (state.series || []).length,
        episodesCount: (state.episodes || []).length,
        profileHistoryCount: mergedHistory.length
      });
    }

    return jsonResponse_({ ok: false, error: 'Ação desconhecida.' });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}
