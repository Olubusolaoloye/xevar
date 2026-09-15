/**
 * Shareable PNG card rendering.
 *
 * Drawn on a canvas rather than screenshotting DOM: no extra dependency, exact
 * output dimensions, and it works identically regardless of the viewer's theme
 * or screen. Cards are 1200×675 — the 16:9 that X, Telegram and Discord all
 * render without cropping.
 */

export interface CardTheme {
  bg: string;
  panel: string;
  ink: string;
  inkLow: string;
  brand: string;
  up: string;
  down: string;
}

/** Card colours, fixed rather than read from the theme. */
export const CARD_THEME: CardTheme = {
  bg: '#0e0c0a',
  panel: '#16130f',
  ink: '#f7f3ea',
  inkLow: '#857c6d',
  brand: '#f4c22c',
  up: '#1dbf63',
  down: '#e03540',
};

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 675;

/**
 * Where the PanScreener mark lives.
 *
 * Built from BASE_URL rather than hardcoded, because the app is served from a
 * subpath on GitHub Pages and from the root on Netlify — a leading-slash path
 * would 404 on one of them.
 */
export function brandMarkUrl(): string {
  return `${import.meta.env.BASE_URL}panlogo-mark.png`;
}

/**
 * Load one image, with CORS, once.
 *
 * Requests CORS explicitly: without it a remote logo taints the canvas and
 * `toBlob` throws, which would break the whole card over a decoration.
 */
function attemptLoad(url: string, timeoutMs: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
    // Never let a hanging request block the download.
    setTimeout(() => resolve(null), timeoutMs);
  });
}

/**
 * Load an image for canvas use, working around the HTTP cache.
 *
 * The retry is the point. Every token logo on this page has already been
 * fetched by an ordinary `<img>` in the avatar beside the price — a request
 * sent *without* CORS, whose response the browser then caches without the
 * `Access-Control-Allow-Origin` header it never asked for. When the card asks
 * for that same URL with `crossOrigin`, the browser serves the cached copy,
 * finds no CORS header on it, and fails the load. The image is fine, the
 * server is fine, and the card silently falls back to a monogram — which is
 * exactly the "the logo does not show" people report.
 *
 * So a failure is retried once with a cache-busting parameter, which forces a
 * fresh request that does carry the CORS headers. Only if that also fails is
 * the logo genuinely unavailable, and the caller draws a monogram.
 */
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  const direct = await attemptLoad(url, 4000);
  if (direct) return direct;
  return attemptLoad(withCacheBust(url), 4000);
}

/**
 * Add a parameter that defeats the HTTP cache.
 *
 * Separated out and exported because getting the separator wrong is silent:
 * token logo URLs already carry a query string (`…/bsc/0xabc.png?key=…`), and
 * appending a second `?` produces a URL the CDN answers with a 400 — so the
 * retry would fail for exactly the images it exists to rescue.
 */
export function withCacheBust(url: string, now = Date.now()): string {
  return `${url}${url.includes('?') ? '&' : '?'}cors=${now}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Deterministic fallback mark, matching the in-app avatar's logic. */
function drawMonogram(
  ctx: CanvasRenderingContext2D,
  symbol: string,
  x: number,
  y: number,
  size: number,
) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;

  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, `hsl(${hue} 62% 46%)`);
  gradient.addColorStop(1, `hsl(${(hue + 48) % 360} 58% 32%)`);

  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, size, size);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `700 ${size * 0.32}px "Space Grotesk", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol.slice(0, 3).toUpperCase(), x + size / 2, y + size / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

export interface CardContent {
  /** Small line above the headline. */
  eyebrow: string;
  /** The number the card exists to show. */
  headline: string;
  /** Colour for the headline. */
  headlineTone: 'up' | 'down' | 'brand' | 'ink';
  /** Up to four label/value pairs along the bottom. */
  stats: Array<{ label: string; value: string }>;
  tokenSymbol: string;
  tokenName: string;
  chainLabel: string;
  logoUrl?: string;
  /** Small print, e.g. the disclaimer. */
  footnote?: string;
}

/** Render a card and return it as a PNG blob. */
export async function renderCard(content: CardContent): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable in this browser.');

  const t = CARD_THEME;

  // Ground
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Brand bloom, echoing the app's aurora
  const bloom = ctx.createRadialGradient(180, 90, 0, 180, 90, 620);
  bloom.addColorStop(0, 'rgba(244,194,44,0.20)');
  bloom.addColorStop(1, 'rgba(244,194,44,0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Hairline grid
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CARD_WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < CARD_HEIGHT; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_WIDTH, y);
    ctx.stroke();
  }

  const PAD = 72;

  // Token identity
  const logo = content.logoUrl ? await loadImage(content.logoUrl) : null;
  const LOGO = 84;

  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(PAD + LOGO / 2, PAD + LOGO / 2, LOGO / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logo, PAD, PAD, LOGO, LOGO);
    ctx.restore();
  } else {
    drawMonogram(ctx, content.tokenSymbol, PAD, PAD, LOGO);
  }

  ctx.fillStyle = t.ink;
  ctx.font = '700 40px "Space Grotesk", system-ui, sans-serif';
  ctx.fillText(content.tokenSymbol, PAD + LOGO + 24, PAD + 36);

  ctx.fillStyle = t.inkLow;
  ctx.font = '400 22px Inter, system-ui, sans-serif';
  ctx.fillText(
    `${content.tokenName} · ${content.chainLabel}`,
    PAD + LOGO + 24,
    PAD + 68,
  );

  // Eyebrow
  ctx.fillStyle = t.brand;
  ctx.font = '600 22px Inter, system-ui, sans-serif';
  ctx.fillText(content.eyebrow.toUpperCase(), PAD, 246);

  // Headline — the reason the card exists
  const tone =
    content.headlineTone === 'up'
      ? t.up
      : content.headlineTone === 'down'
        ? t.down
        : content.headlineTone === 'brand'
          ? t.brand
          : t.ink;
  ctx.fillStyle = tone;
  ctx.font = '700 118px "Space Grotesk", system-ui, sans-serif';
  ctx.fillText(content.headline, PAD, 356);

  // Stats strip
  const stats = content.stats.slice(0, 4);
  if (stats.length > 0) {
    const boxY = 420;
    const boxH = 116;
    const boxW = (CARD_WIDTH - PAD * 2 - (stats.length - 1) * 16) / stats.length;

    stats.forEach((stat, i) => {
      const x = PAD + i * (boxW + 16);
      ctx.fillStyle = t.panel;
      roundRect(ctx, x, boxY, boxW, boxH, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.stroke();

      ctx.fillStyle = t.inkLow;
      ctx.font = '600 17px Inter, system-ui, sans-serif';
      ctx.fillText(stat.label.toUpperCase(), x + 22, boxY + 42);

      ctx.fillStyle = t.ink;
      ctx.font = '700 34px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillText(stat.value, x + 22, boxY + 86);
    });
  }

  /* Footer: the PanScreener mark, then the wordmark beside it.

     The real logo rather than the word alone. These cards are made to be
     posted somewhere else, stripped of the page they came from, and a card
     that only says "PanScreener" in text is a card nobody recognises at
     thumbnail size in a timeline.

     Loaded from the app's own origin, so unlike a token logo there is no CORS
     question and no cache trap — but it is still allowed to fail, and the
     wordmark simply shifts left if it does. A missing brand mark must never
     cost somebody their card. */
  const markSize = 34;
  const baseline = CARD_HEIGHT - 52;
  const mark = await loadImage(brandMarkUrl());
  let wordmarkX = PAD;

  if (mark) {
    // drawImage takes the top-left corner; the text is positioned by its
    // baseline, so the mark is nudged up to sit centred on the same line.
    ctx.drawImage(mark, PAD, baseline - markSize + 6, markSize, markSize);
    wordmarkX = PAD + markSize + 12;
  }

  ctx.fillStyle = t.brand;
  ctx.font = '700 26px "Space Grotesk", system-ui, sans-serif';
  ctx.fillText('PanScreener', wordmarkX, baseline);

  if (content.footnote) {
    ctx.fillStyle = t.inkLow;
    ctx.font = '400 17px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(content.footnote, CARD_WIDTH - PAD, baseline);
    ctx.textAlign = 'left';
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('The card could not be encoded.')),
      'image/png',
    );
  });
}

/** Save a rendered card to the viewer's device. */
export function downloadCard(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Open X's composer with the text prefilled.
 *
 * The image cannot be attached programmatically — X's web intent accepts text
 * and a URL only, and no site can put a file into another site's composer. So
 * the card is downloaded first and the caller tells the user to attach it,
 * which is the honest version of "share to X" for a web app.
 */
export function openXComposer(text: string) {
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
