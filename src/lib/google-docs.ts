import type { GoogleDocKind } from '@/lib/types';

export function detectGoogleDocKind(url: string): GoogleDocKind {
  const u = url.toLowerCase();
  if (u.includes('/document/') || u.includes('docs.google.com/document')) return 'document';
  if (u.includes('/spreadsheets/') || u.includes('docs.google.com/spreadsheets')) return 'spreadsheet';
  if (u.includes('/presentation/') || u.includes('docs.google.com/presentation')) return 'presentation';
  return 'unknown';
}

/** Extract Google file id from common Docs/Sheets/Drive URLs. */
export function extractGoogleFileId(url: string): string | null {
  try {
    const trimmed = url.trim();
    const patterns = [
      /\/document\/d\/([a-zA-Z0-9-_]+)/,
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
      /\/presentation\/d\/([a-zA-Z0-9-_]+)/,
      /\/file\/d\/([a-zA-Z0-9-_]+)/,
      /[?&]id=([a-zA-Z0-9-_]+)/,
      /\/d\/([a-zA-Z0-9-_]+)/,
    ];
    for (const re of patterns) {
      const m = trimmed.match(re);
      if (m?.[1]) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

export function buildGoogleEmbedUrl(kind: GoogleDocKind, fileId: string): string {
  switch (kind) {
    case 'document':
      return `https://docs.google.com/document/d/${fileId}/edit?usp=sharing&embedded=true`;
    case 'spreadsheet':
      return `https://docs.google.com/spreadsheets/d/${fileId}/edit?usp=sharing&embedded=true`;
    case 'presentation':
      return `https://docs.google.com/presentation/d/${fileId}/embed?start=false&loop=false&delayms=3000`;
    default:
      return `https://drive.google.com/file/d/${fileId}/preview`;
  }
}

export function buildGoogleOpenUrl(kind: GoogleDocKind, fileId: string): string {
  switch (kind) {
    case 'document':
      return `https://docs.google.com/document/d/${fileId}/edit`;
    case 'spreadsheet':
      return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
    case 'presentation':
      return `https://docs.google.com/presentation/d/${fileId}/edit`;
    default:
      return `https://drive.google.com/file/d/${fileId}/view`;
  }
}

export function parseGoogleDocUrl(url: string): {
  fileId: string;
  kind: GoogleDocKind;
  embedUrl: string;
  openUrl: string;
} | null {
  const fileId = extractGoogleFileId(url);
  if (!fileId) return null;
  const kind = detectGoogleDocKind(url);
  return {
    fileId,
    kind: kind === 'unknown' ? 'document' : kind,
    embedUrl: buildGoogleEmbedUrl(kind === 'unknown' ? 'document' : kind, fileId),
    openUrl: buildGoogleOpenUrl(kind === 'unknown' ? 'document' : kind, fileId),
  };
}

export function googleDocKindLabel(kind: GoogleDocKind): string {
  switch (kind) {
    case 'document':
      return 'Google Doc';
    case 'spreadsheet':
      return 'Google Sheet';
    case 'presentation':
      return 'Google Slides';
    default:
      return 'Google file';
  }
}
