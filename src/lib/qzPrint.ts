/**
 * Wrapper léger pour QZ Tray (impression directe sans dialogue navigateur).
 * QZ Tray doit être installé sur le poste : https://qz.io/download
 * Le service écoute par défaut sur wss://localhost:8181.
 *
 * Utilisation :
 *   import { printRaw, isQzAvailable } from '@/lib/qzPrint';
 *   if (await isQzAvailable()) await printRaw('Imprimante-Chaud', 'Texte ESC/POS...');
 *
 * En cas d'indisponibilité, on tombe automatiquement sur window.print().
 */

let qzPromise: Promise<any> | null = null;

async function loadQz(): Promise<any | null> {
  if (typeof window === 'undefined') return null;
  if ((window as any).qz) return (window as any).qz;
  if (qzPromise) return qzPromise;

  qzPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
    script.async = true;
    script.onload = () => resolve((window as any).qz || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return qzPromise;
}

export async function isQzAvailable(): Promise<boolean> {
  const qz = await loadQz();
  if (!qz) return false;
  try {
    if (!qz.websocket.isActive()) {
      // Mode signature anonyme (DEV uniquement). En prod, configurer un certificat signé.
      qz.security.setCertificatePromise((_resolve: any, reject: any) => reject());
      qz.security.setSignaturePromise(() => (_resolve: any, reject: any) => reject());
      await qz.websocket.connect();
    }
    return true;
  } catch {
    return false;
  }
}

export async function listPrinters(): Promise<string[]> {
  if (!(await isQzAvailable())) return [];
  const qz = (window as any).qz;
  try { return await qz.printers.find(); } catch { return []; }
}

export async function printRaw(printerName: string, content: string): Promise<boolean> {
  if (!(await isQzAvailable())) return false;
  const qz = (window as any).qz;
  try {
    const config = qz.configs.create(printerName);
    await qz.print(config, [content]);
    return true;
  } catch (e) {
    console.warn('[QZ] print failed', e);
    return false;
  }
}

/** Impression HTML avec fallback vers window.print() si QZ indisponible */
export async function printHtmlOrFallback(printerName: string | null, html: string, fallbackPrint: () => void) {
  if (printerName && (await isQzAvailable())) {
    const qz = (window as any).qz;
    try {
      const config = qz.configs.create(printerName, { rasterize: false });
      await qz.print(config, [{ type: 'html', format: 'plain', data: html }]);
      return;
    } catch (e) {
      console.warn('[QZ] html print failed, fallback to browser', e);
    }
  }
  fallbackPrint();
}
