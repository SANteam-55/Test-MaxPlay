import {
  EqualizerPreset,
  MusicAlbum,
  MusicArtist,
  MusicFolder,
  MusicPlaylist,
  MusicSortOption,
  MusicTrack,
  RepeatMode,
} from '../types/music';

/**
 * Formats seconds into MM:SS or HH:MM:SS
 */
export function formatMusicDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Formats total seconds into human-readable summary (e.g., "1 hr 24 min" or "18 min 42 sec")
 */
export function formatTotalLibraryDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 min';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs} hr ${mins} min`;
  }
  if (mins > 0) {
    return `${mins} min ${secs} sec`;
  }
  return `${secs} sec`;
}

/**
 * Parses clean title and artist from an audio filename like "Arijit Singh - Kesariya (Official).mp3"
 */
export function parseMetadataFromFilename(fileName: string): {
  title: string;
  artist: string;
  format: string;
} {
  const rawName = (fileName || '').trim();
  const extMatch = rawName.match(/\.([a-z0-9]{2,5})$/i);
  const format = extMatch ? extMatch[1].toUpperCase() : 'MP3';
  const withoutExt = rawName.replace(/\.[a-z0-9]{2,5}$/i, '').trim();

  const dashParts = withoutExt.split(/\s+[-–—]\s+/);
  if (dashParts.length >= 2) {
    const candidateArtist = dashParts[0].trim();
    const candidateTitle = dashParts.slice(1).join(' - ').trim();
    if (candidateArtist && candidateTitle) {
      return {
        title: candidateTitle,
        artist: candidateArtist,
        format,
      };
    }
  }

  return {
    title: withoutExt || 'Unknown Track',
    artist: 'Unknown Artist',
    format,
  };
}

/**
 * Filters raw device songs based on excluded folder paths, hidden song IDs, and short-clip setting
 */
export function filterVisibleLibrarySongs(
  allTracks: MusicTrack[],
  excludedFolderPaths: string[],
  hiddenSongIds: string[],
  hideShortClipsUnder30s: boolean
): MusicTrack[] {
  const excludedSet = new Set(excludedFolderPaths.map((p) => p.toLowerCase().trim()));
  const hiddenSet = new Set(hiddenSongIds);

  return allTracks.filter((track) => {
    if (hiddenSet.has(track.id)) return false;
    const normFolder = (track.folderPath || track.folderName || '').toLowerCase().trim();
    if (normFolder && excludedSet.has(normFolder)) return false;
    // Also check if any parent folder path is excluded
    for (const ex of excludedSet) {
      if (ex && normFolder.startsWith(ex + '/')) return false;
    }
    if (hideShortClipsUnder30s && track.durationSec > 0 && track.durationSec < 30) {
      return false;
    }
    return true;
  });
}

/**
 * Sorts tracks by the user's selected MusicSortOption
 */
export function sortMusicTracks(tracks: MusicTrack[], sortBy: MusicSortOption): MusicTrack[] {
  const copy = [...tracks];
  switch (sortBy) {
    case 'name':
      return copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    case 'artist':
      return copy.sort((a, b) => {
        const cmp = a.artist.localeCompare(b.artist, undefined, { sensitivity: 'base' });
        return cmp !== 0 ? cmp : a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      });
    case 'album':
      return copy.sort((a, b) => {
        const cmp = a.album.localeCompare(b.album, undefined, { sensitivity: 'base' });
        return cmp !== 0 ? cmp : a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      });
    case 'duration':
      return copy.sort((a, b) => b.durationSec - a.durationSec);
    case 'recently_added':
      return copy.sort((a, b) => (b.dateAdded || b.dateModified || 0) - (a.dateAdded || a.dateModified || 0));
    case 'recently_played':
      return copy.sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
    case 'most_played':
      return copy.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    default:
      return copy;
  }
}

/**
 * Groups visible tracks into Albums
 */
export function groupTracksByAlbum(tracks: MusicTrack[]): MusicAlbum[] {
  const map = new Map<string, MusicAlbum>();
  for (const track of tracks) {
    const albumName = (track.album || 'Unknown Album').trim() || 'Unknown Album';
    const key = albumName.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.tracks.push(track);
      existing.totalDurationSec += track.durationSec || 0;
      if (!existing.artworkUrl && track.artworkUrl) {
        existing.artworkUrl = track.artworkUrl;
      }
    } else {
      map.set(key, {
        id: `album_${key.replace(/[^a-z0-9]/g, '_')}`,
        name: albumName,
        artist: track.artist || 'Unknown Artist',
        artworkUrl: track.artworkUrl,
        tracks: [track],
        totalDurationSec: track.durationSec || 0,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

/**
 * Groups visible tracks into Artists with their respective Albums and Tracks
 */
export function groupTracksByArtist(tracks: MusicTrack[]): MusicArtist[] {
  const map = new Map<string, MusicTrack[]>();
  for (const track of tracks) {
    const artistName = (track.artist || 'Unknown Artist').trim() || 'Unknown Artist';
    const key = artistName.toLowerCase();
    const list = map.get(key);
    if (list) {
      list.push(track);
    } else {
      map.set(key, [track]);
    }
  }

  const artists: MusicArtist[] = [];
  for (const [key, artistTracks] of map.entries()) {
    const displayName = artistTracks[0]?.artist || 'Unknown Artist';
    const albums = groupTracksByAlbum(artistTracks);
    const totalDurationSec = artistTracks.reduce((acc, t) => acc + (t.durationSec || 0), 0);
    const artworkUrl = artistTracks.find((t) => Boolean(t.artworkUrl))?.artworkUrl;
    artists.push({
      id: `artist_${key.replace(/[^a-z0-9]/g, '_')}`,
      name: displayName,
      artworkUrl,
      tracks: artistTracks,
      albums,
      totalDurationSec,
    });
  }

  return artists.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/**
 * Groups all tracks (including excluded ones if requested) into Folders
 */
export function groupTracksByFolder(
  allTracks: MusicTrack[],
  excludedFolderPaths: string[],
  hiddenSongIds: string[]
): MusicFolder[] {
  const excludedSet = new Set(excludedFolderPaths.map((p) => p.toLowerCase().trim()));
  const hiddenSet = new Set(hiddenSongIds);
  const map = new Map<string, MusicFolder>();

  for (const track of allTracks) {
    if (hiddenSet.has(track.id)) continue;
    const rawPath = (track.folderPath || `Internal Storage/${track.folderName || 'Music'}`).trim();
    const key = rawPath.toLowerCase();
    const isExcluded = excludedSet.has(key);
    const existing = map.get(key);
    if (existing) {
      existing.tracks.push(track);
      existing.totalDurationSec += track.durationSec || 0;
      existing.totalSizeMb = Math.round((existing.totalSizeMb + (track.sizeMb || 0)) * 100) / 100;
    } else {
      map.set(key, {
        path: rawPath,
        name: track.folderName || rawPath.split('/').pop() || 'Music',
        tracks: [track],
        totalDurationSec: track.durationSec || 0,
        totalSizeMb: Math.round((track.sizeMb || 0) * 100) / 100,
        isExcluded,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

/**
 * Computes smart local library discovery collections (No online data, 100% local library based)
 */
export function computeLibraryDiscovery(visibleTracks: MusicTrack[]) {
  const mostPlayed = [...visibleTracks]
    .filter((t) => (t.playCount || 0) > 0)
    .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
    .slice(0, 25);

  const recentlyAdded = [...visibleTracks]
    .sort((a, b) => (b.dateAdded || b.dateModified || 0) - (a.dateAdded || a.dateModified || 0))
    .slice(0, 25);

  const recentlyPlayed = [...visibleTracks]
    .filter((t) => (t.lastPlayedAt || 0) > 0)
    .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
    .slice(0, 25);

  const unplayedSongs = visibleTracks.filter((t) => !(t.playCount && t.playCount > 0));

  const longestTracks = [...visibleTracks]
    .sort((a, b) => (b.durationSec || 0) - (a.durationSec || 0))
    .slice(0, 25);

  return {
    mostPlayed,
    recentlyAdded,
    recentlyPlayed,
    unplayedSongs,
    longestTracks,
  };
}

/**
 * Computes next queue index based on RepeatMode and Shuffle
 */
export function computeNextQueueIndex(
  currentIndex: number,
  queueLength: number,
  repeatMode: RepeatMode,
  isShuffle: boolean
): number {
  if (queueLength <= 0) return -1;
  if (repeatMode === 'one') return currentIndex;

  if (isShuffle && queueLength > 1) {
    let next = Math.floor(Math.random() * queueLength);
    if (next === currentIndex) {
      next = (currentIndex + 1) % queueLength;
    }
    return next;
  }

  const nextSequential = currentIndex + 1;
  if (nextSequential < queueLength) {
    return nextSequential;
  }
  return repeatMode === 'all' ? 0 : -1;
}

/**
 * Inserts a track right after the currently playing track in the queue ("Play Next")
 */
export function insertPlayNextInQueue(
  queue: MusicTrack[],
  currentIndex: number,
  trackToInsert: MusicTrack
): { queue: MusicTrack[]; nextCurrentIndex: number } {
  if (queue.length === 0) {
    return { queue: [trackToInsert], nextCurrentIndex: 0 };
  }
  const currentTrackId = queue[currentIndex]?.id;
  // Remove duplicate if it exists elsewhere in the queue (except current playing index)
  const filtered: MusicTrack[] = [];
  let updatedCurrentIdx = 0;
  queue.forEach((item, idx) => {
    if (idx === currentIndex) {
      updatedCurrentIdx = filtered.length;
      filtered.push(item);
    } else if (item.id !== trackToInsert.id) {
      filtered.push(item);
    }
  });

  if (currentTrackId === trackToInsert.id && filtered.length === 1) {
    return { queue: filtered, nextCurrentIndex: 0 };
  }

  const insertPos = Math.min(filtered.length, updatedCurrentIdx + 1);
  filtered.splice(insertPos, 0, trackToInsert);
  return { queue: filtered, nextCurrentIndex: updatedCurrentIdx };
}

/**
 * Searches songs, albums, artists, folders, and playlists locally
 */
export function searchLocalMusicLibrary(
  query: string,
  tracks: MusicTrack[],
  albums: MusicAlbum[],
  artists: MusicArtist[],
  folders: MusicFolder[],
  playlists: MusicPlaylist[]
) {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    return {
      songs: [] as MusicTrack[],
      albums: [] as MusicAlbum[],
      artists: [] as MusicArtist[],
      folders: [] as MusicFolder[],
      playlists: [] as MusicPlaylist[],
    };
  }

  return {
    songs: tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.folderName.toLowerCase().includes(q)
    ),
    albums: albums.filter(
      (a) => a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    ),
    artists: artists.filter((ar) => ar.name.toLowerCase().includes(q)),
    folders: folders.filter(
      (f) => !f.isExcluded && (f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
    ),
    playlists: playlists.filter((p) => p.name.toLowerCase().includes(q)),
  };
}

export const EQUALIZER_BAND_LABELS = ['60Hz', '230Hz', '910Hz', '3.6kHz', '14.0kHz'] as const;
export const EQUALIZER_FREQUENCIES = [60, 230, 910, 3600, 14000] as const;

export const EQUALIZER_PRESET_LIST: EqualizerPreset[] = [
  'Custom',
  'Regular',
  'Classical',
  'Dance',
  'Flat',
  'Folk',
  'Heavy metal',
  'Hip-hop',
  'Jazz',
  'Pop',
  'Rock',
];

export const EQUALIZER_PRESET_BANDS: Record<EqualizerPreset, [number, number, number, number, number]> = {
  Custom: [0, 0, 0, 0, 0],
  Regular: [3, 0, 0, 0, 3],
  Classical: [5, 3, -2, 4, 4],
  Dance: [6, 0, 2, 4, 1],
  Flat: [0, 0, 0, 0, 0],
  Folk: [3, 0, 0, 2, -1],
  'Heavy metal': [4, 1, 9, 3, 0],
  'Hip-hop': [5, 3, 0, 1, 3],
  Jazz: [4, 2, -2, 2, 5],
  Pop: [-1, 2, 5, 1, -2],
  Rock: [5, 3, -1, 3, 5],
};

export function getEqualizerPresetBands(
  preset: EqualizerPreset,
  fallbackCustom: [number, number, number, number, number] = [0, 0, 0, 0, 0]
): [number, number, number, number, number] {
  if (preset === 'Custom') {
    return [...fallbackCustom] as [number, number, number, number, number];
  }
  const bands = EQUALIZER_PRESET_BANDS[preset] || EQUALIZER_PRESET_BANDS.Flat;
  return [...bands] as [number, number, number, number, number];
}

/**
 * Resolves the cover artwork of a playlist from its first song that has an artwork URL.
 */
export function resolvePlaylistFirstSongArtwork(
  playlistTracks: MusicTrack[]
): string | undefined {
  if (!Array.isArray(playlistTracks) || playlistTracks.length === 0) return undefined;
  const firstTrack = playlistTracks[0];
  return firstTrack?.artworkUrl || undefined;
}

/**
 * Cycles the 1-button 3-way playback mode:
 * 1st mode -> Repeat All (repeatMode = 'all', isShuffle = false)
 * 2nd mode -> Repeat One Song (repeatMode = 'one', isShuffle = false)
 * 3rd mode -> Shuffle / Random Song (repeatMode = 'off', isShuffle = true)
 */
export function cycleThreeWayPlayMode(
  repeatMode: RepeatMode,
  isShuffle: boolean
): {
  repeatMode: RepeatMode;
  isShuffle: boolean;
  modeKey: 'repeat_all' | 'repeat_one' | 'shuffle';
  label: string;
} {
  if (isShuffle) {
    return {
      repeatMode: 'all',
      isShuffle: false,
      modeKey: 'repeat_all',
      label: 'Repeat all songs',
    };
  }
  if (repeatMode === 'all') {
    return {
      repeatMode: 'one',
      isShuffle: false,
      modeKey: 'repeat_one',
      label: 'Repeat current song',
    };
  }
  if (repeatMode === 'one') {
    return {
      repeatMode: 'off',
      isShuffle: true,
      modeKey: 'shuffle',
      label: 'Shuffle playback',
    };
  }
  // If repeatMode was 'off' and isShuffle was false, start at 1st mode (Repeat All)
  return {
    repeatMode: 'all',
    isShuffle: false,
    modeKey: 'repeat_all',
    label: 'Repeat all songs',
  };
}

const RAINBOW_ACCENT_GRADIENTS = [
  'from-[#FF3CAC] via-[#784BA0] to-[#2B86C5]',
  'from-[#FA8BFF] via-[#2BD2FF] to-[#2BFF88]',
  'from-[#FF6A88] via-[#A855F7] to-[#3B82F6]',
  'from-[#7928CA] via-[#FF0080] to-[#FF8C00]',
  'from-[#00DBDE] via-[#FC00FF] to-[#FFAA00]',
  'from-[#60A5FA] via-[#A855F7] to-[#F472B6]',
  'from-[#F857A6] via-[#FF5858] to-[#FFC837]',
  'from-[#4158D0] via-[#C850C0] to-[#FFCC70]',
];

/**
 * Returns a deterministic vibrant rainbow / multi-color accent gradient for any track without custom cover art.
 */
export function getRainbowGradientForTrack(seedStr?: string): string {
  const s = (seedStr || 'maxplay').trim();
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return RAINBOW_ACCENT_GRADIENTS[hash % RAINBOW_ACCENT_GRADIENTS.length];
}


