import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLibraryDiscovery,
  computeNextQueueIndex,
  cycleThreeWayPlayMode,
  filterVisibleLibrarySongs,
  formatMusicDuration,
  getEqualizerPresetBands,
  getRainbowGradientForTrack,
  groupTracksByAlbum,
  groupTracksByArtist,
  groupTracksByFolder,
  insertPlayNextInQueue,
  parseMetadataFromFilename,
  resolvePlaylistFirstSongArtwork,
  searchLocalMusicLibrary,
  sortMusicTracks,
} from './musicUtils';
import { MusicTrack } from '../types/music';

const sampleTracks: MusicTrack[] = [
  {
    id: 't1',
    title: 'Midnight Drive',
    fileName: 'The Weeknd - Midnight Drive.mp3',
    artist: 'The Weeknd',
    album: 'After Hours',
    durationSec: 215,
    sizeMb: 5.2,
    folderName: 'Music',
    folderPath: 'Internal Storage/Music',
    format: 'MP3',
    mimeType: 'audio/mpeg',
    dateAdded: 1700000100,
    dateModified: 1700000100,
    playbackUrl: 'blob:t1',
    playCount: 12,
    lastPlayedAt: 1700005000,
  },
  {
    id: 't2',
    title: 'Aurora Borealis',
    fileName: 'Aurora Borealis.flac',
    artist: 'Hans Zimmer',
    album: 'Interstellar OST',
    durationSec: 340,
    sizeMb: 18.4,
    folderName: 'Soundtracks',
    folderPath: 'Internal Storage/Music/Soundtracks',
    format: 'FLAC',
    mimeType: 'audio/flac',
    dateAdded: 1700000500,
    dateModified: 1700000500,
    playbackUrl: 'blob:t2',
    playCount: 0,
    lastPlayedAt: 0,
  },
  {
    id: 't3',
    title: 'Short Notification Tone',
    fileName: 'ding.mp3',
    artist: 'Unknown Artist',
    album: 'Notifications',
    durationSec: 12,
    sizeMb: 0.2,
    folderName: 'Notifications',
    folderPath: 'Internal Storage/Notifications',
    format: 'MP3',
    mimeType: 'audio/mpeg',
    dateAdded: 1700000200,
    dateModified: 1700000200,
    playbackUrl: 'blob:t3',
    playCount: 2,
    lastPlayedAt: 1700001000,
  },
];

describe('musicUtils pure logic', () => {
  it('formats durations accurately in mm:ss and hh:mm:ss', () => {
    assert.equal(formatMusicDuration(0), '0:00');
    assert.equal(formatMusicDuration(65), '1:05');
    assert.equal(formatMusicDuration(3661), '1:01:01');
  });

  it('parses Artist - Title and format from filename', () => {
    const parsed = parseMetadataFromFilename('Arijit Singh - Kesariya (Official).mp3');
    assert.equal(parsed.artist, 'Arijit Singh');
    assert.equal(parsed.title, 'Kesariya (Official)');
    assert.equal(parsed.format, 'MP3');

    const fallback = parseMetadataFromFilename('Summer_Vibes_Mix.flac');
    assert.equal(fallback.artist, 'Unknown Artist');
    assert.equal(fallback.title, 'Summer_Vibes_Mix');
    assert.equal(fallback.format, 'FLAC');
  });

  it('filters out excluded folders, hidden song IDs, and short clips under 30s', () => {
    const filteredShort = filterVisibleLibrarySongs(sampleTracks, [], [], true);
    assert.equal(filteredShort.length, 2);
    assert.equal(filteredShort.some((t) => t.id === 't3'), false);

    const filteredFolder = filterVisibleLibrarySongs(
      sampleTracks,
      ['Internal Storage/Music/Soundtracks'],
      [],
      false
    );
    assert.equal(filteredFolder.some((t) => t.id === 't2'), false);
    assert.equal(filteredFolder.length, 2);
  });

  it('sorts tracks by name, duration, most_played, and recently_added', () => {
    const byName = sortMusicTracks(sampleTracks, 'name');
    assert.equal(byName[0].title, 'Aurora Borealis');

    const byDur = sortMusicTracks(sampleTracks, 'duration');
    assert.equal(byDur[0].id, 't2');

    const byPlayed = sortMusicTracks(sampleTracks, 'most_played');
    assert.equal(byPlayed[0].id, 't1');
  });

  it('groups tracks into albums, artists, and folders with exclusion flags', () => {
    const albums = groupTracksByAlbum(sampleTracks);
    assert.equal(albums.length, 3);

    const artists = groupTracksByArtist(sampleTracks);
    assert.equal(artists.length, 3);

    const folders = groupTracksByFolder(sampleTracks, ['Internal Storage/Notifications'], []);
    const notifFolder = folders.find((f) => f.name === 'Notifications');
    assert.equal(notifFolder?.isExcluded, true);
  });

  it('inserts Play Next track immediately after current playing track without duplicating', () => {
    const res = insertPlayNextInQueue([sampleTracks[0], sampleTracks[1]], 0, sampleTracks[2]);
    assert.equal(res.queue.length, 3);
    assert.equal(res.queue[1].id, 't3');
    assert.equal(res.nextCurrentIndex, 0);
  });

  it('computes next queue index for Repeat Off, Repeat All, and Repeat One', () => {
    assert.equal(computeNextQueueIndex(2, 3, 'off', false), -1);
    assert.equal(computeNextQueueIndex(2, 3, 'all', false), 0);
    assert.equal(computeNextQueueIndex(1, 3, 'one', false), 1);
  });

  it('computes discovery collections and local search results', () => {
    const discovery = computeLibraryDiscovery(sampleTracks);
    assert.equal(discovery.mostPlayed[0]?.id, 't1');
    assert.equal(discovery.unplayedSongs[0]?.id, 't2');
    assert.equal(discovery.longestTracks[0]?.id, 't2');

    const albums = groupTracksByAlbum(sampleTracks);
    const artists = groupTracksByArtist(sampleTracks);
    const folders = groupTracksByFolder(sampleTracks, [], []);
    const searchRes = searchLocalMusicLibrary('zimmer', sampleTracks, albums, artists, folders, []);
    assert.equal(searchRes.songs.length, 1);
    assert.equal(searchRes.artists.length, 1);
  });

  it('resolves Equalizer 5-band dB presets and playlist first-song artwork accurately', () => {
    assert.deepEqual(getEqualizerPresetBands('Flat'), [0, 0, 0, 0, 0]);
    assert.deepEqual(getEqualizerPresetBands('Heavy metal'), [4, 1, 9, 3, 0]);
    assert.deepEqual(getEqualizerPresetBands('Custom', [2, -1, 4, 3, -2]), [2, -1, 4, 3, -2]);

    const tracksWithPoster: MusicTrack[] = [
      { ...sampleTracks[0], artworkUrl: 'https://maxplay.local/art/1.jpg' },
      { ...sampleTracks[1], artworkUrl: 'https://maxplay.local/art/2.jpg' },
    ];
    assert.equal(resolvePlaylistFirstSongArtwork(tracksWithPoster), 'https://maxplay.local/art/1.jpg');
    assert.equal(resolvePlaylistFirstSongArtwork([sampleTracks[0]]), undefined);
    assert.equal(resolvePlaylistFirstSongArtwork([]), undefined);
  });

  it('cycles 1-button 3-way play mode (repeat_all -> repeat_one -> shuffle -> repeat_all) and generates rainbow gradient', () => {
    const step1 = cycleThreeWayPlayMode('all', false);
    assert.deepEqual(step1, {
      repeatMode: 'one',
      isShuffle: false,
      modeKey: 'repeat_one',
      label: 'Repeat current song',
    });

    const step2 = cycleThreeWayPlayMode(step1.repeatMode, step1.isShuffle);
    assert.deepEqual(step2, {
      repeatMode: 'off',
      isShuffle: true,
      modeKey: 'shuffle',
      label: 'Shuffle playback',
    });

    const step3 = cycleThreeWayPlayMode(step2.repeatMode, step2.isShuffle);
    assert.deepEqual(step3, {
      repeatMode: 'all',
      isShuffle: false,
      modeKey: 'repeat_all',
      label: 'Repeat all songs',
    });

    const grad = getRainbowGradientForTrack('track_123');
    assert.equal(typeof grad, 'string');
    assert.equal(grad.includes('from-'), true);
  });
});

