import {
  Check,
  Copy,
  Download,
  FileCode2,
  ImageDown,
  Maximize2,
  Share2,
  Smartphone,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  downloadQrPng,
  downloadQrSvg,
  shareQr,
  type QrExportMeta,
} from '../lib/qrExport';

interface QrPortabilityPanelProps {
  shareUrl: string;
  meta: QrExportMeta;
}

type WakeLockSentinelLike = {
  release: () => Promise<void>;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

export function QrPortabilityPanel({ shareUrl, meta }: QrPortabilityPanelProps) {
  const exportQrRef = useRef<SVGSVGElement>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<'share' | 'png' | 'svg' | ''>('');
  const [showDownloads, setShowDownloads] = useState(false);
  const [presenting, setPresenting] = useState(false);

  useEffect(() => {
    if (!status) return undefined;
    const timeout = window.setTimeout(() => setStatus(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (!presenting) return undefined;
    const previousOverflow = document.body.style.overflow;
    let wakeLock: WakeLockSentinelLike | null = null;
    document.body.style.overflow = 'hidden';

    async function keepScreenAwake() {
      try {
        wakeLock = await (navigator as NavigatorWithWakeLock).wakeLock?.request('screen') ?? null;
      } catch {
        wakeLock = null;
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setPresenting(false);
    }

    void keepScreenAwake();
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      void wakeLock?.release();
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [presenting]);

  function requireQr() {
    if (!exportQrRef.current) throw new Error('The QR is still loading. Try again.');
    return exportQrRef.current;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus('Card link copied');
    } catch {
      setStatus('Copy was blocked by this browser');
    }
  }

  async function sharePortableQr() {
    setBusy('share');
    try {
      const result = await shareQr(requireQr(), meta, shareUrl);
      if (result === 'unsupported') {
        await copyLink();
        setStatus('Sharing is unavailable here, so the card link was copied');
      } else {
        setStatus(result === 'file' ? 'QR image shared' : 'Card link shared');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus(error instanceof Error ? error.message : 'The QR could not be shared');
    } finally {
      setBusy('');
    }
  }

  async function savePng() {
    setBusy('png');
    try {
      await downloadQrPng(requireQr(), meta);
      setStatus('Phone-ready PNG downloaded');
      setShowDownloads(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The PNG could not be downloaded');
    } finally {
      setBusy('');
    }
  }

  function saveSvg() {
    setBusy('svg');
    try {
      downloadQrSvg(requireQr(), meta);
      setStatus('Print-ready SVG downloaded');
      setShowDownloads(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The SVG could not be downloaded');
    } finally {
      setBusy('');
    }
  }

  async function openPresentation() {
    setPresenting(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // The fixed presentation overlay still works when native fullscreen is unavailable.
    }
  }

  return (
    <>
      <div className="qr-export-source" aria-hidden="true">
        <QRCodeSVG ref={exportQrRef} value={shareUrl} size={1024} level="L" marginSize={4} />
      </div>

      <section className="qr-portability-panel" aria-label="QR sharing and downloads">
        <div className="qr-portability-heading">
          <span className="qr-portability-icon"><Smartphone size={18} /></span>
          <span>
            <strong>Take this QR anywhere</strong>
            <small>Share it to your phone, save an image, or present it full-screen.</small>
          </span>
        </div>

        <div className="qr-portability-actions">
          <button className="button primary" type="button" disabled={Boolean(busy)} onClick={() => void sharePortableQr()}>
            {busy === 'share' ? <span className="button-spinner" /> : <Share2 size={17} />} Share QR
          </button>
          <button className="button secondary" type="button" disabled={Boolean(busy)} onClick={() => void savePng()}>
            {busy === 'png' ? <span className="button-spinner" /> : <ImageDown size={17} />} Download PNG
          </button>
          <div className="qr-download-menu-wrap">
            <button className="button secondary" type="button" aria-expanded={showDownloads} onClick={() => setShowDownloads((current) => !current)}>
              <Download size={17} /> More downloads
            </button>
            {showDownloads && (
              <div className="qr-download-menu">
                <button type="button" disabled={Boolean(busy)} onClick={() => void savePng()}><ImageDown size={16} /><span><strong>Phone-ready PNG</strong><small>Branded image for Photos, AirDrop and messaging</small></span></button>
                <button type="button" disabled={Boolean(busy)} onClick={saveSvg}><FileCode2 size={16} /><span><strong>Print-ready SVG</strong><small>Sharp vector QR for badges, signs and slides</small></span></button>
              </div>
            )}
          </div>
          <button className="button secondary" type="button" onClick={() => void openPresentation()}><Maximize2 size={17} /> Full screen</button>
          <button className="button secondary" type="button" onClick={() => void copyLink()}><Copy size={17} /> Copy link</button>
        </div>
        {status && <div className="qr-portability-status"><Check size={14} /> {status}</div>}
      </section>

      <div className="mobile-qr-action-bar" aria-label="Quick QR actions">
        <button type="button" disabled={Boolean(busy)} onClick={() => void sharePortableQr()}><Share2 size={19} /><span>Share</span></button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void savePng()}><ImageDown size={19} /><span>Save</span></button>
        <button type="button" onClick={() => void openPresentation()}><Maximize2 size={19} /><span>Show</span></button>
      </div>

      {presenting && (
        <div className="qr-presentation-overlay" role="dialog" aria-modal="true" aria-label={`${meta.displayName} QR presentation`}>
          <button className="qr-presentation-close" type="button" onClick={() => setPresenting(false)} aria-label="Close full-screen QR"><X size={22} /></button>
          <div className="qr-presentation-card">
            <span className="qr-presentation-brand">TAGONCE</span>
            <span className="qr-presentation-mode">{meta.eventName || meta.modeLabel}</span>
            <h2>{meta.displayName}</h2>
            {meta.subtitle && <p>{meta.subtitle}</p>}
            <div className="qr-presentation-code">
              <QRCodeSVG value={shareUrl} size={520} level="L" marginSize={3} title={`Scan to open ${meta.displayName}'s TagOnce card`} />
            </div>
            <strong>Scan to connect</strong>
            {(meta.eventTime || meta.eventLocation) && <small>{[meta.eventTime, meta.eventLocation].filter(Boolean).join(' · ')}</small>}
          </div>
        </div>
      )}
    </>
  );
}
