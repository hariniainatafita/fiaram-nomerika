import QRCode from 'qrcode';
import { Membre, Groupe, BadgeStyle, BadgeColors } from '../types';
import { StorageService } from './storage';

export interface BadgeStyleConfig {
  id: BadgeStyle;
  name: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  bgGradStart: string;
  bgGradMid: string;
  bgGradEnd: string;
  badgeBorder: string;
  textColor: string;
  subtextColor: string;
  pillColor: string;
  bannerBg: string;
  qrBg: string;
  patternType: 'waves' | 'hexagons' | 'diagonal' | 'circuit' | 'minimal';
}

export const BADGE_STYLES: BadgeStyleConfig[] = [
  {
    id: 'gold_royal',
    name: 'Classique',
    description: 'Cadre sobre, vagues élégantes et plaque numérotée',
    primaryColor: '#f59e0b',
    accentColor: '#d4af37',
    bgGradStart: '#101726',
    bgGradMid: '#0a1424',
    bgGradEnd: '#06101f',
    badgeBorder: '#c9a44e',
    textColor: '#ffffff',
    subtextColor: '#e2e8f0',
    pillColor: '#cfab57',
    bannerBg: 'rgba(212, 175, 55, 0.25)',
    qrBg: '#ffffff',
    patternType: 'waves'
  },
  {
    id: 'modern_emerald',
    name: 'Moderne',
    description: 'Géométrie douce, hexagones et composition contemporaine',
    primaryColor: '#10b981',
    accentColor: '#34d399',
    bgGradStart: '#06201a',
    bgGradMid: '#031713',
    bgGradEnd: '#020d0b',
    badgeBorder: '#10b981',
    textColor: '#ffffff',
    subtextColor: '#a7f3d0',
    pillColor: '#34d399',
    bannerBg: 'rgba(16, 185, 129, 0.25)',
    qrBg: '#ffffff',
    patternType: 'hexagons'
  },
  {
    id: 'crimson_prestige',
    name: 'Prestige',
    description: 'Diagonales dynamiques et présence affirmée',
    primaryColor: '#ef4444',
    accentColor: '#f87171',
    bgGradStart: '#25070d',
    bgGradMid: '#1a0408',
    bgGradEnd: '#0e0204',
    badgeBorder: '#dc2626',
    textColor: '#ffffff',
    subtextColor: '#fecaca',
    pillColor: '#f87171',
    bannerBg: 'rgba(239, 68, 68, 0.25)',
    qrBg: '#ffffff',
    patternType: 'diagonal'
  },
  {
    id: 'ocean_cyber',
    name: 'Techno',
    description: 'Circuits lumineux et lignes futuristes',
    primaryColor: '#38bdf8',
    accentColor: '#60a5fa',
    bgGradStart: '#051937',
    bgGradMid: '#00264d',
    bgGradEnd: '#001026',
    badgeBorder: '#0284c7',
    textColor: '#ffffff',
    subtextColor: '#bae6fd',
    pillColor: '#38bdf8',
    bannerBg: 'rgba(56, 189, 248, 0.25)',
    qrBg: '#ffffff',
    patternType: 'circuit'
  },
  {
    id: 'minimal_dark',
    name: 'Minimal',
    description: 'Lignes fines, espace respirant et look intemporel',
    primaryColor: '#e2e8f0',
    accentColor: '#94a3b8',
    bgGradStart: '#18181b',
    bgGradMid: '#0f0f11',
    bgGradEnd: '#09090b',
    badgeBorder: '#52525b',
    textColor: '#ffffff',
    subtextColor: '#cbd5e1',
    pillColor: '#a1a1aa',
    bannerBg: 'rgba(255, 255, 255, 0.1)',
    qrBg: '#ffffff',
    patternType: 'minimal'
  }
];

const normalizeHex = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }
  return fallback;
};

const parseHex = (hex: string): [number, number, number] => {
  const value = normalizeHex(hex, '#000000').slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  ];
};

const toHex = (r: number, g: number, b: number): string => {
  const part = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
};

const mixColors = (color: string, target: string, amount: number): string => {
  const [r1, g1, b1] = parseHex(color);
  const [r2, g2, b2] = parseHex(target);
  const ratio = Math.max(0, Math.min(1, amount));
  return toHex(
    r1 + (r2 - r1) * ratio,
    g1 + (g2 - g1) * ratio,
    b1 + (b2 - b1) * ratio
  );
};

const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getDefaultBadgeColors = (styleId?: BadgeStyle): BadgeColors => {
  const style = BADGE_STYLES.find(s => s.id === styleId) || BADGE_STYLES[0];
  return {
    primary: style.primaryColor,
    accent: style.accentColor,
    background: style.bgGradMid,
    text: style.textColor
  };
};

export const applyBadgeColors = (style: BadgeStyleConfig, colors?: BadgeColors): BadgeStyleConfig => {
  if (!colors) return style;

  const primary = normalizeHex(colors.primary, style.primaryColor);
  const accent = normalizeHex(colors.accent, style.accentColor);
  const background = normalizeHex(colors.background, style.bgGradMid);
  const text = normalizeHex(colors.text, style.textColor);

  return {
    ...style,
    primaryColor: primary,
    accentColor: accent,
    bgGradStart: mixColors(background, '#ffffff', 0.1),
    bgGradMid: background,
    bgGradEnd: mixColors(background, '#000000', 0.32),
    badgeBorder: accent,
    textColor: text,
    subtextColor: mixColors(text, background, 0.28),
    pillColor: accent,
    bannerBg: rgba(accent, 0.22),
    qrBg: '#ffffff'
  };
};

export const getBadgeConfig = (styleId?: BadgeStyle, colors?: BadgeColors): BadgeStyleConfig => {
  return applyBadgeColors(BADGE_STYLES.find(s => s.id === styleId) || BADGE_STYLES[0], colors);
};

const getHighQualityImageUrl = (src: string): string => {
  try {
    const url = new URL(src);
    if (url.hostname === 'images.unsplash.com') {
      url.searchParams.set('w', '1200');
      url.searchParams.set('q', '90');
      url.searchParams.set('auto', 'format');
    }
    return url.toString();
  } catch {
    return src;
  }
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => {
      const fallback = new Image();
      fallback.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      resolve(fallback);
    };
    img.src = getHighQualityImageUrl(src);
  });
};

const drawImageCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
): void => {
  if (!img.width || !img.height) return;
  const ratio = Math.max(width / img.width, height / img.height);
  const sourceWidth = width / ratio;
  const sourceHeight = height / ratio;
  const sourceX = (img.width - sourceWidth) / 2;
  const sourceY = (img.height - sourceHeight) / 2;
  ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
};

const fitText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  initialSize: number,
  weight: number,
  family = 'system-ui, sans-serif'
): void => {
  let size = initialSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 5 && ctx.measureText(text).width > maxWidth) {
    size -= 0.5;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  ctx.fillText(text, x, y);
};

const drawHexagon = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
): void => {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = cx + radius * Math.cos(angle);
    const py = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
};

const drawPattern = (
  ctx: CanvasRenderingContext2D,
  config: BadgeStyleConfig,
  w: number,
  h: number,
  sx: number,
  sy: number
): void => {
  ctx.save();
  ctx.strokeStyle = config.accentColor;
  ctx.lineWidth = Math.max(1, 1.2 * sx);
  ctx.globalAlpha = 0.4;

  if (config.patternType === 'waves') {
    ctx.globalAlpha = 0.42;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-20 * sx, (112 + i * 22) * sy);
      ctx.bezierCurveTo(
        w * 0.22, (92 + i * 22) * sy,
        w * 0.48, (176 + i * 22) * sy,
        w + 20 * sx, (136 + i * 22) * sy
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.7);
    ctx.bezierCurveTo(w * 0.35, h * 0.6, w * 0.72, h * 0.82, w, h * 0.66);
    ctx.stroke();
  } else if (config.patternType === 'hexagons') {
    ctx.globalAlpha = 0.22;
    drawHexagon(ctx, 44 * sx, 116 * sy, 30 * sx);
    drawHexagon(ctx, w - 42 * sx, 96 * sy, 22 * sx);
    drawHexagon(ctx, w - 68 * sx, h - 88 * sy, 34 * sx);
    drawHexagon(ctx, 52 * sx, h - 112 * sy, 20 * sx);
  } else if (config.patternType === 'diagonal') {
    ctx.globalAlpha = 0.24;
    for (let i = -h; i < w + h; i += 42 * sx) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h * 0.65, h);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = config.accentColor;
    ctx.beginPath();
    ctx.moveTo(w * 0.62, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h * 0.62);
    ctx.closePath();
    ctx.fill();
  } else if (config.patternType === 'circuit') {
    ctx.globalAlpha = 0.36;
    ctx.beginPath();
    ctx.moveTo(18 * sx, 88 * sy);
    ctx.lineTo(18 * sx, 202 * sy);
    ctx.lineTo(62 * sx, 246 * sy);
    ctx.lineTo(w - 24 * sx, 246 * sy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w - 18 * sx, h - 78 * sy);
    ctx.lineTo(w - 18 * sx, h - 148 * sy);
    ctx.lineTo(w - 68 * sx, h - 198 * sy);
    ctx.stroke();
    ctx.fillStyle = config.accentColor;
    const nodes = [
      { x: 18 * sx, y: 88 * sy },
      { x: 18 * sx, y: 202 * sy },
      { x: w - 18 * sx, y: h - 78 * sy },
      { x: w - 18 * sx, y: h - 148 * sy }
    ];
    nodes.forEach((node) => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 3 * sx, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = config.accentColor;
    ctx.fillRect(0, 0, w, 3 * sy);
    ctx.globalAlpha = 0.18;
    ctx.fillRect(w * 0.1, 12 * sy, w * 0.8, 1 * sy);
    ctx.fillRect(w * 0.1, h - 16 * sy, w * 0.8, 1 * sy);
  }

  ctx.restore();
};

export async function renderBadgeOnCanvas(
  ctx: CanvasRenderingContext2D,
  membre: Membre,
  groupe: Groupe | undefined,
  styleConfig: BadgeStyleConfig,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<void> {
  const sx = w / 320;
  const sy = h / 480;
  const fontSizeScale = Math.min(sx, sy);
  const settings = StorageService.getAdminSettings();
  const orgName = `${settings.chorale_sigle || 'GROUPE'} — ${settings.chorale_nom || 'Groupe'}`;
  const headerTitle = settings.titre_badge_defaut || 'MEMBRE OFFICIEL';

  ctx.save();
  ctx.translate(x, y);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const cornerRadius = 16 * Math.min(sx, sy);
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, cornerRadius);
  ctx.clip();

  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, styleConfig.bgGradStart);
  bgGrad.addColorStop(0.45, styleConfig.bgGradMid);
  bgGrad.addColorStop(1, styleConfig.bgGradEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  const vignette = ctx.createRadialGradient(w / 2, h * 0.2, 4 * fontSizeScale, w / 2, h * 0.2, w * 0.62);
  vignette.addColorStop(0, rgba(styleConfig.accentColor, 0.18));
  vignette.addColorStop(0.55, rgba(styleConfig.accentColor, 0.04));
  vignette.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h * 0.48);

  drawPattern(ctx, styleConfig, w, h, sx, sy);

  const photoW = 150 * sx;
  const photoH = 168 * sy;
  const photoX = (w - photoW) / 2;
  const photoY = 38 * sy;
  const photoRadius = 14 * Math.min(sx, sy);

  const photoUrl = membre.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400';
  try {
    const photoImg = await loadImage(photoUrl);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.clip();
    drawImageCover(ctx, photoImg, photoX, photoY, photoW, photoH);
    const photoShade = ctx.createLinearGradient(photoX, photoY, photoX, photoY + photoH);
    photoShade.addColorStop(0, 'rgba(0,0,0,0)');
    photoShade.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = photoShade;
    ctx.fillRect(photoX, photoY + photoH * 0.55, photoW, photoH * 0.45);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = styleConfig.accentColor;
    ctx.lineWidth = 2 * fontSizeScale;
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.stroke();
    ctx.restore();
  } catch (error) {
    console.warn('Photo load error', error);
  }

  ctx.save();
  ctx.fillStyle = styleConfig.accentColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  fitText(ctx, headerTitle.toUpperCase(), w / 2, 24 * sy, w - 56 * sx, 9.5 * fontSizeScale, 800);
  ctx.restore();

  const badgeNum = membre.numero_badge || membre.code_unique?.slice(-3) || '001';
  ctx.save();
  ctx.translate(w * 0.79, photoY + photoH * 0.76);
  ctx.rotate(-20 * (Math.PI / 180));
  ctx.fillStyle = styleConfig.bannerBg;
  ctx.strokeStyle = styleConfig.accentColor;
  ctx.lineWidth = 1.5 * fontSizeScale;
  ctx.beginPath();
  ctx.roundRect(-43 * sx, -12 * sy, 86 * sx, 24 * sy, 6 * fontSizeScale);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = styleConfig.textColor;
  ctx.font = `900 ${12 * fontSizeScale}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 4 * fontSizeScale;
  ctx.fillText(`N° ${badgeNum}`, 0, 0);
  ctx.restore();

  const fullName = `${membre.nom} ${membre.prenom}`.toUpperCase();
  const cinText = `CIN : ${(membre.cin || '—').replace('CIN:', '').replace('CIN :', '').trim()}`;
  const profText = (membre.profession || 'MEMBRE').toUpperCase();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = styleConfig.textColor;
  fitText(ctx, fullName, w / 2, 230 * sy, w - 44 * sx, 13.5 * fontSizeScale, 800);

  ctx.fillStyle = styleConfig.subtextColor;
  fitText(ctx, cinText, w / 2, 248 * sy, w - 58 * sx, 10.5 * fontSizeScale, 700);

  ctx.fillStyle = styleConfig.accentColor;
  fitText(ctx, profText, w / 2, 266 * sy, w - 54 * sx, 11 * fontSizeScale, 800);

  const grpName = groupe?.nom_groupe || 'Groupe';
  const pillW = Math.min(190 * sx, w - 64 * sx);
  const pillH = 20 * sy;
  const pillY = 278 * sy;
  ctx.fillStyle = rgba(styleConfig.textColor, 0.08);
  ctx.strokeStyle = styleConfig.accentColor;
  ctx.lineWidth = 1 * fontSizeScale;
  ctx.beginPath();
  ctx.roundRect((w - pillW) / 2, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = styleConfig.textColor;
  fitText(ctx, grpName, w / 2, pillY + 13.5 * sy, pillW - 20 * sx, 9.5 * fontSizeScale, 700);
  ctx.restore();

  const qrSize = 116 * fontSizeScale;
  const qrX = (w - qrSize) / 2;
  const qrY = 310 * sy;

  ctx.save();
  ctx.fillStyle = styleConfig.qrBg;
  ctx.beginPath();
  ctx.roundRect(qrX, qrY, qrSize, qrSize, 11 * fontSizeScale);
  ctx.fill();
  ctx.strokeStyle = styleConfig.accentColor;
  ctx.lineWidth = 1.8 * fontSizeScale;
  ctx.stroke();

  try {
    const qrDataUrl = await QRCode.toDataURL(membre.code_unique || 'GRP-2026-000', {
      margin: 1,
      width: Math.round(qrSize - 14 * fontSizeScale),
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
    const qrImg = await loadImage(qrDataUrl);
    const qrInset = 7 * fontSizeScale;
    ctx.drawImage(qrImg, qrX + qrInset, qrY + qrInset, qrSize - qrInset * 2, qrSize - qrInset * 2);
  } catch (qrError) {
    console.warn('QR code gen error', qrError);
  }
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = styleConfig.accentColor;
  ctx.font = `800 ${11.5 * fontSizeScale}px monospace, sans-serif`;
  ctx.fillText(membre.code_unique || 'GRP-2026-000', w / 2, 442 * sy);

  ctx.fillStyle = styleConfig.subtextColor;
  ctx.font = `600 ${8 * fontSizeScale}px system-ui, sans-serif`;
  fitText(ctx, orgName.toUpperCase(), w / 2, 458 * sy, w - 40 * sx, 8 * fontSizeScale, 600);
  ctx.restore();

  ctx.strokeStyle = styleConfig.badgeBorder;
  ctx.lineWidth = 3 * fontSizeScale;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, cornerRadius);
  ctx.stroke();

  ctx.restore();
}

export async function renderBadgeDataUrl(
  membre: Membre,
  groupe: Groupe | undefined,
  styleId: BadgeStyle,
  colors?: BadgeColors,
  scale = 2
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 320 * scale;
  canvas.height = 480 * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  await renderBadgeOnCanvas(
    ctx,
    membre,
    groupe,
    getBadgeConfig(styleId, colors),
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas.toDataURL('image/png');
}

const A4_WIDTH = 2480;
const A4_HEIGHT = 3508;
const A4_MARGIN_X = 272;
const A4_START_Y = 224;
const A4_GAP = 48;
const BADGE_WIDTH = 944;
const BADGE_HEIGHT = 1416;
const BADGES_PER_PAGE = 4;

const drawA4Base = (
  ctx: CanvasRenderingContext2D,
  styleConfig: BadgeStyleConfig,
  pageNumber: number,
  pageCount: number,
  badgeCount: number
): void => {
  const settings = StorageService.getAdminSettings();
  const orgName = `${settings.chorale_sigle || 'GROUPE'} — ${settings.chorale_nom || 'Groupe'}`;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PLANCHE DE BADGES - FORMAT A4', A4_MARGIN_X, 96);

  ctx.fillStyle = '#64748b';
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText(
    `${orgName} • Modèle ${styleConfig.name} • 4 badges 8 × 12 cm • 300 DPI • Page ${pageNumber}/${pageCount}`,
    A4_MARGIN_X,
    144
  );

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(A4_MARGIN_X, 176);
  ctx.lineTo(A4_WIDTH - A4_MARGIN_X, 176);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${badgeCount} badge(s) sur cette page • Découper suivant les pointillés`,
    A4_WIDTH / 2,
    A4_HEIGHT - 56
  );
};

export async function generateA4BadgePages(
  membres: Membre[],
  groupes: Groupe[],
  styleConfig: BadgeStyleConfig
): Promise<HTMLCanvasElement[]> {
  const pages: HTMLCanvasElement[] = [];
  const pageCount = Math.max(1, Math.ceil(membres.length / BADGES_PER_PAGE));

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const pageMembers = membres.slice(
      pageIndex * BADGES_PER_PAGE,
      pageIndex * BADGES_PER_PAGE + BADGES_PER_PAGE
    );

    const canvas = document.createElement('canvas');
    canvas.width = A4_WIDTH;
    canvas.height = A4_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    drawA4Base(ctx, styleConfig, pageIndex + 1, pageCount, pageMembers.length);

    for (let index = 0; index < pageMembers.length; index++) {
      const membre = pageMembers[index];
      const groupe = groupes.find(g => g.id === membre.groupe_id);
      const column = index % 2;
      const row = Math.floor(index / 2);
      const posX = A4_MARGIN_X + column * (BADGE_WIDTH + A4_GAP);
      const posY = A4_START_Y + row * (BADGE_HEIGHT + A4_GAP);

      ctx.save();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 8]);
      ctx.strokeRect(posX - 10, posY - 10, BADGE_WIDTH + 20, BADGE_HEIGHT + 20);
      ctx.restore();

      await renderBadgeOnCanvas(ctx, membre, groupe, styleConfig, posX, posY, BADGE_WIDTH, BADGE_HEIGHT);
    }

    pages.push(canvas);
  }

  return pages;
}

export async function generateA4BadgesCanvas(
  membres: Membre[],
  groupes: Groupe[],
  styleConfig: BadgeStyleConfig
): Promise<HTMLCanvasElement> {
  const pages = await generateA4BadgePages(membres, groupes, styleConfig);
  if (pages.length > 0) return pages[0];

  const emptyCanvas = document.createElement('canvas');
  emptyCanvas.width = A4_WIDTH;
  emptyCanvas.height = A4_HEIGHT;
  return emptyCanvas;
}
