import {
  Camera,
  Check,
  ImageUp,
  Link2,
  Loader2,
  ScanLine,
  ShieldCheck,
  X,
} from 'lucide-react';
import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';

type DetectedBarcodeLike = {
  rawValue?: string;
};

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcodeLike[]>;
};

type BarcodeDetectorConstructorLike = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

type ScannerState = 'idle' | 'starting' | 'scanning' | 'opening';

interface InAppQrScannerProps {
  initialError?: string;
  onDetected: (value: string) => string | void;
}

function nativeBarcodeDetector() {
  const Detector = (window as typeof window & {
    BarcodeDetector?: BarcodeDetectorConstructorLike;
  }).BarcodeDetector;

  if (!Detector) return null;
  try {
    return new Detector({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Camera permission was not granted. You can scan from a photo or paste the card link instead.';
    }
    if (error.name === 'NotFoundError') {
      return 'No camera was found on this device. You can scan from a photo or paste the card link instead.';
    }
    if (error.name === 'NotReadableError') {
      return 'The camera is already being used by another app. Close it there and try again.';
    }
  }
  return 'The camera could not be opened. You can scan from a photo or paste the card link instead.';
}

export function InAppQrScanner({ initialError = '', onDetected }: InAppQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const scanningRef = useRef(false);
  const frameCountRef = useRef(0);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const [scannerState, setScannerState] = useState<ScannerState>('idle');
  const [error, setError] = useState(initialError);
  const [pasteValue, setPasteValue] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);

  function releaseCamera() {
    scanningRef.current = false;
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function stopCamera() {
    releaseCamera();
    setScannerState('idle');
  }

  useEffect(() => {
    function pauseWhenHidden() {
      if (!document.hidden || !scanningRef.current) return;
      releaseCamera();
      setScannerState('idle');
      setError('Camera paused while TagOnce was in the background. Tap Scan with camera to resume.');
    }

    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => {
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      releaseCamera();
    };
  }, []);

  async function decodeSource(source: CanvasImageSource, width: number, height: number, attemptBoth = false) {
    if (detectorRef.current) {
      try {
        const detected = await detectorRef.current.detect(source);
        const rawValue = detected.find((barcode) => barcode.rawValue?.trim())?.rawValue?.trim();
        if (rawValue) return rawValue;
      } catch {
        // The bundled decoder below remains available when native detection rejects a frame.
      }
    }

    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return '';
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return '';

    const maxDimension = 960;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: attemptBoth ? 'attemptBoth' : 'dontInvert',
    });
    return result?.data?.trim() || '';
  }

  function acceptDetectedValue(value: string) {
    const normalized = value.trim();
    if (!normalized) {
      setError('No QR value was found. Try again with the full code visible.');
      return false;
    }

    releaseCamera();
    setScannerState('opening');
    setError('');
    try {
      const validationError = onDetected(normalized);
      if (validationError) {
        setScannerState('idle');
        setError(validationError);
        return false;
      }
      return true;
    } catch (detectedError) {
      setScannerState('idle');
      setError(detectedError instanceof Error ? detectedError.message : 'This QR could not be opened.');
      return false;
    }
  }

  async function scanFrame() {
    if (!scanningRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      scanTimerRef.current = window.setTimeout(() => void scanFrame(), 160);
      return;
    }

    try {
      frameCountRef.current += 1;
      const value = await decodeSource(
        video,
        video.videoWidth,
        video.videoHeight,
        frameCountRef.current % 5 === 0,
      );
      if (value && acceptDetectedValue(value)) return;
    } catch {
      // Individual camera frames can fail while the stream is warming up.
    }

    if (scanningRef.current) {
      scanTimerRef.current = window.setTimeout(() => void scanFrame(), 170);
    }
  }

  async function startCamera() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Live camera scanning is unavailable in this browser. Scan from a photo or paste the card link instead.');
      return;
    }

    releaseCamera();
    setScannerState('starting');
    detectorRef.current = nativeBarcodeDetector();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('The camera preview is unavailable.');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      frameCountRef.current = 0;
      scanningRef.current = true;
      setScannerState('scanning');
      void scanFrame();
    } catch (cameraError) {
      releaseCamera();
      setScannerState('idle');
      setError(cameraErrorMessage(cameraError));
    }
  }

  async function scanPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    setError('');
    detectorRef.current = nativeBarcodeDetector();

    try {
      const bitmap = await createImageBitmap(file);
      try {
        const value = await decodeSource(bitmap, bitmap.width, bitmap.height, true);
        if (!value) {
          setError('No QR code was found in that image. Try a sharper photo with the complete code visible.');
          return;
        }
        acceptDetectedValue(value);
      } finally {
        bitmap.close();
      }
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'The QR image could not be read.');
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function openPastedCard() {
    if (!pasteValue.trim()) {
      setError('Paste a TagOnce link or card code first.');
      return;
    }
    acceptDetectedValue(pasteValue);
  }

  const cameraActive = scannerState === 'starting' || scannerState === 'scanning' || scannerState === 'opening';

  return (
    <section className={`in-app-qr-scanner state-${scannerState}`} aria-labelledby="in-app-scanner-heading">
      <div className="in-app-scanner-heading">
        <span className="in-app-scanner-icon"><ScanLine size={24} /></span>
        <div>
          <span className="hero-kicker">Receive a TagOnce card</span>
          <h2 id="in-app-scanner-heading">Scan here. Stay in the exchange.</h2>
          <p>Use the live camera, choose a QR screenshot, or paste a card link. Nothing is uploaded for decoding.</p>
        </div>
      </div>

      {cameraActive ? (
        <div className="live-qr-scanner">
          <div className="live-qr-video-shell">
            <video ref={videoRef} aria-label="Live QR camera preview" />
            <span className="live-qr-target" aria-hidden="true"><i /><i /><i /><i /></span>
            {scannerState !== 'scanning' && (
              <span className="live-qr-loading"><Loader2 className="spin" size={25} /> {scannerState === 'opening' ? 'Opening card…' : 'Starting camera…'}</span>
            )}
          </div>
          <div className="live-qr-scanner-footer">
            <span><Camera size={16} /> Point the full QR inside the frame</span>
            <button className="button secondary small-button" type="button" onClick={stopCamera}><X size={16} /> Close camera</button>
          </div>
        </div>
      ) : (
        <div className="in-app-scanner-options">
          <button className="scanner-option primary-option" type="button" onClick={() => void startCamera()}>
            <span><Camera size={22} /></span>
            <strong>Scan with camera</strong>
            <small>Open the rear camera inside TagOnce</small>
          </button>
          <button className="scanner-option" type="button" disabled={photoBusy} onClick={() => fileInputRef.current?.click()}>
            <span>{photoBusy ? <Loader2 className="spin" size={22} /> : <ImageUp size={22} />}</span>
            <strong>{photoBusy ? 'Reading image…' : 'Scan from photo'}</strong>
            <small>Use a screenshot or take a QR photo</small>
          </button>
        </div>
      )}

      <div className="scanner-paste-row">
        <label>
          <Link2 size={17} />
          <input
            value={pasteValue}
            onChange={(event) => setPasteValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') openPastedCard(); }}
            placeholder="Paste TagOnce link or card code"
            aria-label="Paste TagOnce link or card code"
          />
        </label>
        <button className="button secondary" type="button" onClick={openPastedCard}>Open card</button>
      </div>

      {error && <div className="scanner-error" role="alert">{error}</div>}
      {scannerState === 'opening' && <div className="scanner-success" aria-live="polite"><Check size={15} /> TagOnce card found</div>}

      <div className="scanner-privacy-row">
        <span><ShieldCheck size={15} /> Camera frames stay on this device</span>
        <span>Preview the person before saving</span>
      </div>

      <canvas ref={canvasRef} className="scanner-decoder-canvas" aria-hidden="true" />
      <input
        ref={fileInputRef}
        className="hidden-file-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => void scanPhoto(event.target.files?.[0])}
      />
    </section>
  );
}
