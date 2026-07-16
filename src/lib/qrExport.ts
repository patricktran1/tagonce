export interface QrExportMeta {
  displayName: string;
  subtitle?: string;
  modeLabel: string;
  eventName?: string;
  eventTime?: string;
  eventLocation?: string;
}

function safeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

export function qrExportFilename(meta: QrExportMeta, extension: 'png' | 'svg') {
  const context = meta.eventName || meta.modeLabel || 'card';
  const stem = [safeSlug(meta.displayName), safeSlug(context), 'tagonce-qr'].filter(Boolean).join('-');
  return `${stem || 'tagonce-qr'}.${extension}`;
}

function svgMarkup(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '1024');
  clone.setAttribute('height', '1024');
  return new XMLSerializer().serializeToString(clone);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadQrSvg(svg: SVGSVGElement, meta: QrExportMeta) {
  const blob = new Blob([svgMarkup(svg)], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, qrExportFilename(meta, 'svg'));
}

function loadSvgImage(svg: SVGSVGElement) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const blob = new Blob([svgMarkup(svg)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The QR image could not be rendered.'));
    };
    image.src = url;
  });
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function fitText(context: CanvasRenderingContext2D, value: string, maxWidth: number, initialSize: number, weight = 700) {
  let size = initialSize;
  while (size > 28) {
    context.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    if (context.measureText(value).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

export async function createBrandedQrPng(svg: SVGSVGElement, meta: QrExportMeta) {
  const image = await loadSvgImage(svg);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1600;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot create the QR image.');

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#1b1422');
  gradient.addColorStop(0.58, '#33213e');
  gradient.addColorStop(1, '#5d3d67');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.beginPath();
  context.arc(1030, 170, 235, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#ffffff';
  roundedRect(context, 72, 72, 1056, 1456, 54);
  context.fill();

  context.fillStyle = '#7050d8';
  context.font = '800 30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText('TAGONCE', 130, 150);

  context.fillStyle = '#261d2c';
  const nameSize = fitText(context, meta.displayName || 'Your name', 940, 72, 780);
  context.font = `780 ${nameSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  context.fillText(meta.displayName || 'Your name', 130, 248);

  const subtitle = meta.subtitle?.trim() || meta.modeLabel;
  context.fillStyle = '#766c7b';
  context.font = '500 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText(subtitle.slice(0, 70), 130, 302);

  if (meta.eventName) {
    context.fillStyle = '#f1ecff';
    roundedRect(context, 130, 338, 940, 116, 28);
    context.fill();
    context.fillStyle = '#4f3696';
    context.font = '760 30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText(meta.eventName.slice(0, 58), 165, 386);
    context.fillStyle = '#6f6280';
    context.font = '500 23px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const detail = [meta.eventTime, meta.eventLocation].filter(Boolean).join(' · ');
    if (detail) context.fillText(detail.slice(0, 78), 165, 424);
  }

  const qrX = 180;
  const qrY = meta.eventName ? 500 : 402;
  const qrSize = 840;
  context.fillStyle = '#ffffff';
  context.shadowColor = 'rgba(35, 24, 43, 0.16)';
  context.shadowBlur = 32;
  context.shadowOffsetY = 14;
  roundedRect(context, qrX - 28, qrY - 28, qrSize + 56, qrSize + 56, 36);
  context.fill();
  context.shadowColor = 'transparent';
  context.drawImage(image, qrX, qrY, qrSize, qrSize);

  context.fillStyle = '#33283a';
  context.font = '760 30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.textAlign = 'center';
  context.fillText('Scan to connect', canvas.width / 2, 1422);
  context.fillStyle = '#8a808e';
  context.font = '500 23px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText(`${meta.modeLabel} card · tagonce.vercel.app`, canvas.width / 2, 1462);
  context.textAlign = 'start';

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The QR image could not be created.'));
    }, 'image/png', 0.96);
  });
}

export async function downloadQrPng(svg: SVGSVGElement, meta: QrExportMeta) {
  const blob = await createBrandedQrPng(svg, meta);
  triggerDownload(blob, qrExportFilename(meta, 'png'));
}

export async function shareQr(
  svg: SVGSVGElement,
  meta: QrExportMeta,
  shareUrl: string,
) {
  const blob = await createBrandedQrPng(svg, meta);
  const file = new File([blob], qrExportFilename(meta, 'png'), { type: 'image/png' });
  const shareData: ShareData = {
    title: `${meta.displayName} · TagOnce`,
    text: meta.eventName ? `${meta.displayName}'s card for ${meta.eventName}` : `${meta.displayName}'s TagOnce card`,
    url: shareUrl,
  };
  const navigatorWithFiles = navigator as Navigator & { canShare?: (data: ShareData) => boolean };

  if (navigator.share && navigatorWithFiles.canShare?.({ files: [file] })) {
    await navigator.share({ ...shareData, files: [file] });
    return 'file' as const;
  }
  if (navigator.share) {
    await navigator.share(shareData);
    return 'link' as const;
  }
  return 'unsupported' as const;
}
