/**
 * Estúdio de Capa 9:16 do Reels Lab
 * Renderiza capas verticais 1080x1920 (com área segura do Feed 4:5 e Reels 9:16),
 * suporta fundo gerado por IA, upload de foto ou fundos estúdio procedurais.
 */

const WIDTH = 1080;
const HEIGHT = 1920;

export const COVER_TEMPLATES = [
  { id: 'apple_light', name: 'Apple Minimal White (Serif & Bold)' },
  { id: 'apple_dark', name: 'Apple Minimal Black (Serif & Bold)' },
  { id: 'gradient_glow', name: 'Studio Soft Glass' },
  { id: 'editorial_dark', name: 'Editorial Dark Contraste' },
  { id: 'sunset_mesh', name: 'Soft Pastel Aurora' },
  { id: 'magazine_frame', name: 'Capa Revista Bold' }
];

const POWER_HIGHLIGHTS = new Set([
  'segredo', 'segredos', 'truque', 'pare', 'nunca', 'erro', 'erros',
  'verdade', 'mentira', 'ninguém', 'assim', 'agora', 'grátis', 'cuidado',
  'melhor', 'simples', 'rápido', 'fácil', 'isso', 'entenda', 'veja', 'razão'
]);

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapHeadlineLines(ctx, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ['DIGITE SUA HEADLINE VIRAL'];
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawProceduralBg(ctx, templateId, accentColor) {
  const accent = accentColor || '#EC4899';

  if (templateId === 'apple_light') {
    const base = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    base.addColorStop(0, '#FFFFFF');
    base.addColorStop(0.55, '#F5F5F7');
    base.addColorStop(1, '#EFEFF4');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const orb1 = ctx.createRadialGradient(WIDTH * 0.18, HEIGHT * 0.22, 20, WIDTH * 0.18, HEIGHT * 0.22, 620);
    orb1.addColorStop(0, 'rgba(167, 139, 250, 0.22)');
    orb1.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = orb1;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const orb2 = ctx.createRadialGradient(WIDTH * 0.85, HEIGHT * 0.78, 20, WIDTH * 0.85, HEIGHT * 0.78, 660);
    orb2.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
    orb2.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = orb2;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Subtle glass frame
    ctx.fillStyle = 'rgba(255, 255, 255, 0.56)';
    ctx.strokeStyle = 'rgba(29, 29, 31, 0.08)';
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 56, 330, WIDTH - 112, HEIGHT - 660, 56);
    ctx.fill();
    ctx.stroke();
    return;
  }

  if (templateId === 'apple_dark') {
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const orb1 = ctx.createRadialGradient(WIDTH * 0.2, HEIGHT * 0.24, 20, WIDTH * 0.2, HEIGHT * 0.24, 650);
    orb1.addColorStop(0, 'rgba(139, 92, 246, 0.22)');
    orb1.addColorStop(1, 'rgba(5, 5, 7, 0)');
    ctx.fillStyle = orb1;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const orb2 = ctx.createRadialGradient(WIDTH * 0.82, HEIGHT * 0.76, 20, WIDTH * 0.82, HEIGHT * 0.76, 680);
    orb2.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
    orb2.addColorStop(1, 'rgba(5, 5, 7, 0)');
    ctx.fillStyle = orb2;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Subtle dark frosted glass frame
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, 56, 330, WIDTH - 112, HEIGHT - 660, 56);
    ctx.fill();
    ctx.stroke();
    return;
  }

  if (templateId === 'editorial_dark') {
    ctx.fillStyle = '#09090F';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const g1 = ctx.createRadialGradient(WIDTH * 0.85, HEIGHT * 0.18, 40, WIDTH * 0.85, HEIGHT * 0.18, 760);
    g1.addColorStop(0, accent);
    g1.addColorStop(1, 'rgba(9,9,15,0)');
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const g2 = ctx.createRadialGradient(WIDTH * 0.15, HEIGHT * 0.82, 40, WIDTH * 0.15, HEIGHT * 0.82, 700);
    g2.addColorStop(0, '#6366F1');
    g2.addColorStop(1, 'rgba(9,9,15,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
  } else if (templateId === 'sunset_mesh') {
    const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    grad.addColorStop(0, '#1A0B1E');
    grad.addColorStop(0.45, '#581C4C');
    grad.addColorStop(1, '#FF6B35');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const glow = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.44, 50, WIDTH * 0.5, HEIGHT * 0.44, 620);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  } else if (templateId === 'magazine_frame') {
    ctx.fillStyle = '#11111B';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    grad.addColorStop(0, accent);
    grad.addColorStop(1, '#8B5CF6');
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 6;
    drawRoundedRect(ctx, 56, 56, WIDTH - 112, HEIGHT - 112, 44);
    ctx.stroke();
  } else {
    // gradient_glow (padrão Reels Studio)
    const base = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    base.addColorStop(0, '#0F0E1B');
    base.addColorStop(0.55, '#191430');
    base.addColorStop(1, '#120D1D');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const orb1 = ctx.createRadialGradient(WIDTH * 0.2, HEIGHT * 0.25, 20, WIDTH * 0.2, HEIGHT * 0.25, 680);
    orb1.addColorStop(0, '#FF6B35');
    orb1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = orb1;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const orb2 = ctx.createRadialGradient(WIDTH * 0.82, HEIGHT * 0.65, 20, WIDTH * 0.82, HEIGHT * 0.65, 740);
    orb2.addColorStop(0, accent);
    orb2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = orb2;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
  }

  // Subtle studio grid texture
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 2;
  for (let x = 0; x < WIDTH; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 90) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
}

export async function renderCoverCanvas(canvas, options = {}) {
  const {
    headline = 'O SEGREDO QUE NINGUÉM TE CONTOU',
    seriesName = 'SÉRIE VIRAL',
    partNumber = 1,
    handle = '@seuperfil',
    accentColor = '#EC4899',
    templateId = 'apple_light',
    bgDataUrl = '',
    showSafeZone = false
  } = options;

  const isLightTheme = !bgDataUrl && templateId === 'apple_light';
  const isAppleStyle = templateId === 'apple_light' || templateId === 'apple_dark';

  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  // 1. Background
  if (bgDataUrl) {
    try {
      const img = await loadImage(bgDataUrl);
      const scale = Math.max(WIDTH / img.width, HEIGHT / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = (WIDTH - drawW) / 2;
      const dy = (HEIGHT - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);

      // Contrast scrim for headline legibility
      const scrim = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      scrim.addColorStop(0, 'rgba(10,10,18,0.65)');
      scrim.addColorStop(0.35, 'rgba(10,10,18,0.45)');
      scrim.addColorStop(0.65, 'rgba(10,10,18,0.65)');
      scrim.addColorStop(1, 'rgba(10,10,18,0.88)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } catch {
      drawProceduralBg(ctx, templateId, accentColor);
    }
  } else {
    drawProceduralBg(ctx, templateId, accentColor);
  }

  // Feed 4:5 safe box coordinates (centered 1080x1350 inside 1080x1920)
  const feedTop = (HEIGHT - 1350) / 2; // 285px
  const feedBottom = feedTop + 1350;   // 1635px

  // 2. Top Series Pill inside Safe Zone
  const pillText = `${String(seriesName || 'SÉRIE').toUpperCase().slice(0, 32)}  •  PARTE ${partNumber || 1}`;
  ctx.font = '600 28px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
  const pillWidth = Math.min(ctx.measureText(pillText).width + 76, WIDTH - 140);
  const pillX = (WIDTH - pillWidth) / 2;
  const pillY = feedTop + 145;

  ctx.save();
  if (isLightTheme) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.strokeStyle = 'rgba(29, 29, 31, 0.14)';
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, pillX, pillY, pillWidth, 68, 34);
    ctx.fill();
    ctx.stroke();
  } else if (isAppleStyle) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, pillX, pillY, pillWidth, 68, 34);
    ctx.fill();
    ctx.stroke();
  } else {
    const pillGrad = ctx.createLinearGradient(pillX, pillY, pillX + pillWidth, pillY);
    pillGrad.addColorStop(0, '#FF6B35');
    pillGrad.addColorStop(0.5, accentColor || '#EC4899');
    pillGrad.addColorStop(1, '#8B5CF6');
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 24;
    drawRoundedRect(ctx, pillX, pillY, pillWidth, 74, 37);
    ctx.fillStyle = pillGrad;
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = isLightTheme ? '#1D1D1F' : '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pillText, WIDTH / 2, pillY + (isAppleStyle ? 35 : 38), pillWidth - 40);

  // 3. Main Viral Headline (centered inside 4:5 Feed Safe Area)
  const cleanHeadline = String(headline || '').trim();
  const maxTextWidth = WIDTH - 170;
  let fontSize = cleanHeadline.length > 55 ? 72 : cleanHeadline.length > 36 ? 84 : 96;
  const sansFont = (sz, w = 700) => `${w} ${sz}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
  const serifItalicFont = (sz) => `italic 400 ${Math.round(sz * 1.1)}px "Instrument Serif", "Playfair Display", Georgia, serif`;

  ctx.font = sansFont(fontSize, isAppleStyle ? 700 : 900);

  let lines = wrapHeadlineLines(ctx, cleanHeadline, maxTextWidth);
  while (lines.length > 5 && fontSize > 52) {
    fontSize -= 6;
    ctx.font = sansFont(fontSize, isAppleStyle ? 700 : 900);
    lines = wrapHeadlineLines(ctx, cleanHeadline, maxTextWidth);
  }

  const lineHeight = fontSize * 1.18;
  const blockHeight = lines.length * lineHeight;
  let startY = (HEIGHT / 2) - (blockHeight / 2) + 20;

  // Background highlight card behind headline if editorial or bg photo
  if ((templateId === 'editorial_dark' || bgDataUrl) && !isAppleStyle) {
    ctx.save();
    ctx.fillStyle = 'rgba(11, 11, 20, 0.56)';
    drawRoundedRect(ctx, 64, startY - 56, WIDTH - 128, blockHeight + 92, 40);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  lines.forEach((line, idx) => {
    const words = line.split(' ');
    const y = startY + idx * lineHeight;

    // Pre-measure mixed sans/serif-italic line width for crisp centering
    const measured = words.map((word, wIdx) => {
      const normalized = word.toLowerCase().replace(/[^a-záéíóúâêôãõç]/gi, '');
      const isPower = POWER_HIGHLIGHTS.has(normalized) || (word === word.toUpperCase() && word.length >= 4);
      const font = isPower ? serifItalicFont(fontSize) : sansFont(fontSize, isAppleStyle ? 700 : 900);
      ctx.font = font;
      const wWidth = ctx.measureText(word + (wIdx < words.length - 1 ? ' ' : '')).width;
      return { word, isPower, font, wWidth };
    });

    const totalLineWidth = measured.reduce((acc, item) => acc + item.wWidth, 0);
    let cursorX = (WIDTH - totalLineWidth) / 2;

    measured.forEach((item) => {
      ctx.save();
      ctx.font = item.font;
      if (!isLightTheme) {
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 4;
      }
      if (isLightTheme) {
        ctx.fillStyle = item.isPower ? '#5B21B6' : '#1D1D1F';
      } else if (isAppleStyle) {
        ctx.fillStyle = item.isPower ? '#DDD6FE' : '#F5F5F7';
      } else {
        ctx.fillStyle = item.isPower ? '#FDE047' : '#FFFFFF';
      }
      ctx.fillText(item.word, cursorX, item.isPower ? y - fontSize * 0.04 : y);
      ctx.restore();

      cursorX += item.wWidth;
    });
  });

  // 4. Bottom Handle & Swipe/Watch Cue inside 4:5 safe zone
  const footerY = feedBottom - 165;
  ctx.fillStyle = isLightTheme ? 'rgba(29, 29, 31, 0.88)' : 'rgba(255,255,255,0.88)';
  ctx.font = '600 32px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(handle || '@seuperfil', WIDTH / 2, footerY);

  ctx.fillStyle = isLightTheme ? 'rgba(29, 29, 31, 0.55)' : 'rgba(255,255,255,0.58)';
  ctx.font = 'italic 400 28px "Instrument Serif", Georgia, serif';
  ctx.fillText('assista até o final', WIDTH / 2, footerY + 50);

  // 5. Optional Safe Zone Guide Overlay (STRICTLY hidden on PNG export / saved covers)
  if (Boolean(showSafeZone)) {
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.setLineDash([16, 12]);
    ctx.lineWidth = 4;
    ctx.strokeRect(18, feedTop, WIDTH - 36, 1350);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
    ctx.font = '700 24px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ÁREA SEGURA DO FEED (4:5) — NÃO CORTA NO PERFIL', 36, feedTop - 36);
    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}

function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl || '').split(',');
  const mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/png';
  const bin = atob(parts[1] || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export async function renderCleanCoverExport(options = {}) {
  const offscreen = document.createElement('canvas');
  const dataUrl = await renderCoverCanvas(offscreen, { ...options, showSafeZone: false });
  let blob = await new Promise((resolve) => {
    if (typeof offscreen.toBlob === 'function') {
      offscreen.toBlob((b) => resolve(b), 'image/png');
    } else {
      resolve(null);
    }
  });
  if (!blob) {
    blob = dataUrlToBlob(dataUrl);
  }
  return { dataUrl, blob };
}

export async function saveCoverImage({ blob, dataUrl, filename = 'capa-reels-lab.png' }) {
  const finalBlob = blob || dataUrlToBlob(dataUrl);
  const canUseShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof File !== 'undefined';

  if (canUseShare) {
    try {
      const file = new File([finalBlob], filename, { type: 'image/png' });
      const canShareFiles = typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : false;
      if (canShareFiles) {
        await navigator.share({
          files: [file],
          title: 'Capa Reels Lab'
        });
        return { method: 'share', dataUrl };
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        return { method: 'cancelled', dataUrl };
      }
    }
  }

  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
  if (isMobile) {
    return { method: 'fallback_modal', dataUrl, blob: finalBlob, filename };
  }

  triggerBlobDownload(finalBlob, dataUrl, filename);
  return { method: 'download', dataUrl };
}

export function triggerBlobDownload(blob, dataUrl, filename = 'capa-reels-lab.png') {
  if (blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return;
  }
  downloadDataUrl(dataUrl, filename);
}

export function downloadDataUrl(dataUrl, filename = 'capa-reels-lab.png') {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
