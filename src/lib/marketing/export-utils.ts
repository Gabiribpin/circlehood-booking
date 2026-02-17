/**
 * Export utility functions for marketing materials
 * Convert canvas to PNG, SVG, and PDF formats
 */

/**
 * Download canvas as PNG
 * Reused pattern from ShareLinkCard component
 */
export function canvasToPNG(
  canvas: HTMLCanvasElement,
  filename: string
): void {
  try {
    const link = document.createElement('a');
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('Error exporting PNG:', error);
    throw new Error('Failed to export PNG');
  }
}

/**
 * Download canvas as JPEG
 * Useful for marketing materials with photos
 */
export function canvasToJPEG(
  canvas: HTMLCanvasElement,
  filename: string,
  quality: number = 0.95
): void {
  try {
    const link = document.createElement('a');
    link.download = filename.endsWith('.jpg') ? filename : `${filename}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', quality);
    link.click();
  } catch (error) {
    console.error('Error exporting JPEG:', error);
    throw new Error('Failed to export JPEG');
  }
}

/**
 * Download canvas as SVG
 * Note: This creates a simple SVG with the canvas as embedded image
 * For true vector SVG, use QRCode.toString() method
 */
export function canvasToSVG(
  canvas: HTMLCanvasElement,
  filename: string
): void {
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
        <image href="${dataUrl}" width="${canvas.width}" height="${canvas.height}" />
      </svg>
    `;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
    link.href = url;
    link.click();

    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (error) {
    console.error('Error exporting SVG:', error);
    throw new Error('Failed to export SVG');
  }
}

/**
 * Get canvas as Blob
 * Useful for uploading to storage
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = 'image/png',
  quality?: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      type,
      quality
    );
  });
}

/**
 * Copy canvas to clipboard
 */
export async function canvasToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  try {
    const blob = await canvasToBlob(canvas);
    if (!blob) throw new Error('Failed to create blob');

    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    throw new Error('Failed to copy to clipboard');
  }
}

/**
 * Get data URL from canvas
 */
export function canvasToDataURL(
  canvas: HTMLCanvasElement,
  type: string = 'image/png',
  quality?: number
): string {
  return canvas.toDataURL(type, quality);
}

/**
 * Print canvas
 */
export function printCanvas(canvas: HTMLCanvasElement): void {
  try {
    const win = window.open('', '_blank');
    if (!win) throw new Error('Failed to open print window');

    win.document.write(`
      <html>
        <head>
          <title>Imprimir</title>
          <style>
            body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <img src="${canvas.toDataURL()}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error printing canvas:', error);
    throw new Error('Failed to print canvas');
  }
}
