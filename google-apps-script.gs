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
      return jsonResponse_({ ok: true, version: 'v9', status: 'Reels Lab Google Notícias v9 ativo' });
    }

    return jsonResponse_({ ok: true, version: 'v9', status: 'Reels Lab Drive Sync ativo', folder: root.getName() });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || 'sync';

    if (action === 'ping_news') {
      return jsonResponse_({ ok: true, version: 'v9' });
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
        version: 'v9',
        items: collected,
        errors: errors,
        needsAuth: needsAuth,
        fetchedAt: new Date().toISOString()
      });
    }

    var root = getRootFolder_();

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

      // 2. Organiza pastas legíveis por Criador -> Série -> Episódios (.txt + .png)
      if (payload.exportReadableFiles !== false && Array.isArray(state.creators)) {
        var creatorsMap = {};
        state.creators.forEach(function (c) { creatorsMap[c.id] = c; });
        var seriesMap = {};
        (state.series || []).forEach(function (s) { seriesMap[s.id] = s; });

        (state.episodes || []).forEach(function (ep) {
          var creator = creatorsMap[ep.creatorId];
          var serie = seriesMap[ep.seriesId];
          if (!creator || !serie) return;

          var creatorFolder = getOrCreateFolder_(root, creator.name || 'Criador');
          var serieFolder = getOrCreateFolder_(creatorFolder, serie.name || 'Serie');
          var partPad = ('00' + (ep.partNumber || 1)).slice(-2);
          var txtName = 'Parte_' + partPad + '_' + (ep.title || 'Roteiro').slice(0, 35).replace(/[\/\\:*?"<>|]/g, '-') + '.txt';

          var txtBody = [
            'REELS LAB — EPISÓDIO SALVO',
            'Criador: ' + (creator.name || '') + ' (' + (creator.handle || '') + ')',
            'Série: ' + (serie.name || ''),
            'Parte: ' + (ep.partNumber || 1) + ' | Status: ' + (ep.status || 'Roteiro'),
            'Funil: ' + (ep.funnelStage || '') + ' | Objetivo Viral: ' + (ep.viralGoal || ''),
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
