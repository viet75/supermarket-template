import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function GET() {
  const publicDir = path.join(process.cwd(), 'public');
  const faviconPath = path.join(publicDir, 'favicon.ico');
  const iconPath = path.join(publicDir, 'icons', 'icon-192x192.png');

  const cacheControl = 'public, max-age=86400, immutable';

  try {
    if (existsSync(faviconPath)) {
      const buf = await readFile(faviconPath);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': 'image/x-icon',
          'Cache-Control': cacheControl,
        },
      });
    }
    if (existsSync(iconPath)) {
      const buf = await readFile(iconPath);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': cacheControl,
        },
      });
    }
  } catch {
    // fall through to 404
  }
  return new NextResponse(null, { status: 404 });
}
