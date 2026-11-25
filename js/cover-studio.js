/**
 * Estúdio de Capa 9:16 do Reels Lab
 * Renderiza capas verticais 1080x1920 (com área segura do Feed 4:5 e Reels 9:16),
 * 8 estilos arquitetonicamente distintos, formatação global + por seleção de palavras,
 * cor/transparência do selo, modo "Somente Fundo", upload de foto e fundo gerado por IA.
 */

const WIDTH = 1080;
const HEIGHT = 1920;

export const COVER_TEMPLATES = [
  { id: 'apple_light', name: 'Apple Minimal White (Serif & Bold)' },
  { id: 'apple_dark', name: 'Apple Minimal Black (Serif & Bold)' },
  { id: 'mrbeast', name: 'MrBeast (Impacto Máximo)' },
  { id: 'jornal', name: 'Jornal (Manchete Editorial)' },
  { id: 'netflix', name: 'Netflix (Cinematográfico)' },
  { id: 'premium', name: 'Premium (Minimalista Sofisticado)' },
  { id: 'influencer', name: 'Influencer (Foco no Rosto)' },
  { id: 'infografico', name: 'Infográfico (Blocos Modulares)' }
];

export const COVER_FONTS = [
  { id: 'Inter', label: 'Inter (Moderna)', css: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' },
  { id: 'Anton', label: 'Anton (Ultra Impacto)', css: '"Anton", Impact, "Arial Black", sans-serif' },
  { id: 'Bebas Neue', label: 'Bebas Neue (Cinema)', css: '"Bebas Neue", "Oswald", Impact, sans-serif' },
  { id: 'Montserrat', label: 'Montserrat (Influencer)', css: '"Montserrat", Inter, sans-serif' },
  { id: 'Playfair Display', label: 'Playfair Display (Editorial)', css: '"Playfair Display", Georgia, serif' },
  { id: 'Instrument Serif', label: 'Instrument Serif (Apple)', css: '"Instrument Serif", Georgia, serif' },
  { id: 'Oswald', label: 'Oswald (Manchete)', css: '"Oswald", "Arial Narrow", sans-serif' },
  { id: 'Space Grotesk', label: 'Space Grotesk (Infográfico)', css: '"Space Grotesk", Inter, sans-serif' }
];

const POWER_HIGHLIGHTS = new Set([
  'segredo', 'segredos', 'truque', 'pare', 'nunca', 'erro', 'erros',
  'verdade', 'mentira', 'ninguém', 'assim', 'agora', 'grátis', 'cuidado',
  'melhor', 'simples', 'rápido', 'fácil', 'isso', 'entenda', 'veja', 'razão',
  'perdendo', 'dinheiro', 'clientes', 'alerta', 'urgente', 'chega'
]);

export function getTemplateDefaultStyle(templateId = 'apple_light', accentColor = '#8B5CF6') {
  const accent = accentColor || '#8B5CF6';
  switch (templateId) {
    case 'apple_dark':
      return {
        fontFamily: 'Inter',
        fontSize: 88,
        color: '#F5F5F7',
        bold: true,
        italic: false,
        underline: false,
        letterSpacing: -1,
        lineHeight: 1.18,
        textTransform: 'none',
        strokeColor: '#000000',
        strokeWidth: 0,
        badgeColor: '#FFFFFF',
        badgeOpacity: 14,
        badgeTextColor: '#FFFFFF'
      };
    case 'mrbeast':
      return {
        fontFamily: 'Anton',
        fontSize: 118,
        color: '#FFFFFF',
        bold: true,
        italic: false,
        underline: false,
        letterSpacing: 1,
        lineHeight: 1.05,
        textTransform: 'uppercase',
        strokeColor: '#000000',
        strokeWidth: 16,
        badgeColor: '#FFE600',
        badgeOpacity: 100,
        badgeTextColor: '#111111'
      };
    case 'jornal':
      return {
        fontFamily: 'Playfair Display',
        fontSize: 86,
        color: '#141414',
        bold: true,
        italic: false,
        underline: false,
        letterSpacing: -1,
        lineHeight: 1.12,
        textTransform: 'none',
        strokeColor: '#000000',
        strokeWidth: 0,
        badgeColor: '#C81E1E',
        badgeOpacity: 100,
        badgeTextColor: '#FFFFFF'
      };
    case 'netflix':
      return {
        fontFamily: 'Bebas Neue',
        fontSize: 116,
        color: '#FFFFFF',
        bold: true,
        italic: false,
        underline: false,
        letterSpacing: 4,
        lineHeight: 1.04,
        textTransform: 'uppercase',
        strokeColor: '#000000',
        strokeWidth: 3,
        badgeColor: '#E50914',
        badgeOpacity: 95,
        badgeTextColor: '#FFFFFF'
      };
    case 'premium':
      return {
        fontFamily: 'Playfair Display',
        fontSize: 82,
        color: '#F7F1E5',
        bold: false,
        italic: false,
        underline: false,
        letterSpacing: 2,
        lineHeight: 1.28,
        textTransform: 'none',
        strokeColor: '#000000',
        strokeWidth: 0,
        badgeColor: '#D4AF37',
        badgeOpacity: 20,
        badgeTextColor: '#F3E3B6'
      };
    case 'influencer':
      return {
        fontFamily: 'Montserrat',
        fontSize: 92,
        color: '#FFFFFF',
        bold: true,
        italic: false,
        underline: false,
        letterSpacing: -1,
        lineHeight: 1.12,
        textTransform: 'uppercase',
        strokeColor: '#000000',
        strokeWidth: 4,
        badgeColor: accent,
        badgeOpacity: 92,
        badgeTextColor: '#FFFFFF'
      };
    case 'infografico':
      return {
        fontFamily: 'Space Grotesk',
        fontSize: 80,
        color: '#F8FAFC',
        bold: true,
        italic: false,
        underline: false,
        letterSpacing: -1,
        lineHeight: 1.16,
        textTransform: 'none',
        strokeColor: '#000000',
        strokeWidth: 0,
        badgeColor: '#38BDF8',
        badgeOpacity: 92,
        badgeTextColor: '#09111F'
      };
    case 'apple_light':
    default:
      return {
        fontFamily: 'Inter',
        fontSize: 88,
        color: '#1D1D1F',
        bold: true,
        italic: false,
        underline: false,
        letterSpacing: -1,
        lineHeight: 1.18,
        textTransform: 'none',
        strokeColor: '#000000',
        strokeWidth: 0,
        badgeColor: '#FFFFFF',
        badgeOpacity: 88,
        badgeTextColor: '#1D1D1F'
      };
  }
}

function getFontCss(fontFamily = 'Inter') {
  const found = COVER_FONTS.find((f) => f.id === fontFamily);
  return found ? found.css : `${fontFamily}, Inter, -apple-system, sans-serif`;
}

function hexToRgb(hex = '#8B5CF6') {
  const clean = String(hex || '#8B5CF6').replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return { r: 139, g: 92, b: 246 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function hexToRgba(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex);
  const a = Math.max(0, Math.min(1, Number(alpha)));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function getContrastTextColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#111111' : '#FFFFFF';
}

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
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function applyTextTransform(str, transform = 'none') {
  const s = String(str || '');
  if (transform === 'uppercase') return s.toUpperCase();
  if (transform === 'lowercase') return s.toLowerCase();
  if (transform === 'capitalize') {
    return s.replace(/(^|\s)([a-zà-öø-ÿ])/gi, (m, p1, p2) => p1 + p2.toUpperCase());
  }
  return s;
}

function buildFontSpec({ fontFamily = 'Inter', fontSize = 84, bold = true, italic = false }) {
  const style = italic ? 'italic' : 'normal';
  const isDisplayHeavy = fontFamily === 'Anton' || fontFamily === 'Bebas Neue';
  const weight = isDisplayHeavy ? 400 : (bold ? 800 : 400);
  return `${style} ${weight} ${Math.round(fontSize)}px ${getFontCss(fontFamily)}`;
}

function measureTextWithSpacing(ctx, text, letterSpacing = 0) {
  const str = String(text || '');
  if (!str) return 0;
  if (!letterSpacing) return ctx.measureText(str).width;
  let total = 0;
  for (let i = 0; i < str.length; i++) {
    total += ctx.measureText(str[i]).width;
    if (i < str.length - 1) total += letterSpacing;
  }
  return total;
}

function drawTextWithSpacing(ctx, text, x, y, letterSpacing = 0, options = {}) {
  const str = String(text || '');
  if (!str) return 0;
  const {
    fillStyle = '#FFFFFF',
    strokeStyle = '#000000',
    strokeWidth = 0,
    underline = false,
    fontSize = 80
  } = options;

  const width = measureTextWithSpacing(ctx, str, letterSpacing);

  const renderPass = (isStroke) => {
    if (!letterSpacing) {
      if (isStroke) ctx.strokeText(str, x, y);
      else ctx.fillText(str, x, y);
      return;
    }
    let cx = x;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (isStroke) ctx.strokeText(ch, cx, y);
      else ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + letterSpacing;
    }
  };

  if (strokeWidth > 0) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = strokeStyle || '#000000';
    ctx.lineWidth = strokeWidth;
    renderPass(true);
    ctx.restore();
  }

  ctx.fillStyle = fillStyle;
  renderPass(false);

  if (underline && str.trim()) {
    ctx.save();
    ctx.strokeStyle = fillStyle;
    ctx.lineWidth = Math.max(4, Math.round(fontSize * 0.065));
    ctx.lineCap = 'round';
    const ulY = y + Math.round(fontSize * 0.14);
    ctx.beginPath();
    ctx.moveTo(x, ulY);
    ctx.lineTo(x + width, ulY);
    ctx.stroke();
    ctx.restore();
  }

  return width;
}

/**
 * Tokeniza a headline mantendo índices exatos de caracteres para cruzar com headlineSpans.
 */
function buildStyledWordTokens(rawHeadline, globalStyle, headlineSpans = [], templateMeta = {}) {
  const source = String(rawHeadline || '').trim() || 'DIGITE SUA HEADLINE VIRAL';
  const spans = Array.isArray(headlineSpans) ? headlineSpans : [];
  const regex = /(\S+|\n)/g;
  const tokens = [];
  let match;

  while ((match = regex.exec(source)) !== null) {
    const rawWord = match[0];
    const start = match.index;
    const end = start + rawWord.length;

    if (rawWord === '\n') {
      tokens.push({ isBreak: true });
      continue;
    }

    // Encontra o último span que sobrepõe esta palavra
    let matchedSpan = null;
    for (const sp of spans) {
      if (typeof sp?.start === 'number' && typeof sp?.end === 'number' && sp.end > start && sp.start < end) {
        matchedSpan = sp;
      }
    }

    const normalized = rawWord.toLowerCase().replace(/[^a-záéíóúâêôãõç]/gi, '');
    const isAutoPower = !matchedSpan && (
      POWER_HIGHLIGHTS.has(normalized) ||
      (rawWord === rawWord.toUpperCase() && rawWord.length >= 4 && globalStyle.textTransform === 'none')
    );

    const displayWord = applyTextTransform(rawWord, globalStyle.textTransform);
    const sizeScale = matchedSpan?.sizeScale ? (Number(matchedSpan.sizeScale) / 100) : (isAutoPower && templateMeta.powerScale ? templateMeta.powerScale : 1);

    let fontFamily = globalStyle.fontFamily;
    let bold = Boolean(globalStyle.bold);
    let italic = Boolean(globalStyle.italic);
    let underline = Boolean(globalStyle.underline);
    let color = globalStyle.color;
    let strokeColor = globalStyle.strokeColor || '#000000';
    let strokeWidth = Number(globalStyle.strokeWidth) || 0;
    let highlightBg = '';

    if (matchedSpan) {
      if (matchedSpan.color) color = matchedSpan.color;
      if (typeof matchedSpan.bold === 'boolean') bold = matchedSpan.bold;
      if (typeof matchedSpan.italic === 'boolean') italic = matchedSpan.italic;
      if (typeof matchedSpan.underline === 'boolean') underline = matchedSpan.underline;
      if (matchedSpan.strokeColor) strokeColor = matchedSpan.strokeColor;
      if (typeof matchedSpan.strokeWidth === 'number') strokeWidth = matchedSpan.strokeWidth;
      if (matchedSpan.highlightBg) highlightBg = matchedSpan.highlightBg;
    } else if (isAutoPower) {
      if (templateMeta.powerFontFamily) fontFamily = templateMeta.powerFontFamily;
      if (typeof templateMeta.powerItalic === 'boolean') italic = templateMeta.powerItalic;
      if (typeof templateMeta.powerBold === 'boolean') bold = templateMeta.powerBold;
      if (templateMeta.powerColor) color = templateMeta.powerColor;
      if (templateMeta.powerHighlightBg) highlightBg = templateMeta.powerHighlightBg;
    }

    tokens.push({
      isBreak: false,
      rawWord,
      word: displayWord,
      start,
      end,
      hasCustomSpan: Boolean(matchedSpan),
      isAutoPower,
      fontFamily,
      sizeScale,
      bold,
      italic,
      underline,
      color,
      strokeColor,
      strokeWidth,
      highlightBg
    });
  }

  return tokens;
}

function layoutStyledLines(ctx, tokens, baseFontSize, maxWidth, letterSpacing = 0) {
  const lines = [];
  let currentLine = [];
  let currentWidth = 0;

  const measureToken = (tok) => {
    const sz = Math.round(baseFontSize * (tok.sizeScale || 1));
    const font = buildFontSpec({
      fontFamily: tok.fontFamily,
      fontSize: sz,
      bold: tok.bold,
      italic: tok.italic
    });
    ctx.font = font;
    const wordW = measureTextWithSpacing(ctx, tok.word, letterSpacing);
    const spaceW = Math.max(ctx.measureText(' ').width, sz * 0.24) + (letterSpacing * 0.4);
    return { ...tok, fontSize: sz, font, wordW, spaceW };
  };

  for (const tok of tokens) {
    if (tok.isBreak) {
      if (currentLine.length) {
        lines.push({ items: currentLine, totalWidth: currentWidth });
        currentLine = [];
        currentWidth = 0;
      }
      continue;
    }

    const m = measureToken(tok);
    const prevSpace = currentLine.length ? currentLine[currentLine.length - 1].spaceW : 0;

    if (currentLine.length && (currentWidth + prevSpace + m.wordW > maxWidth)) {
      lines.push({ items: currentLine, totalWidth: currentWidth });
      currentLine = [m];
      currentWidth = m.wordW;
    } else {
      if (currentLine.length) currentWidth += prevSpace;
      currentLine.push(m);
      currentWidth += m.wordW;
    }
  }

  if (currentLine.length) {
    lines.push({ items: currentLine, totalWidth: currentWidth });
  }

  return lines.map((line) => {
    const maxFontSize = line.items.reduce((mx, it) => Math.max(mx, it.fontSize), baseFontSize);
    return { ...line, maxFontSize };
  });
}

function drawStyledHeadlineBlock(ctx, {
  rawHeadline,
  globalStyle,
  headlineSpans = [],
  templateMeta = {},
  x,
  y,
  maxWidth,
  maxLines = 5,
  align = 'center',
  shadow = null,
  verticalAnchor = 'center' // 'top' | 'center' | 'bottom'
}) {
  const tokens = buildStyledWordTokens(rawHeadline, globalStyle, headlineSpans, templateMeta);
  const letterSpacing = Number(globalStyle.letterSpacing) || 0;
  const lineHeightRatio = Number(globalStyle.lineHeight) || 1.16;

  let baseFontSize = Number(globalStyle.fontSize) || 88;
  // Auto-reduce slightly only if text overflows too many lines
  let lines = layoutStyledLines(ctx, tokens, baseFontSize, maxWidth, letterSpacing);
  let guard = 0;
  while ((lines.length > maxLines || lines.some((l) => l.totalWidth > maxWidth * 1.04)) && baseFontSize > 42 && guard < 18) {
    baseFontSize -= 5;
    lines = layoutStyledLines(ctx, tokens, baseFontSize, maxWidth, letterSpacing);
    guard++;
  }

  const lineHeights = lines.map((l) => Math.round(l.maxFontSize * lineHeightRatio));
  const totalHeight = lineHeights.reduce((sum, h) => sum + h, 0);

  let topY = y;
  if (verticalAnchor === 'center') topY = y - totalHeight / 2;
  else if (verticalAnchor === 'bottom') topY = y - totalHeight;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  let cursorY = topY;
  lines.forEach((line, idx) => {
    const lh = lineHeights[idx];
    const baselineY = cursorY + Math.round(line.maxFontSize * 0.86);

    let cursorX = x;
    if (align === 'center') {
      cursorX = x + (maxWidth - line.totalWidth) / 2;
    } else if (align === 'right') {
      cursorX = x + maxWidth - line.totalWidth;
    }

    line.items.forEach((item, wIdx) => {
      ctx.save();
      ctx.font = item.font;

      if (item.highlightBg) {
        ctx.save();
        ctx.fillStyle = item.highlightBg;
        const padX = 16;
        const padY = 10;
        drawRoundedRect(
          ctx,
          cursorX - padX,
          baselineY - item.fontSize * 0.86 - padY * 0.4,
          item.wordW + padX * 2,
          item.fontSize * 1.04 + padY,
          14
        );
        ctx.fill();
        ctx.restore();
      }

      if (shadow) {
        ctx.shadowColor = shadow.color || 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = shadow.blur ?? 14;
        ctx.shadowOffsetX = shadow.offsetX ?? 0;
        ctx.shadowOffsetY = shadow.offsetY ?? 5;
      }

      drawTextWithSpacing(ctx, item.word, cursorX, baselineY, letterSpacing, {
        fillStyle: item.color,
        strokeStyle: item.strokeColor,
        strokeWidth: item.strokeWidth,
        underline: item.underline,
        fontSize: item.fontSize
      });

      ctx.restore();
      cursorX += item.wordW + (wIdx < line.items.length - 1 ? item.spaceW : 0);
    });

    cursorY += lh;
  });

  return { topY, totalHeight, linesCount: lines.length, finalFontSize: baseFontSize };
}

/**
 * Desenha APENAS o plano de fundo base procedural (sem frames/textos/elementos gráficos)
 * ou completo dependendo de `backgroundOnly`.
 */
function drawBaseBackground(ctx, templateId, accentColor, backgroundOnly = false) {
  const accent = accentColor || '#8B5CF6';

  if (templateId === 'apple_light') {
    const base = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    base.addColorStop(0, '#FFFFFF');
    base.addColorStop(0.55, '#F5F5F7');
    base.addColorStop(1, '#EBEBF0');
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
    return;
  }

  if (templateId === 'apple_dark') {
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const orb1 = ctx.createRadialGradient(WIDTH * 0.2, HEIGHT * 0.24, 20, WIDTH * 0.2, HEIGHT * 0.24, 650);
    orb1.addColorStop(0, 'rgba(139, 92, 246, 0.24)');
    orb1.addColorStop(1, 'rgba(5, 5, 7, 0)');
    ctx.fillStyle = orb1;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const orb2 = ctx.createRadialGradient(WIDTH * 0.82, HEIGHT * 0.76, 20, WIDTH * 0.82, HEIGHT * 0.76, 680);
    orb2.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
    orb2.addColorStop(1, 'rgba(5, 5, 7, 0)');
    ctx.fillStyle = orb2;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return;
  }

  if (templateId === 'mrbeast') {
    const grad = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.45, 60, WIDTH * 0.5, HEIGHT * 0.45, 1150);
    grad.addColorStop(0, '#00D4FF');
    grad.addColorStop(0.5, '#0066FF');
    grad.addColorStop(1, '#081242');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (!backgroundOnly) {
      // Raios Sunburst característicos de alta energia
      ctx.save();
      ctx.translate(WIDTH / 2, HEIGHT * 0.46);
      const rays = 18;
      for (let i = 0; i < rays; i++) {
        const a1 = (i / rays) * Math.PI * 2;
        const a2 = ((i + 0.48) / rays) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 1450, a1, a2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fill();
      }
      ctx.restore();
    }
    return;
  }

  if (templateId === 'jornal') {
    const paper = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    paper.addColorStop(0, '#F7F3EA');
    paper.addColorStop(0.5, '#EFE9DC');
    paper.addColorStop(1, '#E6DEC9');
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return;
  }

  if (templateId === 'netflix') {
    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, '#160507');
    bg.addColorStop(0.45, '#0A0A0D');
    bg.addColorStop(1, '#030304');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const glow = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.25, 40, WIDTH * 0.5, HEIGHT * 0.25, 820);
    glow.addColorStop(0, 'rgba(229, 9, 20, 0.28)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return;
  }

  if (templateId === 'premium') {
    const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bg.addColorStop(0, '#141312');
    bg.addColorStop(0.55, '#0D0C0B');
    bg.addColorStop(1, '#1A1612');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const goldGlow = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.45, 30, WIDTH * 0.5, HEIGHT * 0.45, 760);
    goldGlow.addColorStop(0, 'rgba(212, 175, 55, 0.13)');
    goldGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = goldGlow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return;
  }

  if (templateId === 'influencer') {
    const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bg.addColorStop(0, '#1B1028');
    bg.addColorStop(0.5, '#2E1437');
    bg.addColorStop(1, '#0F0B1A');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const pop = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.34, 40, WIDTH * 0.5, HEIGHT * 0.34, 650);
    pop.addColorStop(0, hexToRgba(accent, 0.42));
    pop.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pop;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return;
  }

  if (templateId === 'infografico') {
    const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bg.addColorStop(0, '#0B1120');
    bg.addColorStop(0.5, '#0F172A');
    bg.addColorStop(1, '#090D1A');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const glow = ctx.createRadialGradient(WIDTH * 0.85, HEIGHT * 0.18, 20, WIDTH * 0.85, HEIGHT * 0.18, 650);
    glow.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
    glow.addColorStop(1, 'rgba(11, 17, 32, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return;
  }

  // Fallback genérico
  ctx.fillStyle = '#0F0E1B';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

export async function renderCoverCanvas(canvas, options = {}) {
  const {
    headline = 'O SEGREDO QUE NINGUÉM TE CONTOU',
    seriesName = 'SÉRIE VIRAL',
    partNumber = 1,
    handle = '@seuperfil',
    accentColor = '#8B5CF6',
    templateId = 'apple_light',
    bgDataUrl = '',
    showSafeZone = false,
    backgroundOnly = false,
    headlineStyle = {},
    headlineSpans = [],
    badgeStyle = {}
  } = options;

  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  // 1. Background layer (image or procedural base)
  let hasImageBg = false;
  if (bgDataUrl) {
    try {
      const img = await loadImage(bgDataUrl);
      const scale = Math.max(WIDTH / img.width, HEIGHT / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = (WIDTH - drawW) / 2;
      const dy = (HEIGHT - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);
      hasImageBg = true;
    } catch {
      drawBaseBackground(ctx, templateId, accentColor, backgroundOnly);
    }
  } else {
    drawBaseBackground(ctx, templateId, accentColor, backgroundOnly);
  }

  // MODO SOMENTE FUNDO: exibe exclusivamente o plano de fundo puro sem overlays, textos ou elementos
  if (Boolean(backgroundOnly)) {
    return canvas.toDataURL('image/png');
  }

  // Coordenadas da Área Segura 4:5 (1080x1350 centralizado no 1080x1920)
  const feedTop = (HEIGHT - 1350) / 2; // 285px
  const feedBottom = feedTop + 1350;   // 1635px

  const defaults = getTemplateDefaultStyle(templateId, accentColor);
  const effectiveStyle = {
    ...defaults,
    ...headlineStyle
  };

  // Se houver foto de fundo em estilos claros (Apple Light / Jornal) e o usuário não sobrescreveu a cor manualmente, garante contraste branco
  if (hasImageBg && (templateId === 'apple_light' || templateId === 'jornal') && !headlineStyle.colorOverride) {
    effectiveStyle.color = '#FFFFFF';
  }

  const badgeColor = badgeStyle.color || defaults.badgeColor;
  const badgeOpacity = typeof badgeStyle.opacity === 'number' ? badgeStyle.opacity : defaults.badgeOpacity;
  const badgeAlpha = Math.max(0, Math.min(1, badgeOpacity / 100));
  const badgeTextColor = badgeStyle.textColor && badgeStyle.textColor !== 'auto'
    ? badgeStyle.textColor
    : (badgeAlpha >= 0.45 ? getContrastTextColor(badgeColor) : (templateId === 'apple_light' && !hasImageBg ? '#1D1D1F' : (templateId === 'jornal' && !hasImageBg ? '#141414' : '#FFFFFF')));

  const pillText = `${String(seriesName || 'SÉRIE').toUpperCase().slice(0, 30)}  •  PARTE ${partNumber || 1}`;
  const cleanHandle = handle || '@seuperfil';

  // =========================================================================
  // RENDERIZAÇÃO ESPECÍFICA POR ESTILO (LAYOUT + COMPOSIÇÃO + ELEMENTOS)
  // =========================================================================

  if (templateId === 'apple_light' || templateId === 'apple_dark') {
    const isLight = templateId === 'apple_light' && !hasImageBg;

    if (hasImageBg) {
      const scrim = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      scrim.addColorStop(0, 'rgba(10,10,16,0.58)');
      scrim.addColorStop(0.5, 'rgba(10,10,16,0.44)');
      scrim.addColorStop(1, 'rgba(10,10,16,0.82)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else {
      // Moldura vidro fosco Apple
      ctx.save();
      ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.58)' : 'rgba(255, 255, 255, 0.045)';
      ctx.strokeStyle = isLight ? 'rgba(29, 29, 31, 0.08)' : 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 2.5;
      drawRoundedRect(ctx, 56, 330, WIDTH - 112, HEIGHT - 660, 56);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Selo pílula minimalista centralizado
    ctx.font = '600 28px Inter, -apple-system, sans-serif';
    const pillWidth = Math.min(ctx.measureText(pillText).width + 80, WIDTH - 140);
    const pillX = (WIDTH - pillWidth) / 2;
    const pillY = feedTop + 145;

    ctx.save();
    ctx.fillStyle = hexToRgba(badgeColor, badgeAlpha);
    ctx.strokeStyle = isLight ? 'rgba(29,29,31,0.14)' : 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, pillX, pillY, pillWidth, 68, 34);
    if (badgeAlpha > 0) ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = badgeTextColor;
    ctx.font = '600 28px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pillText, WIDTH / 2, pillY + 35, pillWidth - 44);

    // Headline centralizada com ênfase editorial Instrument Serif
    drawStyledHeadlineBlock(ctx, {
      rawHeadline: headline,
      globalStyle: effectiveStyle,
      headlineSpans,
      templateMeta: {
        powerFontFamily: 'Instrument Serif',
        powerItalic: true,
        powerBold: false,
        powerScale: 1.12,
        powerColor: isLight ? '#5B21B6' : '#DDD6FE'
      },
      x: 88,
      y: HEIGHT / 2 + 16,
      maxWidth: WIDTH - 176,
      maxLines: 5,
      align: 'center',
      verticalAnchor: 'center',
      shadow: isLight ? null : { color: 'rgba(0,0,0,0.45)', blur: 14, offsetY: 4 }
    });

    // Rodapé Apple limpo
    const footerY = feedBottom - 160;
    ctx.fillStyle = isLight ? 'rgba(29,29,31,0.88)' : 'rgba(255,255,255,0.9)';
    ctx.font = '600 32px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cleanHandle, WIDTH / 2, footerY);

    ctx.fillStyle = isLight ? 'rgba(29,29,31,0.55)' : 'rgba(255,255,255,0.6)';
    ctx.font = 'italic 400 30px "Instrument Serif", Georgia, serif';
    ctx.fillText('assista até o final', WIDTH / 2, footerY + 50);

  } else if (templateId === 'mrbeast') {
    // Vinheta agressiva + contraste alto
    if (hasImageBg) {
      const scrim = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.42, 160, WIDTH / 2, HEIGHT * 0.5, 1100);
      scrim.addColorStop(0, 'rgba(0,0,0,0.12)');
      scrim.addColorStop(0.65, 'rgba(0,0,0,0.52)');
      scrim.addColorStop(1, 'rgba(0,0,0,0.86)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else {
      const vig = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 260, WIDTH / 2, HEIGHT / 2, 1080);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Selo sticker inclinado com borda grossa preta e sombra dura 3D
    ctx.save();
    ctx.translate(WIDTH / 2, feedTop + 145);
    ctx.rotate(-0.035);
    ctx.font = '900 32px "Montserrat", Inter, sans-serif';
    const bW = Math.min(ctx.measureText(pillText).width + 96, WIDTH - 120);
    const bH = 78;
    // Sombra sólida offset
    ctx.fillStyle = '#000000';
    drawRoundedRect(ctx, -bW / 2 + 10, -bH / 2 + 10, bW, bH, 18);
    ctx.fill();
    // Corpo do selo
    ctx.fillStyle = hexToRgba(badgeColor, badgeAlpha);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    drawRoundedRect(ctx, -bW / 2, -bH / 2, bW, bH, 18);
    if (badgeAlpha > 0) ctx.fill();
    ctx.stroke();

    ctx.fillStyle = badgeTextColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pillText, 0, 2, bW - 36);
    ctx.restore();

    // Headline GIGANTE levemente inclinada, contorno grosso + sombra dura
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT * 0.56);
    ctx.rotate(-0.03);
    drawStyledHeadlineBlock(ctx, {
      rawHeadline: headline,
      globalStyle: effectiveStyle,
      headlineSpans,
      templateMeta: {
        powerColor: '#FFE600',
        powerScale: 1.12
      },
      x: -(WIDTH - 110) / 2,
      y: 0,
      maxWidth: WIDTH - 110,
      maxLines: 4,
      align: 'center',
      verticalAnchor: 'center',
      shadow: { color: 'rgba(0,0,0,0.92)', blur: 0, offsetX: 8, offsetY: 12 }
    });
    ctx.restore();

    // Faixa de impacto no rodapé dentro da área segura
    const ctaY = feedBottom - 150;
    ctx.save();
    ctx.fillStyle = '#000000';
    drawRoundedRect(ctx, WIDTH / 2 - 260 + 8, ctaY - 34 + 8, 520, 68, 16);
    ctx.fill();
    ctx.fillStyle = '#FF2D55';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    drawRoundedRect(ctx, WIDTH / 2 - 260, ctaY - 34, 520, 68, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 30px "Montserrat", Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${cleanHandle.toUpperCase()}  ▶`, WIDTH / 2, ctaY + 2);
    ctx.restore();

  } else if (templateId === 'jornal') {
    const isDarkPhoto = hasImageBg;
    const inkColor = isDarkPhoto ? '#FFFFFF' : '#141414';
    const mutedInk = isDarkPhoto ? 'rgba(255,255,255,0.72)' : 'rgba(20,20,20,0.68)';
    const ruleColor = isDarkPhoto ? 'rgba(255,255,255,0.35)' : '#141414';

    if (hasImageBg) {
      const scrim = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      scrim.addColorStop(0, 'rgba(12,12,14,0.78)');
      scrim.addColorStop(0.45, 'rgba(12,12,14,0.58)');
      scrim.addColorStop(1, 'rgba(12,12,14,0.92)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    const marginX = 76;
    const contentW = WIDTH - marginX * 2;
    const topMast = feedTop + 72;

    // Cabeçalho editorial estilo jornal (linhas duplas + masthead)
    ctx.fillStyle = ruleColor;
    ctx.fillRect(marginX, topMast, contentW, 8);
    ctx.fillRect(marginX, topMast + 14, contentW, 2);

    ctx.fillStyle = inkColor;
    ctx.font = '800 34px "Playfair Display", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('DIÁRIO VIRAL', marginX, topMast + 54);

    ctx.fillStyle = mutedInk;
    ctx.font = '700 22px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`EDIÇÃO Nº ${String(partNumber || 1).padStart(2, '0')}  •  EXCLUSIVO`, WIDTH - marginX, topMast + 54);

    ctx.fillStyle = ruleColor;
    ctx.fillRect(marginX, topMast + 88, contentW, 3);

    // Faixa informativa / Selo Breaking News à esquerda
    const ribbonY = topMast + 124;
    ctx.font = '800 26px "Oswald", Inter, sans-serif';
    const tagText = `URGENTE  •  ${String(seriesName || 'PLANTÃO').toUpperCase().slice(0, 28)}`;
    const tagW = Math.min(ctx.measureText(tagText).width + 56, contentW);
    ctx.save();
    ctx.fillStyle = hexToRgba(badgeColor, badgeAlpha);
    ctx.fillRect(marginX, ribbonY, tagW, 56);
    if (badgeAlpha < 0.25) {
      ctx.strokeStyle = ruleColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(marginX, ribbonY, tagW, 56);
    }
    ctx.restore();

    ctx.fillStyle = badgeTextColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, marginX + 24, ribbonY + 29, tagW - 40);

    // Barra vertical editorial à esquerda da manchete + Headline alinhada à ESQUERDA
    const headlineTop = ribbonY + 104;
    const hlResult = drawStyledHeadlineBlock(ctx, {
      rawHeadline: headline,
      globalStyle: effectiveStyle,
      headlineSpans,
      templateMeta: {
        powerColor: isDarkPhoto ? '#FDE047' : '#B91C1C',
        powerItalic: true
      },
      x: marginX + 26,
      y: headlineTop,
      maxWidth: contentW - 26,
      maxLines: 5,
      align: 'left',
      verticalAnchor: 'top',
      shadow: isDarkPhoto ? { color: 'rgba(0,0,0,0.65)', blur: 12, offsetY: 4 } : null
    });

    // Filete lateral da manchete
    ctx.fillStyle = hexToRgba(badgeColor, Math.max(0.75, badgeAlpha));
    ctx.fillRect(marginX, hlResult.topY + 6, 10, Math.max(120, hlResult.totalHeight - 12));

    // Linha editorial divisória + subtítulo/chamada jornalística
    const dividerY = Math.min(feedBottom - 235, hlResult.topY + hlResult.totalHeight + 48);
    ctx.fillStyle = ruleColor;
    ctx.fillRect(marginX, dividerY, contentW, 2);

    ctx.fillStyle = mutedInk;
    ctx.font = 'italic 400 32px "Playfair Display", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Reportagem rápida e análise direta ao ponto em menos de 60 segundos.', marginX, dividerY + 24, contentW);

    // Ticker inferior estilo noticiário
    const tickerY = feedBottom - 125;
    ctx.fillStyle = isDarkPhoto ? 'rgba(255,255,255,0.12)' : '#141414';
    ctx.fillRect(marginX, tickerY, contentW, 64);
    ctx.fillStyle = hexToRgba(badgeColor, Math.max(0.85, badgeAlpha));
    ctx.fillRect(marginX, tickerY, 16, 64);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 25px "Oswald", Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`AO VIVO  •  ${cleanHandle.toUpperCase()}`, marginX + 36, tickerY + 33);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText('ASSISTA AGORA ▶', WIDTH - marginX - 24, tickerY + 33);

  } else if (templateId === 'netflix') {
    // Vinheta cinematográfica dramática (deixa topo limpo para o rosto/cena!)
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, hasImageBg ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.2)');
    grad.addColorStop(0.36, 'rgba(0,0,0,0.08)');
    grad.addColorStop(0.58, 'rgba(0,0,0,0.68)');
    grad.addColorStop(0.82, 'rgba(0,0,0,0.92)');
    grad.addColorStop(1, 'rgba(0,0,0,0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Barras sutis de cinema no topo/base fora da área segura
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, WIDTH, 90);
    ctx.fillRect(0, HEIGHT - 90, WIDTH, 90);

    // Marcação "N SÉRIE ORIGINAL" no topo da área segura
    const topKickerY = feedTop + 70;
    ctx.fillStyle = '#E50914';
    ctx.font = '900 56px "Bebas Neue", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', WIDTH / 2 - 140, topKickerY);

    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '700 24px Inter, sans-serif';
    drawTextWithSpacing(ctx, 'SÉRIE ORIGINAL', WIDTH / 2 - 102, topKickerY + 8, 7, {
      fillStyle: 'rgba(255,255,255,0.88)',
      fontSize: 24
    });

    // Selo dramático acima da headline (terço inferior)
    const blockCenterY = feedBottom - 430;
    ctx.font = '700 26px Inter, sans-serif';
    const bW = Math.min(ctx.measureText(pillText).width + 64, WIDTH - 140);
    const bX = (WIDTH - bW) / 2;
    const bY = blockCenterY - 255;

    ctx.save();
    ctx.fillStyle = hexToRgba(badgeColor, badgeAlpha);
    drawRoundedRect(ctx, bX, bY, bW, 54, 8);
    if (badgeAlpha > 0) ctx.fill();
    if (badgeAlpha < 0.25) {
      ctx.strokeStyle = 'rgba(229,9,20,0.75)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = badgeTextColor;
    ctx.font = '700 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pillText, WIDTH / 2, bY + 28, bW - 28);

    // Headline cinematográfica dramática no terço inferior
    drawStyledHeadlineBlock(ctx, {
      rawHeadline: headline,
      globalStyle: effectiveStyle,
      headlineSpans,
      templateMeta: {
        powerColor: '#E50914',
        powerScale: 1.06
      },
      x: 78,
      y: blockCenterY + 20,
      maxWidth: WIDTH - 156,
      maxLines: 4,
      align: 'center',
      verticalAnchor: 'center',
      shadow: { color: 'rgba(0,0,0,0.95)', blur: 28, offsetY: 10 }
    });

    // Metadados estilo streaming + barra de progresso vermelha
    const metaY = feedBottom - 165;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '600 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`EPISÓDIO ${String(partNumber || 1).padStart(2, '0')}   •   4K ULTRA HD   •   ${cleanHandle}`, WIDTH / 2, metaY);

    // Barra de player Netflix
    const barW = WIDTH - 220;
    const barX = 110;
    const barY = metaY + 46;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    drawRoundedRect(ctx, barX, barY, barW, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#E50914';
    drawRoundedRect(ctx, barX, barY, barW * 0.34, 8, 4);
    ctx.fill();

  } else if (templateId === 'premium') {
    if (hasImageBg) {
      const scrim = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      scrim.addColorStop(0, 'rgba(10,9,8,0.68)');
      scrim.addColorStop(0.5, 'rgba(10,9,8,0.52)');
      scrim.addColorStop(1, 'rgba(10,9,8,0.86)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Moldura dupla hairline champagne/dourada dentro da área segura
    const gold = '#D4AF37';
    ctx.save();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.48)';
    ctx.lineWidth = 2;
    ctx.strokeRect(58, feedTop + 42, WIDTH - 116, 1350 - 84);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(74, feedTop + 58, WIDTH - 148, 1350 - 116);
    ctx.restore();

    // Selo sofisticado com filetes laterais
    const topBadgeY = feedTop + 175;
    ctx.font = '500 24px Inter, sans-serif';
    const bW = Math.min(measureTextWithSpacing(ctx, pillText, 4) + 74, WIDTH - 220);
    const bX = (WIDTH - bW) / 2;

    ctx.save();
    ctx.fillStyle = hexToRgba(badgeColor, badgeAlpha);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.55)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, bX, topBadgeY, bW, 56, 4);
    if (badgeAlpha > 0) ctx.fill();
    ctx.stroke();

    // Linhas ornamentais laterais
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.38)';
    ctx.beginPath();
    ctx.moveTo(116, topBadgeY + 28);
    ctx.lineTo(bX - 24, topBadgeY + 28);
    ctx.moveTo(bX + bW + 24, topBadgeY + 28);
    ctx.lineTo(WIDTH - 116, topBadgeY + 28);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = badgeTextColor;
    ctx.font = '500 22px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const measuredBadgeW = measureTextWithSpacing(ctx, pillText, 3);
    drawTextWithSpacing(ctx, pillText, (WIDTH - Math.min(measuredBadgeW, bW - 36)) / 2, topBadgeY + 34, 3, {
      fillStyle: badgeTextColor,
      fontSize: 22
    });

    // Headline com amplo respiro e sofisticação editorial
    drawStyledHeadlineBlock(ctx, {
      rawHeadline: headline,
      globalStyle: effectiveStyle,
      headlineSpans,
      templateMeta: {
        powerItalic: true,
        powerColor: '#E5C675'
      },
      x: 118,
      y: HEIGHT / 2 + 10,
      maxWidth: WIDTH - 236,
      maxLines: 5,
      align: 'center',
      verticalAnchor: 'center',
      shadow: { color: 'rgba(0,0,0,0.55)', blur: 18, offsetY: 6 }
    });

    // Ornamento geométrico losango + assinatura minimalista
    const ornY = feedBottom - 230;
    ctx.save();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 - 140, ornY);
    ctx.lineTo(WIDTH / 2 - 22, ornY);
    ctx.moveTo(WIDTH / 2 + 22, ornY);
    ctx.lineTo(WIDTH / 2 + 140, ornY);
    ctx.stroke();

    ctx.fillStyle = gold;
    ctx.translate(WIDTH / 2, ornY);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();

    const handleUpper = cleanHandle.toUpperCase();
    ctx.font = '500 24px Inter, sans-serif';
    const hw = measureTextWithSpacing(ctx, handleUpper, 6);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    drawTextWithSpacing(ctx, handleUpper, (WIDTH - hw) / 2, feedBottom - 142, 6, {
      fillStyle: 'rgba(247, 241, 229, 0.86)',
      fontSize: 24
    });

  } else if (templateId === 'influencer') {
    // Mantém os 52% superiores totalmente livres para o rosto! Degradê apenas na metade inferior
    if (hasImageBg) {
      const scrim = ctx.createLinearGradient(0, HEIGHT * 0.42, 0, HEIGHT);
      scrim.addColorStop(0, 'rgba(0,0,0,0)');
      scrim.addColorStop(0.45, 'rgba(10,8,20,0.62)');
      scrim.addColorStop(1, 'rgba(10,8,20,0.94)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, HEIGHT * 0.42, WIDTH, HEIGHT * 0.58);
    } else {
      // Silhueta sutil de enquadramento de estúdio no terço superior quando sem foto
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.arc(WIDTH / 2, feedTop + 340, 210, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Selo compacto flutuante no canto superior esquerdo (não tampa o rosto)
    const tagX = 68;
    const tagY = feedTop + 72;
    ctx.font = '800 24px "Montserrat", Inter, sans-serif';
    const shortTag = `${String(seriesName || 'REELS').toUpperCase().slice(0, 22)} • P.${partNumber || 1}`;
    const tagW = Math.min(ctx.measureText(shortTag).width + 58, WIDTH - 140);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = hexToRgba(badgeColor, badgeAlpha);
    drawRoundedRect(ctx, tagX, tagY, tagW, 58, 29);
    if (badgeAlpha > 0) ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = badgeTextColor;
    ctx.font = '800 24px "Montserrat", Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(shortTag, tagX + 28, tagY + 30, tagW - 44);

    // Headline curta e impactante ancorada no TERÇO INFERIOR com destaque marca-texto
    const hlAnchorY = feedBottom - 245;
    const hlInfo = drawStyledHeadlineBlock(ctx, {
      rawHeadline: headline,
      globalStyle: effectiveStyle,
      headlineSpans,
      templateMeta: {
        powerColor: '#111111',
        powerHighlightBg: '#FDE047',
        powerScale: 1.04
      },
      x: 92,
      y: hlAnchorY,
      maxWidth: WIDTH - 168,
      maxLines: 3,
      align: 'left',
      verticalAnchor: 'bottom',
      shadow: { color: 'rgba(0,0,0,0.7)', blur: 16, offsetY: 6 }
    });

    // Barra lateral vibrante acompanhando a altura exata da headline
    ctx.fillStyle = hexToRgba(badgeColor, Math.max(0.85, badgeAlpha));
    drawRoundedRect(ctx, 64, hlInfo.topY, 12, Math.max(84, hlInfo.totalHeight), 6);
    ctx.fill();

    // Rodapé Influencer: @handle com selo verificado + chamada
    const footY = feedBottom - 135;
    ctx.font = '700 30px "Montserrat", Inter, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(cleanHandle, 68, footY);

    const handleW = ctx.measureText(cleanHandle).width;
    // Ícone verificado azul estilizado
    ctx.save();
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(68 + handleW + 26, footY, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(68 + handleW + 19, footY);
    ctx.lineTo(68 + handleW + 24, footY + 5);
    ctx.lineTo(68 + handleW + 33, footY - 6);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = '600 24px "Montserrat", Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('ASSISTA AGORA →', WIDTH - 68, footY);

  } else if (templateId === 'infografico') {
    if (hasImageBg) {
      const scrim = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      scrim.addColorStop(0, 'rgba(9,13,26,0.76)');
      scrim.addColorStop(0.5, 'rgba(9,13,26,0.72)');
      scrim.addColorStop(1, 'rgba(9,13,26,0.9)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else {
      // Grade técnica pontilhada (dot matrix blueprint)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
      for (let gx = 48; gx < WIDTH; gx += 48) {
        for (let gy = 48; gy < HEIGHT; gy += 48) {
          ctx.beginPath();
          ctx.arc(gx, gy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const padX = 68;
    const cardW = WIDTH - padX * 2;
    const topY = feedTop + 88;

    // Cabeçalho modular: Bloco numérico [#01] + Selo da Série
    ctx.save();
    ctx.fillStyle = hexToRgba(badgeColor, badgeAlpha);
    drawRoundedRect(ctx, padX, topY, 118, 92, 22);
    if (badgeAlpha > 0) ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = badgeTextColor;
    ctx.font = '700 42px "Space Grotesk", Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`#${String(partNumber || 1).padStart(2, '0')}`, padX + 59, topY + 48);

    // Card do nome da série ao lado
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, padX + 136, topY, cardW - 136, 92, 22);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.font = '700 20px "Space Grotesk", Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('GUIA RÁPIDO  •  SÉRIE', padX + 166, topY + 32);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 28px "Space Grotesk", Inter, sans-serif';
    ctx.fillText(String(seriesName || 'ESTUDO PRÁTICO').toUpperCase().slice(0, 28), padX + 166, topY + 64, cardW - 190);
    ctx.restore();

    // Card Principal da Headline (estrutura modular)
    const mainCardY = topY + 130;
    const mainCardH = 590;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.26)';
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, padX, mainCardY, cardW, mainCardH, 32);
    ctx.fill();
    ctx.stroke();

    // Barra de acento superior do card
    ctx.fillStyle = hexToRgba(badgeColor, Math.max(0.8, badgeAlpha));
    drawRoundedRect(ctx, padX + 34, mainCardY + 34, 96, 10, 5);
    ctx.fill();
    ctx.restore();

    drawStyledHeadlineBlock(ctx, {
      rawHeadline: headline,
      globalStyle: effectiveStyle,
      headlineSpans,
      templateMeta: {
        powerColor: '#38BDF8'
      },
      x: padX + 42,
      y: mainCardY + mainCardH / 2 + 12,
      maxWidth: cardW - 84,
      maxLines: 5,
      align: 'left',
      verticalAnchor: 'center',
      shadow: { color: 'rgba(0,0,0,0.45)', blur: 10, offsetY: 4 }
    });

    // 3 Blocos Modulares Informativos abaixo da Headline
    const blocksY = mainCardY + mainCardH + 34;
    const gap = 18;
    const colW = (cardW - gap * 2) / 3;
    const infoBlocks = [
      { num: '01', label: 'DIAGNÓSTICO', sub: 'Entenda o erro' },
      { num: '02', label: 'MÉTODO', sub: 'Aplique hoje' },
      { num: '03', label: 'RESULTADO', sub: 'Salve o guia' }
    ];

    infoBlocks.forEach((blk, i) => {
      const bx = padX + i * (colW + gap);
      ctx.save();
      ctx.fillStyle = 'rgba(30, 41, 59, 0.78)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, bx, blocksY, colW, 178, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = hexToRgba(badgeColor, Math.max(0.85, badgeAlpha));
      ctx.font = '700 32px "Space Grotesk", Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(blk.num, bx + 24, blocksY + 24);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 22px "Space Grotesk", Inter, sans-serif';
      ctx.fillText(blk.label, bx + 24, blocksY + 78, colW - 40);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 20px Inter, sans-serif';
      ctx.fillText(blk.sub, bx + 24, blocksY + 114, colW - 40);
      ctx.restore();
    });

    // Barra de rodapé estruturada
    const footY = feedBottom - 122;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, padX, footY, cardW, 72, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 26px "Space Grotesk", Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(cleanHandle, padX + 28, footY + 37);

    ctx.fillStyle = '#38BDF8';
    ctx.textAlign = 'right';
    ctx.fillText('SALVE PARA CONSULTAR 🔖', WIDTH - padX - 28, footY + 37);
    ctx.restore();
  }

  // 5. Guia de Área Segura do Feed (4:5) — STRICTLY hidden on PNG export
  if (Boolean(showSafeZone)) {
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.setLineDash([16, 12]);
    ctx.lineWidth = 4;
    ctx.strokeRect(18, feedTop, WIDTH - 36, 1350);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.92)';
    ctx.font = '700 24px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('ÁREA SEGURA DO FEED (4:5) — NÃO CORTA NO PERFIL', 36, feedTop - 22);
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
