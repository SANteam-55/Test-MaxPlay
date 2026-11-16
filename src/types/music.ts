export type MusicSortOption =
  | 'name'
  | 'artist'
  | 'album'
  | 'duration'
  | 'recently_added'
  | 'recently_played'
  | 'most_played';

export type RepeatMode = 'off' | 'all' | 'one';

export type PlayModeThreeWay = 'repeat_all' | 'repeat_one' | 'shuffle';

export type VolumeBoostLevel = 100 | 200 | 300;

export type SleepTimerMode = 'off' | '5' | '10' | '15' | '30' | '45' | '60' | 'end_of_song';

export type MusicSubTab = 'home' | 'songs' | 'albums' | 'artists' | 'folders' | 'playlists';

export interface MusicTrack {
  id: string;
  mediaId?: string;
  title: string;
  fileName: string;
  artist: string;
  album: string;
  albumId?: string;
  durationSec: number;
  sizeMb: number;
  sizeBytes?: number;
  folderName: string;
  folderPath: string;
  format: string;
  mimeType: string;
  dateAdded: number;
  dateModified: number;
  playbackUrl: string;
  artworkUrl?: string;
  lyrics?: string;
  playCount?: number;
  lastPlayedAt?: number;
  isFavorite?: boolean;
}

export interface MusicAlbum {
  id: string;
  name: string;
  artist: string;
  artworkUrl?: string;
  tracks: MusicTrack[];
  totalDurationSec: number;
}

export interface MusicArtist {
  id: string;
  name: string;
  artworkUrl?: string;
  tracks: MusicTrack[];
  albums: MusicAlbum[];
  totalDurationSec: number;
}

export interface MusicFolder {
  path: string;
  name: string;
  tracks: MusicTrack[];
  totalDurationSec: number;
  totalSizeMb: number;
  isExcluded?: boolean;
}

export interface MusicPlaylist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
  isSystem?: boolean;
}

export interface MusicSettingsState {
  hideShortClipsUnder30s: boolean;
  gaplessPlayback: boolean;
  crossfadeSec: number;
  resumeOnLaunch: boolean;
  autoPlayFolder: boolean;
  rememberPosition: boolean;
  accentColor: '#6A11CB' | '#8E2DE2' | '#B517FF';
  artworkRounded: 'rounded' | 'square';
  showFolderPathInList: boolean;
  backgroundPlayback: boolean;
  notificationControls: boolean;
  lockScreenControls: boolean;
  headphoneControls: boolean;
  pauseOnDisconnect: boolean;
  audioFocusHandling: boolean;
}

export type EqualizerPreset =
  | 'Custom'
  | 'Regular'
  | 'Classical'
  | 'Dance'
  | 'Flat'
  | 'Folk'
  | 'Heavy metal'
  | 'Hip-hop'
  | 'Jazz'
  | 'Pop'
  | 'Rock';

export interface MusicEqualizerState {
  enabled: boolean;
  preset: EqualizerPreset;
  bands: [number, number, number, number, number]; // [60Hz, 230Hz, 910Hz, 3.6kHz, 14.0kHz] in dB (-12 to +12)
  bassLevel: number; // 0 to 100
  immersiveLevel: number; // 0 to 100
}

export interface CustomSongMetadata {
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  lyrics?: string;
}

