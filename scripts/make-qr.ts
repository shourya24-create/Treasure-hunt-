/**
 * npm run qr — writes one printable PNG per checkpoint to qr-codes/.
 * Each QR encodes {BASE_URL}/c/{cpId}?t={signature}. The base URL is baked in:
 * changing the domain after printing breaks every code.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { signCp } from '../lib/hmac';

type Cp = { cpId: number; title: string };

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
}

async function main() {
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
  if (!base) throw new Error('NEXT_PUBLIC_BASE_URL is not set');
  const { checkpoints } = JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'checkpoints.json'), 'utf8')) as { checkpoints: Cp[] };
  const outDir = path.join(process.cwd(), 'qr-codes');
  mkdirSync(outDir, { recursive: true });

  console.warn(`\n  !! Baking base URL into every QR: ${base}`);
  console.warn('  !! Once printed, this domain must never change.\n');
  if (/localhost|127\.0\.0\.1/.test(base)) console.warn('  !! This is a local URL — do not print these.\n');

  const index: string[] = [];
  for (const cp of checkpoints) {
    const url = `${base}/c/${cp.cpId}?t=${signCp(cp.cpId)}`;
    const png = await QRCode.toBuffer(url, { errorCorrectionLevel: 'H', width: 1200, margin: 4 });
    const file = `cp${cp.cpId}-${cp.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    writeFileSync(path.join(outDir, file), png);
    // A labelled sheet too, with the checkpoint name printed under the code.
    const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H', margin: 2 });
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)?.[1] ?? '33';
    writeFileSync(
      path.join(outDir, file.replace(/\.png$/, '-label.svg')),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${Number(vb) + 6}" width="1200" height="${Math.round(1200 * (Number(vb) + 6) / Number(vb))}">` +
        `<rect width="100%" height="100%" fill="#fff"/><g>${inner}</g>` +
        `<text x="${Number(vb) / 2}" y="${Number(vb) + 3.5}" font-family="monospace" font-size="2.4" text-anchor="middle">${cp.cpId}. ${escapeXml(cp.title)}</text></svg>\n`,
    );
    index.push(`${cp.cpId}\t${cp.title}\t${url}`);
    console.log(`  ${file}`);
  }
  writeFileSync(path.join(outDir, 'urls.tsv'), index.join('\n') + '\n');
  console.log(`\nWrote ${checkpoints.length} QR codes to qr-codes/ (plus labelled SVGs and urls.tsv)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
