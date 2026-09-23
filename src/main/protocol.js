import electron from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { CACHE_DIR, PROJECT_ROOT, MEDIA_SCHEME, statOrNull } from './config.js';
import { readRoots } from './roots.js';

const protocol = typeof electron === 'object' && electron !== null && 'protocol' in electron ? electron.protocol : null;

export { MEDIA_SCHEME };

export function registerMediaSchemes() {
  if (!protocol || !protocol.registerSchemesAsPrivileged) return;
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

/** URL shape the protocol handler parses: `nlt-media://local/<encoded abs path>`. */
export function isWithin(child, parent) {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function isServableMedia(target) {
  if (isWithin(target, CACHE_DIR) || isWithin(target, PROJECT_ROOT)) return true;
  const roots = await readRoots();
  return roots.some((root) => isWithin(target, path.resolve(root)));
}

const MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.json': 'application/json',
};

export function mediaMimeType(target) {
  return MIME_TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream';
}

/**
 * Parse a single-range `Range: bytes=a-b` header against a known size.
 * Returns `null` when the header is absent or not a single satisfiable range.
 */
export function parseRange(header, size) {
  if (typeof header !== 'string') return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;

  if (rawStart === '' && rawEnd === '') return null;
  if (rawStart === '') {
    // Suffix range: last N bytes.
    const suffix = Number(rawEnd);
    if (suffix === 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (!Number.isFinite(start) || start > end || start >= size) return null;
  return { start, end };
}

/**
 * Serve a file with real `Range`/`206` semantics. Seeking in a <video> depends
 * on this: `net.fetch(file://…)` ignores the Range header and always returns the
 * whole body, so the bytes are streamed from disk here instead.
 */
export async function serveMediaFile(target, request) {
  const stat = await statOrNull(target);
  if (!stat || !stat.isFile()) return new Response('not found', { status: 404 });

  const mimeType = mediaMimeType(target);
  const headers = {
    'Content-Type': mimeType,
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Cache-Control': 'no-cache',
  };

  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers: { ...headers, 'Content-Length': String(stat.size) } });
  }

  const rangeHeader = request.headers.get('Range');
  const range = parseRange(rangeHeader, stat.size);

  if (rangeHeader && !range) {
    return new Response(null, {
      status: 416,
      headers: { ...headers, 'Content-Range': `bytes */${stat.size}` },
    });
  }

  const start = range ? range.start : 0;
  const end = range ? range.end : Math.max(0, stat.size - 1);
  const stream = fs.createReadStream(target, { start, end });
  const body = Readable.toWeb(stream);

  if (!range) {
    return new Response(body, { status: 200, headers: { ...headers, 'Content-Length': String(stat.size) } });
  }

  return new Response(body, {
    status: 206,
    headers: {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Content-Length': String(end - start + 1),
    },
  });
}

export function registerMediaProtocol() {
  if (!protocol || !protocol.handle) return;
  protocol.handle(MEDIA_SCHEME, async (request) => {
    let target;
    try {
      target = path.resolve(decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, '')));
    } catch {
      return new Response('bad media url', { status: 400 });
    }

    if (!path.isAbsolute(target) || !(await isServableMedia(target))) {
      console.warn(`[nlt] media 403 (outside allow-list): ${target}`);
      return new Response('forbidden', { status: 403 });
    }

    try {
      return await serveMediaFile(target, request);
    } catch (err) {
      console.warn(`[nlt] media fetch failed for ${target}: ${err.message}`);
      return new Response('not found', { status: 404 });
    }
  });
}
