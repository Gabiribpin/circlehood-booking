import QRCode from 'qrcode';

export interface QROptions {
  color?: string;
  size?: number;
  logoEnabled?: boolean;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Generate QR code as DataURL
 * Reused pattern from ShareLinkCard component
 */
export async function generateQRDataURL(
  url: string,
  options: QROptions = {}
): Promise<string> {
  const {
    color = '#000000',
    size = 300,
    errorCorrectionLevel = 'M',
  } = options;

  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: {
        dark: color,
        light: '#FFFFFF',
      },
      errorCorrectionLevel,
    });

    return dataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate QR code on canvas element
 * Allows for custom composition and overlays
 */
export async function generateQRCanvas(
  canvas: HTMLCanvasElement,
  url: string,
  options: QROptions = {}
): Promise<void> {
  const {
    color = '#000000',
    size = 300,
    errorCorrectionLevel = 'M',
  } = options;

  try {
    await QRCode.toCanvas(canvas, url, {
      width: size,
      margin: 2,
      color: {
        dark: color,
        light: '#FFFFFF',
      },
      errorCorrectionLevel,
    });
  } catch (error) {
    console.error('Error generating QR on canvas:', error);
    throw new Error('Failed to generate QR code on canvas');
  }
}

/**
 * Generate QR code with logo overlay
 * Uses high error correction to allow logo in center
 */
export async function generateQRWithLogo(
  canvas: HTMLCanvasElement,
  url: string,
  logoSrc: string,
  options: QROptions = {}
): Promise<void> {
  const { color = '#000000', size = 300 } = options;

  // Generate QR with high error correction
  await generateQRCanvas(canvas, url, {
    ...options,
    color,
    size,
    errorCorrectionLevel: 'H', // High error correction allows logo overlay
  });

  // Load and draw logo
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  return new Promise((resolve, reject) => {
    const logo = new Image();
    logo.crossOrigin = 'anonymous';

    logo.onload = () => {
      // Logo size: ~20% of QR code size
      const logoSize = size * 0.2;
      const logoX = (size - logoSize) / 2;
      const logoY = (size - logoSize) / 2;

      // Draw white circle background for logo
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, logoSize / 2 + 5, 0, 2 * Math.PI);
      ctx.fill();

      // Draw logo
      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
      resolve();
    };

    logo.onerror = () => reject(new Error('Failed to load logo'));
    logo.src = logoSrc;
  });
}
