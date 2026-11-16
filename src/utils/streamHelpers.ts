export type ServerSelectionId = 'server1' | 'server2' | 'server3';

export type StreamProviderKind = 'VOE' | 'BYSE' | 'STREAMTAPE' | 'DIRECT';

/**
 * Classifies a media source URL into one of MaxPlay's core provider pipelines.
 */
export function classifyStreamProvider(rawUrl?: string | null): StreamProviderKind {
  if (!rawUrl || typeof rawUrl !== 'string') return 'DIRECT';
  const lower = rawUrl.toLowerCase().trim();
  if (!lower) return 'DIRECT';

  if (
    lower.includes('streamtape.') ||
    lower.includes('strtape.') ||
    lower.includes('shavetape.') ||
    lower.includes('streamta.pe') ||
    lower.includes('tapecontent.net') ||
    lower.includes('/get_video')
  ) {
    return 'STREAMTAPE';
  }

  if (
    lower.includes('filemoon') ||
    lower.includes('moonmov') ||
    lower.includes('kerapoxy') ||
    lower.includes('byseraguci') ||
    lower.includes('bysedikamoum') ||
    lower.includes('byse') ||
    lower.includes('n1mwq') ||
    lower.includes('f16px') ||
    lower.includes('1azayf9w') ||
    lower.includes('8mhlloqo') ||
    lower.includes('96ar.com') ||
    lower.includes('xcoic.com') ||
    lower.includes('l1afav.net') ||
    lower.includes('sprintcdn') ||
    lower.includes('owphbf') ||
    lower.includes('r66nv9ed')
  ) {
    return 'BYSE';
  }

  if (
    lower.includes('voe.sx') ||
    lower.includes('voe.') ||
    lower.includes('voe-network') ||
    lower.includes('reputationsickler') ||
    lower.includes('turtledoveconsequent') ||
    lower.includes('launchreliantcleaverriver') ||
    lower.includes('fraudclatterflyingcar')
  ) {
    return 'VOE';
  }

  return 'DIRECT';
}

/**
 * Returns true if the resolved stream URL points to a progressive container (MP4/MKV/WebM or Streamtape get_video/tapecontent)
 * rather than an HLS manifest.
 */
export function isDirectProgressiveStreamUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const lower = rawUrl.toLowerCase().trim();
  if (!lower || lower.includes('.m3u8')) return false;
  const pathPart = lower.split('?')[0];
  return (
    pathPart.endsWith('.mp4') ||
    pathPart.endsWith('.mkv') ||
    pathPart.endsWith('.webm') ||
    lower.includes('/get_video') ||
    lower.includes('tapecontent.net') ||
    lower.includes('/api/stream-proxy')
  );
}

/**
 * Wraps a direct MP4/MKV/Streamtape URL through `/api/stream-proxy` (supporting Range & unbounded streaming)
 * on web browsers, while returning the raw direct URL inside the native Kotlin APK where OkHttp injects headers.
 */
export function buildDirectStreamProxyUrl(
  rawUrl: string,
  refererUrl?: string,
  isNativeApp: boolean = false
): string {
  const clean = (rawUrl || '').trim();
  if (!clean) return '';
  if (clean.startsWith('blob:')) return clean;
  if (isNativeApp) {
    if (clean.includes('/api/stream-proxy?url=') || clean.includes('/api/proxy?url=')) {
      const m = clean.match(/[?&]url=([^&#]+)/i);
      if (m && m[1]) {
        try {
          return decodeURIComponent(m[1]).trim();
        } catch {}
      }
    }
    return clean;
  }
  if (clean.startsWith('/api/stream-proxy?')) return clean;
  const refPart = refererUrl ? `&referer=${encodeURIComponent(refererUrl.trim())}` : '';
  return `/api/stream-proxy?url=${encodeURIComponent(clean)}${refPart}`;
}

export interface DownloadCandidateInput {
  videoUrl?: string;
  secondaryVideoUrl?: string;
  tertiaryVideoUrl?: string;
  selectedServer?: ServerSelectionId;
  preferFallbackRotationIndex?: number;
}

/**
 * Orders candidate server URLs for download extraction:
 * - Strictly places the user's `selectedServer` URL first when available,
 *   unless a retry rotation index (`preferFallbackRotationIndex > 0`) rotates to another server.
 * - Deduplicates empty or identical URLs while preserving deterministic fallback order.
 */
export function orderDownloadCandidateUrls(input: DownloadCandidateInput): string[] {
  const s1 = (input.videoUrl || '').trim();
  const s2 = (input.secondaryVideoUrl || '').trim();
  const s3 = (input.tertiaryVideoUrl || '').trim();

  let prioritized: string[];
  if (input.selectedServer === 'server3') {
    if (s3 && classifyStreamProvider(s1) !== 'STREAMTAPE' && classifyStreamProvider(s3) === 'STREAMTAPE') {
      prioritized = [s3, s1, s2];
    } else {
      prioritized = [s1, s2, s3];
    }
  } else if (input.selectedServer === 'server2') {
    if (s2 && classifyStreamProvider(s1) !== 'BYSE' && classifyStreamProvider(s2) === 'BYSE') {
      prioritized = [s2, s1, s3];
    } else {
      prioritized = [s1, s2, s3];
    }
  } else {
    prioritized = [s1, s2, s3];
  }

  const deduped = Array.from(new Set(prioritized.filter(Boolean)));
  if (deduped.length <= 1) return deduped;

  const rot = Math.max(0, Math.floor(input.preferFallbackRotationIndex || 0)) % deduped.length;
  if (rot === 0) return deduped;

  return [...deduped.slice(rot), ...deduped.slice(0, rot)];
}

/**
 * Sanitizes Byse/SprintCDN master HLS manifests where `index-a1.m3u8` is an empty 376-byte
 * audio stream (0 audio frames) and the video variant explicitly uses `index-v1-a2.m3u8`.
 */
export function sanitizeByseMasterM3u8(manifestText: string): string {
  if (!manifestText || typeof manifestText !== 'string') return '';
  let rawLines = manifestText.split('\n');
  const hasMultipleAudioMedia =
    rawLines.filter((l) => l.trim().startsWith('#EXT-X-MEDIA:TYPE=AUDIO')).length > 1;
  const usesA2VideoVariant = rawLines.some((l) => /index-v\d+-a2\.m3u8/i.test(l));

  if (hasMultipleAudioMedia && usesA2VideoVariant) {
    rawLines = rawLines
      .filter((l) => {
        const trimmedL = l.trim();
        if (trimmedL.startsWith('#EXT-X-MEDIA:TYPE=AUDIO') && /index-a1\.m3u8/i.test(trimmedL)) {
          return false;
        }
        return true;
      })
      .map((l) => {
        const trimmedL = l.trim();
        if (trimmedL.startsWith('#EXT-X-MEDIA:TYPE=AUDIO') && /index-a2\.m3u8/i.test(trimmedL)) {
          return trimmedL.replace(/DEFAULT=NO/i, 'DEFAULT=YES');
        }
        return l;
      });
  }
  return rawLines.join('\n');
}

/**
 * Infers the correct progressive container MIME type while preventing `.mkv.mp4` files
 * (such as Streamtape transcodes) from being misclassified as `video/x-matroska`.
 */
export function inferProgressiveVideoMimeType(urlOrFilename: string, contentDisposition?: string): string {
  const lowerUrl = (urlOrFilename || '').toLowerCase();
  const disp = (contentDisposition || '').toLowerCase();
  const pathPart = lowerUrl.split('?')[0];

  const isTrueMkv =
    (disp.includes('.mkv') && !disp.includes('.mkv.mp4')) ||
    (lowerUrl.includes('.mkv') && !lowerUrl.includes('.mkv.mp4') && !pathPart.endsWith('.mp4'));

  if (isTrueMkv) return 'video/x-matroska';
  if (disp.includes('.webm') || pathPart.endsWith('.webm')) return 'video/webm';
  return 'video/mp4';
}

