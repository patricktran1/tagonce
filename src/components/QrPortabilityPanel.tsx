import {
  Check,
  Copy,
  Download,
  FileCode2,
  FileUp,
  ImageDown,
  Maximize2,
  Repeat2,
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
import {
  applyWorkspaceBackup,
  downloadWorkspaceBackup,
  readWorkspaceBackupFile,
  shareWorkspaceBackup,
  summarizeWorkspaceBackup,
  type TagOnceWorkspaceBackup,
} from '../lib/workspaceTransfer';

interface QrPortabilityPanelProps {
  shareUrl: string;
  meta: QrExportMeta;
}

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
  removeEventListener?: (type: 'release', listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

export function QrPortabilityPanel({ shareUrl, meta }: QrPortabilityPanelProps) {
  const exportQrRef = useRef<SVGSVGElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<'share' | 'png' | 'svg' | ''>('');
  const [showDownloads, setShowDownloads] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferBusy, setTransferBusy] = useState<'share' | 'download' | 'import' | 'restore' | ''>('');
  const [transferStatus, setTransferStatus] = useState('');
  const [pendingBackup, setPendingBackup] = useState<TagOnceWorkspaceBackup | null>(null);

  useEffect(() => {
    if (!status) return undefined;
    const timeout = window.setTimeout(() => setStatus(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (!showTransfer) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowTransfer(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [showTransfer]);

  useEffect(() => {
    if (!presenting) return undefined;
    const previousOverflow = document.body.style.overflow;
    let wakeLock: WakeLockSentinelLike | null = null;
    let cancelled = false;
    let enteredNativeFullscreen = Boolean(document.fullscreenElement);
    document.body.style.overflow = 'hidden';

    function handleWakeLockRelease() {
      wakeLock = null;
    }

    async function keepScreenAwake() {
      if (cancelled || document.visibilityState !== 'visible' || wakeLock) return;
      try {
        const nextLock = await (navigator as NavigatorWithWakeLock).wakeLock?.request('screen') ?? null;
        if (cancelled) {
          await nextLock?.release();
          return;
        }
        wakeLock = nextLock;
        wakeLock?.addEventListener?.('release', handleWakeLockRelease);
      } catch {
        wakeLock = null;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') void keepScreenAwake();
    }

    function handleFullscreenChange() {
      if (document.fullscreenElement) {
        enteredNativeFullscreen = true;
      } else if (enteredNativeFullscreen) {
        setPresenting(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setPresenting(false);
    }

    void keepScreenAwake();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', closeOnEscape);
      wakeLock?.removeEventListener?.('release', handleWakeLockRelease);
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
      // The fixed event-mode overlay still works when native fullscreen is unavailable.
    }
  }

  async function shareBackupFile() {
    setTransferBusy('share');
    setTransferStatus('');
    try {
      const result = await shareWorkspaceBackup();
      setTransferStatus(result === 'shared' ? 'Backup shared. Open it on the other device.' : 'Backup downloaded because file sharing is unavailable here.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setTransferStatus(error instanceof Error ? error.message : 'The backup could not be shared.');
    } finally {
      setTransferBusy('');
    }
  }

  function downloadBackupFile() {
    setTransferBusy('download');
    setTransferStatus('');
    try {
      const backup = downloadWorkspaceBackup();
      const summary = summarizeWorkspaceBackup(backup);
      setTransferStatus(`Backup downloaded with ${summary.contacts} contacts and ${summary.encounters} encounters.`);
    } catch (error) {
      setTransferStatus(error instanceof Error ? error.message : 'The backup could not be downloaded.');
    } finally {
      setTransferBusy('');
    }
  }

  async function chooseBackup(file: File | undefined) {
    if (!file) return;
    setTransferBusy('import');
    setTransferStatus('');
    try {
      const backup = await readWorkspaceBackupFile(file);
      setPendingBackup(backup);
      const summary = summarizeWorkspaceBackup(backup);
      setTransferStatus(`${summary.profileName}: ${summary.contacts} contacts, ${summary.encounters} encounters, ${summary.campaigns} Beta campaigns.`);
    } catch (error) {
      setPendingBackup(null);
      setTransferStatus(error instanceof Error ? error.message : 'The backup could not be opened.');
    } finally {
      setTransferBusy('');
      if (backupInputRef.current) backupInputRef.current.value = '';
    }
  }

  function restoreBackup(mode: 'merge' | 'replace') {
    if (!pendingBackup) return;
    if (mode === 'replace') {
      const confirmed = window.confirm('Replace the TagOnce profile and saved records on this device with this backup?');
      if (!confirmed) return;
    }
    setTransferBusy('restore');
    try {
      applyWorkspaceBackup(pendingBackup, mode);
      setTransferStatus(mode === 'merge' ? 'Backup merged. Reloading TagOnce…' : 'Backup restored. Reloading TagOnce…');
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      setTransferStatus(error instanceof Error ? error.message : 'The backup could not be restored.');
      setTransferBusy('');
    }
  }

  const pendingSummary = pendingBackup ? summarizeWorkspaceBackup(pendingBackup) : null;

  return (
    <>
      <div className="qr-export-source" aria-hidden="true">
        <QRCodeSVG ref={exportQrRef} value={shareUrl} size={1024} level="L" marginSize={4} />
      </div>

      <section className="qr-portability-panel" aria-label="QR presentation, sharing and downloads">
        <div className="qr-portability-heading">
          <span className="qr-portability-icon"><Smartphone size={18} /></span>
          <span>
            <strong>Show or share this QR</strong>
            <small>Open event mode for in-person scanning, or send and save the QR.</small>
          </span>
        </div>

        <div className="qr-portability-actions">
          <button className="button primary qr-present-button" type="button" onClick={() => void openPresentation()}><Maximize2 size={17} /> Present QR</button>
          <button className="button secondary" type="button" disabled={Boolean(busy)} onClick={() => void sharePortableQr()}>
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
          <button className="button secondary" type="button" onClick={() => void copyLink()}><Copy size={17} /> Copy link</button>
        </div>
        <button className="device-transfer-launcher" type="button" onClick={() => setShowTransfer(true)}>
          <Repeat2 size={18} />
          <span><strong>Move TagOnce to another device</strong><small>Transfer your profile, QR presets, contacts and encounter history.</small></span>
        </button>
        {status && <div className="qr-portability-status" aria-live="polite"><Check size={14} /> {status}</div>}
      </section>

      <div className="mobile-qr-action-bar" aria-label="Quick QR actions">
        <button className="mobile-show-qr-action" type="button" onClick={() => void openPresentation()}><Maximize2 size={19} /><span>Show</span></button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void sharePortableQr()}><Share2 size={19} /><span>Share</span></button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void savePng()}><ImageDown size={19} /><span>Save</span></button>
      </div>

      {showTransfer && (
        <div className="device-transfer-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowTransfer(false);
        }}>
          <section className="device-transfer-dialog" role="dialog" aria-modal="true" aria-labelledby="device-transfer-title">
            <header className="device-transfer-header">
              <span className="device-transfer-icon"><Repeat2 size={22} /></span>
              <span><strong id="device-transfer-title">Move TagOnce to another device</strong><small>Use one backup file to carry your setup and relationship history.</small></span>
              <button type="button" onClick={() => setShowTransfer(false)} aria-label="Close device transfer"><X size={20} /></button>
            </header>

            <div className="device-transfer-action-grid">
              <button type="button" disabled={Boolean(transferBusy)} onClick={() => void shareBackupFile()}>
                <Share2 size={20} />
                <span><strong>{transferBusy === 'share' ? 'Opening share…' : 'Share backup'}</strong><small>Send through AirDrop, Messages, email or another supported app.</small></span>
              </button>
              <button type="button" disabled={Boolean(transferBusy)} onClick={downloadBackupFile}>
                <Download size={20} />
                <span><strong>{transferBusy === 'download' ? 'Preparing…' : 'Download backup'}</strong><small>Save a portable TagOnce file for later.</small></span>
              </button>
              <button type="button" disabled={Boolean(transferBusy)} onClick={() => backupInputRef.current?.click()}>
                <FileUp size={20} />
                <span><strong>{transferBusy === 'import' ? 'Reading backup…' : 'Import backup'}</strong><small>Open a TagOnce backup received from another device.</small></span>
              </button>
            </div>

            <input
              ref={backupInputRef}
              className="hidden-file-input"
              type="file"
              accept="application/json,.json"
              onChange={(event) => void chooseBackup(event.target.files?.[0])}
            />

            {pendingSummary && (
              <div className="device-transfer-review">
                <div>
                  <span className="eyebrow">Ready to import</span>
                  <strong>{pendingSummary.profileName}</strong>
                  <small>{pendingSummary.contacts} contacts · {pendingSummary.encounters} encounters · {pendingSummary.campaigns} Beta campaigns</small>
                </div>
                <div className="device-transfer-restore-actions">
                  <button className="button primary" type="button" disabled={transferBusy === 'restore'} onClick={() => restoreBackup('merge')}>Merge into this device</button>
                  <button className="button secondary" type="button" disabled={transferBusy === 'restore'} onClick={() => restoreBackup('replace')}>Replace this device</button>
                </div>
              </div>
            )}

            {transferStatus && <div className="device-transfer-status" aria-live="polite"><Check size={15} /> {transferStatus}</div>}
          </section>
        </div>
      )}

      {presenting && (
        <div className="qr-presentation-overlay" role="dialog" aria-modal="true" aria-label={`${meta.displayName} QR event mode`}>
          <header className="qr-presentation-toolbar">
            <span className="qr-presentation-ready"><span aria-hidden="true" /> Ready to scan</span>
            <div>
              <button type="button" disabled={Boolean(busy)} onClick={() => void sharePortableQr()}>
                {busy === 'share' ? <span className="button-spinner" /> : <Share2 size={18} />}<span>Share</span>
              </button>
              <button type="button" onClick={() => void copyLink()}><Copy size={18} /><span>Copy</span></button>
              <button type="button" onClick={() => setPresenting(false)}><X size={19} /><span>Done</span></button>
            </div>
          </header>

          <div className="qr-presentation-card">
            <div className="qr-presentation-identity">
              <span className="qr-presentation-brand">TAGONCE</span>
              <h2>{meta.displayName}</h2>
              {meta.subtitle && <p>{meta.subtitle}</p>}
            </div>

            <div className="qr-presentation-code">
              <QRCodeSVG value={shareUrl} size={720} level="L" marginSize={3} title={`Scan to open ${meta.displayName}'s TagOnce card`} />
            </div>

            <div className="qr-presentation-footer">
              <strong>Scan to connect</strong>
              {meta.eventName && <span>{meta.eventName}</span>}
              {(meta.eventTime || meta.eventLocation) && <small>{[meta.eventTime, meta.eventLocation].filter(Boolean).join(' · ')}</small>}
            </div>
          </div>

          {status && <div className="qr-presentation-status" aria-live="polite"><Check size={15} /> {status}</div>}
        </div>
      )}
    </>
  );
}
