import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyStreamProvider,
  isDirectProgressiveStreamUrl,
  buildDirectStreamProxyUrl,
  orderDownloadCandidateUrls,
  sanitizeByseMasterM3u8,
  inferProgressiveVideoMimeType,
} from './streamHelpers';

describe('streamHelpers', () => {
  it('classifies stream providers accurately across Server 1, Server 2, Server 3, and direct URLs', () => {
    assert.equal(classifyStreamProvider('https://voe.sx/8sckw1bwi4pm'), 'VOE');
    assert.equal(classifyStreamProvider('https://reputationsickler.com/e/abc123'), 'VOE');
    assert.equal(classifyStreamProvider('https://byseraguci.com/d/jn4tzr4mpt0u'), 'BYSE');
    assert.equal(
      classifyStreamProvider('https://edge1-vienna-sprintcdn.owphbf24.com/hls2/03/12263/jn4tzr4mpt0u_x/master.m3u8'),
      'BYSE'
    );
    assert.equal(classifyStreamProvider('https://streamtape.com/v/6kjz8WP38qT9AKg/'), 'STREAMTAPE');
    assert.equal(classifyStreamProvider('https://streamtape.com/get_video?id=123&stream=1'), 'STREAMTAPE');
    assert.equal(classifyStreamProvider('https://964698249.tapecontent.net/get_video?id=123'), 'STREAMTAPE');
    assert.equal(classifyStreamProvider('https://cdn.example.com/movie.mp4'), 'DIRECT');
    assert.equal(classifyStreamProvider(''), 'DIRECT');
  });

  it('detects progressive direct media URLs while excluding HLS manifests', () => {
    assert.equal(isDirectProgressiveStreamUrl('https://streamtape.com/get_video?id=abc&stream=1'), true);
    assert.equal(isDirectProgressiveStreamUrl('https://964698249.tapecontent.net/video.mp4?token=1'), true);
    assert.equal(isDirectProgressiveStreamUrl('https://cdn.example.com/file.mkv?auth=9'), true);
    assert.equal(isDirectProgressiveStreamUrl('/api/stream-proxy?url=https%3A%2F%2Fexample.com%2Fa.mp4'), true);
    assert.equal(isDirectProgressiveStreamUrl('https://edge1.sprintcdn.example/master.m3u8?t=1'), false);
    assert.equal(isDirectProgressiveStreamUrl('https://streamtape.com/get_video?id=1&note=master.m3u8'), false);
    assert.equal(isDirectProgressiveStreamUrl(null), false);
  });

  it('wraps progressive streams through /api/stream-proxy on web and unwraps in native APK', () => {
    const raw = 'https://streamtape.com/get_video?id=6kjz8WP38qT9AKg&stream=1';
    const proxied = buildDirectStreamProxyUrl(raw, 'https://streamtape.com/', false);
    assert.equal(
      proxied,
      '/api/stream-proxy?url=https%3A%2F%2Fstreamtape.com%2Fget_video%3Fid%3D6kjz8WP38qT9AKg%26stream%3D1&referer=https%3A%2F%2Fstreamtape.com%2F'
    );
    assert.equal(buildDirectStreamProxyUrl(proxied, undefined, false), proxied);
    assert.equal(buildDirectStreamProxyUrl(proxied, 'https://streamtape.com/', true), raw);
    assert.equal(buildDirectStreamProxyUrl(raw, 'https://streamtape.com/', true), raw);
    assert.equal(buildDirectStreamProxyUrl('blob:https://app/123', 'https://streamtape.com/', false), 'blob:https://app/123');
  });

  it('orders download candidate URLs by selectedServer, deduplicates, and rotates cleanly on retry', () => {
    const voe = 'https://voe.sx/8sckw1bwi4pm';
    const byse = 'https://byseraguci.com/d/jn4tzr4mpt0u';
    const stape = 'https://streamtape.com/v/6kjz8WP38qT9AKg/';

    assert.deepEqual(
      orderDownloadCandidateUrls({
        videoUrl: stape,
        secondaryVideoUrl: voe,
        tertiaryVideoUrl: byse,
        selectedServer: 'server3',
      }),
      [stape, voe, byse]
    );

    assert.deepEqual(
      orderDownloadCandidateUrls({
        videoUrl: voe,
        secondaryVideoUrl: byse,
        tertiaryVideoUrl: stape,
        selectedServer: 'server3',
      }),
      [stape, voe, byse]
    );

    assert.deepEqual(
      orderDownloadCandidateUrls({
        videoUrl: voe,
        secondaryVideoUrl: byse,
        tertiaryVideoUrl: stape,
        selectedServer: 'server2',
      }),
      [byse, voe, stape]
    );

    assert.deepEqual(
      orderDownloadCandidateUrls({
        videoUrl: voe,
        secondaryVideoUrl: byse,
        tertiaryVideoUrl: stape,
        selectedServer: 'server1',
        preferFallbackRotationIndex: 1,
      }),
      [byse, stape, voe]
    );

    assert.deepEqual(
      orderDownloadCandidateUrls({
        videoUrl: byse,
        secondaryVideoUrl: byse,
        tertiaryVideoUrl: '',
        selectedServer: 'server2',
      }),
      [byse]
    );
  });

  it('sanitizes Byse master playlists with empty index-a1.m3u8 tracks when variant uses index-v1-a2.m3u8', () => {
    const vefaMaster = [
      '#EXTM3U',
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="hi",NAME="हिन्दी",DEFAULT=YES,AUTOSELECT=YES,URI="https://cdn.example.com/index-a1.m3u8?token=1"',
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="en",NAME="English",DEFAULT=NO,AUTOSELECT=YES,URI="https://cdn.example.com/index-a2.m3u8?token=1"',
      '#EXT-X-STREAM-INF:BANDWIDTH=6168663,RESOLUTION=1920x1080,AUDIO="audio"',
      'https://cdn.example.com/index-v1-a2.m3u8?token=1',
    ].join('\n');

    const sanitized = sanitizeByseMasterM3u8(vefaMaster);
    assert.equal(sanitized.includes('index-a1.m3u8'), false);
    assert.equal(sanitized.includes('index-a2.m3u8'), true);
    assert.equal(sanitized.includes('DEFAULT=YES,AUTOSELECT=YES,URI="https://cdn.example.com/index-a2.m3u8'), true);
  });

  it('infers video/mp4 for Streamtape .mkv.mp4 files while keeping video/x-matroska for true .mkv files', () => {
    assert.equal(
      inferProgressiveVideoMimeType(
        'https://tapecontent.net/get_video?id=1',
        'attachment; filename="Titanic.(1997).1080p.BluRay.x264.mkv.mp4"'
      ),
      'video/mp4'
    );
    assert.equal(
      inferProgressiveVideoMimeType('https://cdn.example.com/Titanic.mkv.mp4?token=1'),
      'video/mp4'
    );
    assert.equal(
      inferProgressiveVideoMimeType('https://cdn.example.com/Movie.1080p.mkv?token=1'),
      'video/x-matroska'
    );
  });
});

