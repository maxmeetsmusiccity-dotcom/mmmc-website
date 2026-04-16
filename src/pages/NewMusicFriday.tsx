import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { startAuth, exchangeCode, getToken, clearToken, refreshToken, isTokenExpired } from '../lib/auth';
import {
  fetchFollowedArtists,
  fetchNewReleases,
  getLastFriday,
  getScanCutoff,
  groupIntoReleases,
  replacePlaylistTracks,
  appendPlaylistTracks,
  createPlaylist,
  type TrackItem,
  type ReleaseCluster,
} from '../lib/spotify';
import {
  type SelectionSlot,
  buildSlots,
  getSlideGroup,
} from '../lib/selection';
import { downloadArt } from '../lib/downloads';
import { saveWeek, saveFeatures, getFeatureCounts, type NMFWeek } from '../lib/supabase';
import { batchResolveAppleMusic } from '../lib/apple-music';
import ArtistClusterCard from '../components/ArtistClusterCard';
import { type ArtistGroup, groupByPrimaryArtist } from '../lib/artist-grouping';
import PlaylistSection from '../components/PlaylistSection';
import ShareCaptionSection from '../components/ShareCaptionSection';
import MobileToolsSheet from '../components/MobileToolsSheet';
import StickyToolbar from '../components/StickyToolbar';
import WeekHistory from '../components/WeekHistory';
import EmbedWidget from '../components/EmbedWidget';
import ProductNav from '../components/ProductNav';
import SourceSelector from '../components/SourceSelector';
import ManualImport from '../components/ManualImport';
import ErrorBoundary from '../components/ErrorBoundary';

// Lazy-loaded heavy components
const NashvilleReleases = lazy(() => import('../components/NashvilleReleases'));
const MobileResultsView = lazy(() => import('../components/MobileResultsView'));
// Eager import — also used as hidden mobile panel for ref availability on first generate tap
import CarouselPreviewPanel from '../components/CarouselPreviewPanel';
import TrackSuggestions from '../components/TrackSuggestions';
import { queueNewArtistsForEnrichment } from '../lib/enrichment';
import type { MusicSource } from '../lib/sources/types';
import ToastContainer from '../components/Toast';
import KeyboardHelp from '../components/KeyboardHelp';
import Onboarding from '../components/Onboarding';
import { checkScanHealth } from '../lib/spotify';
import { useAuth } from '../lib/auth-context';
import { useSelectionManager } from '../hooks/useSelectionManager';
import { useCarouselState } from '../hooks/useCarouselState';

type Phase = 'auth' | 'ready' | 'scanning' | 'results';
type FilterKey = 'all' | 'single' | 'album';
type SortKey = 'date' | 'artist' | 'title';

interface ShowcaseCategory {
  id: string;
  name: string;
  emoji: string;
  type: string;
  count: number;
}

const PLAYLIST_ID = '0ve1vYFkWoRaElCmfkw2IB';

function demoTrack(id: number, name: string, artist: string, album: string, albumId: string, type: string, date: string, total: number, trackNum: number, _seed: string, c640: string, c300: string, c64: string, trackId?: string, trackUri?: string): TrackItem {
  return { track_id: trackId || `demo${id}`, track_uri: trackUri || '', track_name: name, track_number: trackNum, artist_names: artist, artist_id: `demoa${id}`, artist_spotify_url: '', artist_genres: ['country'], artist_followers: 100000 + id * 50000, album_name: album, album_spotify_id: albumId, album_type: type, album_spotify_url: '', cover_art_300: c300, cover_art_640: c640, cover_art_64: c64, release_date: date, total_tracks: total, track_spotify_url: '', duration_ms: 180000 + id * 3000, explicit: id % 7 === 0 };
}

const DEMO_TRACKS: TrackItem[] = [
  // Real data from manifest.csv — actual Spotify cover art URLs
  demoTrack(1, 'Catch A Break', 'Niklas Juritsch', 'Catch A Break', '4Ug5YTh15qgtw5NejwiEcM', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273d64463967fec2e2f9de9103f', 'https://i.scdn.co/image/ab67616d00001e02d64463967fec2e2f9de9103f', 'https://i.scdn.co/image/ab67616d00004851d64463967fec2e2f9de9103f', '2aqBWuufuFqVL3wWAqACxl', 'spotify:track:2aqBWuufuFqVL3wWAqACxl'),
  demoTrack(2, 'Superwoman - Live From Nashville', 'MORIAH', 'Superwoman', '3Gin9HuDjMIlpomJH1rCyR', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b2739c7f45b0a8971771e0810ec1', 'https://i.scdn.co/image/ab67616d00001e029c7f45b0a8971771e0810ec1', 'https://i.scdn.co/image/ab67616d000048519c7f45b0a8971771e0810ec1', '7lmEsMluUwzBszcjlH0wHT', 'spotify:track:7lmEsMluUwzBszcjlH0wHT'),
  demoTrack(3, 'Second Look', 'Justine Beverley', 'Second Look', '3VEwZMIAE517xvoDjRDNf0', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b2738e1025cb7d76884b68be2a6e', 'https://i.scdn.co/image/ab67616d00001e028e1025cb7d76884b68be2a6e', 'https://i.scdn.co/image/ab67616d000048518e1025cb7d76884b68be2a6e', '1j55zzwNwyhYRyzRfX4ToS', 'spotify:track:1j55zzwNwyhYRyzRfX4ToS'),
  demoTrack(4, 'Lose My Mind', 'Callie Prince', 'Lose My Mind', '6dialcQabBKSrQzneuRZAt', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b2734406cfe603159d919c16eb9b', 'https://i.scdn.co/image/ab67616d00001e024406cfe603159d919c16eb9b', 'https://i.scdn.co/image/ab67616d000048514406cfe603159d919c16eb9b', '2wTe6Oyx1fYSzPJxkz9g0Q', 'spotify:track:2wTe6Oyx1fYSzPJxkz9g0Q'),
  demoTrack(5, 'Impossible Heights', 'Girl Named Tom', 'Dust to Dust', '6jbspEb4NENNXc1wxNGtSs', 'album', '2026-04-02', 8, 1, '', 'https://i.scdn.co/image/ab67616d0000b273ba2a0376e820f16a7004ead1', 'https://i.scdn.co/image/ab67616d00001e02ba2a0376e820f16a7004ead1', 'https://i.scdn.co/image/ab67616d00004851ba2a0376e820f16a7004ead1', '0h8dzlZFWRjTcVGGPBK71A', 'spotify:track:0h8dzlZFWRjTcVGGPBK71A'),
  demoTrack(6, 'I Love You, I\'m Sorry', 'Sam Williams', 'I Love You, I\'m Sorry', '4VwigE0LFtuQsySUZps1S6', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273ad68e99b6cdbcbea04ef35de', 'https://i.scdn.co/image/ab67616d00001e02ad68e99b6cdbcbea04ef35de', 'https://i.scdn.co/image/ab67616d00004851ad68e99b6cdbcbea04ef35de', '6GR0YupR47jAp7QkIJq53A', 'spotify:track:6GR0YupR47jAp7QkIJq53A'),
  demoTrack(7, 'Outlaw', 'Shinedown', 'Outlaw', '01uAt6BlE8cXEIZcxVfd9O', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273b4bb2945e098f762ff767374', 'https://i.scdn.co/image/ab67616d00001e02b4bb2945e098f762ff767374', 'https://i.scdn.co/image/ab67616d00004851b4bb2945e098f762ff767374', '3y8Tr7Bv18p6cZlf1Ombpy', 'spotify:track:3y8Tr7Bv18p6cZlf1Ombpy'),
  demoTrack(8, 'Risk It - Stripped', 'Erin Gibney', 'Risk It (Stripped)', '6xd1Whm8vjr6wTQ9Zw4F76', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b27357f7e9e6f5628f2ec62aa2ae', 'https://i.scdn.co/image/ab67616d00001e0257f7e9e6f5628f2ec62aa2ae', 'https://i.scdn.co/image/ab67616d0000485157f7e9e6f5628f2ec62aa2ae', '6rE61wlds6thNb9linfMit', 'spotify:track:6rE61wlds6thNb9linfMit'),
  demoTrack(9, 'Same Boy, Different Truck', 'Kyrsta McKade', 'Same Boy, Different Truck', '6FjWmFbtpxL6O0Y9GtkGTs', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273f59f4d2d7c942475cc7fa68a', 'https://i.scdn.co/image/ab67616d00001e02f59f4d2d7c942475cc7fa68a', 'https://i.scdn.co/image/ab67616d00004851f59f4d2d7c942475cc7fa68a', '2Ickt4NCj7IMtLTwkjDoMs', 'spotify:track:2Ickt4NCj7IMtLTwkjDoMs'),
  demoTrack(10, 'Alternate Ending', 'Thelma & James', 'Alternate Ending', '1imXHb4yzZBWR5ZEZZVaRJ', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273323fdaa356567dbf2c38daec', 'https://i.scdn.co/image/ab67616d00001e02323fdaa356567dbf2c38daec', 'https://i.scdn.co/image/ab67616d00004851323fdaa356567dbf2c38daec', '4ARFJVAoSfB6pw5lZ9AnAI', 'spotify:track:4ARFJVAoSfB6pw5lZ9AnAI'),
  demoTrack(11, 'Faith', 'Mason Ramsey', 'Faith', '2fcobRv1jmp1zSvlgNhCJY', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273bac3203002f1bfb19cb12509', 'https://i.scdn.co/image/ab67616d00001e02bac3203002f1bfb19cb12509', 'https://i.scdn.co/image/ab67616d00004851bac3203002f1bfb19cb12509', '182zLHVTixcAcB7aHX9YtZ', 'spotify:track:182zLHVTixcAcB7aHX9YtZ'),
  demoTrack(12, 'Damn, When I Do', 'Bonnie Stewart', 'Damn, When I Do', '09WEqdzFWmtrXPKBfF16q8', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b27306ad6aa6ee8a76c593310796', 'https://i.scdn.co/image/ab67616d00001e0206ad6aa6ee8a76c593310796', 'https://i.scdn.co/image/ab67616d0000485106ad6aa6ee8a76c593310796', '5ls68mlFW75aQjplxekoV0', 'spotify:track:5ls68mlFW75aQjplxekoV0'),
  demoTrack(13, 'I Can\'t Make You Love Me', 'Gillian Smith', 'I Can\'t Make You Love Me', '7I70aahk1JDBCUS4BxkLns', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273270a40474b169f8a1bf924d1', 'https://i.scdn.co/image/ab67616d00001e02270a40474b169f8a1bf924d1', 'https://i.scdn.co/image/ab67616d00004851270a40474b169f8a1bf924d1', '4GFaSUQDQKrGMqvDybSQ4C', 'spotify:track:4GFaSUQDQKrGMqvDybSQ4C'),
  demoTrack(14, 'I Miss Him', 'Madison Parks', 'I Miss Him', '5ctozlJgHQfAnO6ELfbJu7', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273ec33c7d0062a78a1aa405836', 'https://i.scdn.co/image/ab67616d00001e02ec33c7d0062a78a1aa405836', 'https://i.scdn.co/image/ab67616d00004851ec33c7d0062a78a1aa405836', '5d2uxTuOjgRgHj0jjrQvhA', 'spotify:track:5d2uxTuOjgRgHj0jjrQvhA'),
  demoTrack(15, 'Best Worst Problem', 'Jordyn Shellhart', 'Best Worst Problem', '2ZeNNmuzRz1fKsG44AZYbw', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273673bbcb357fab27a0d0870b2', 'https://i.scdn.co/image/ab67616d00001e02673bbcb357fab27a0d0870b2', 'https://i.scdn.co/image/ab67616d00004851673bbcb357fab27a0d0870b2', '4sHvcRSFnUxSoj5BdYigAO', 'spotify:track:4sHvcRSFnUxSoj5BdYigAO'),
  demoTrack(16, 'Lightning', 'Clever', 'Lightning', '7E82ZGXvzlIPvpXY9FJ9WF', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273f7411d05d801b5496b9736a2', 'https://i.scdn.co/image/ab67616d00001e02f7411d05d801b5496b9736a2', 'https://i.scdn.co/image/ab67616d00004851f7411d05d801b5496b9736a2', '6ZNIYeRCqejujZrWIZihhd', 'spotify:track:6ZNIYeRCqejujZrWIZihhd'),
  demoTrack(17, 'Borrowed Time', 'Sam Barber', 'Broken View', '6tDWxFwFa678P6qTiuyUqg', 'album', '2026-04-03', 13, 1, '', 'https://i.scdn.co/image/ab67616d0000b2733d49234ac727772bab9e68d0', 'https://i.scdn.co/image/ab67616d00001e023d49234ac727772bab9e68d0', 'https://i.scdn.co/image/ab67616d000048513d49234ac727772bab9e68d0', '0MHOroFaFxvWFdqEgJcrn5', 'spotify:track:0MHOroFaFxvWFdqEgJcrn5'),
  demoTrack(18, '1,000 Lifetimes (Wedding Version)', 'Gareth', '1,000 Lifetimes (Wedding Version)', '7I2Dhx1ZULHsxryqapE5LX', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b2733c5b62b1c58aa3c922887e23', 'https://i.scdn.co/image/ab67616d00001e023c5b62b1c58aa3c922887e23', 'https://i.scdn.co/image/ab67616d000048513c5b62b1c58aa3c922887e23', '4ovb8nQ7cSD00iMSNkpsHc', 'spotify:track:4ovb8nQ7cSD00iMSNkpsHc'),
  demoTrack(19, 'LIPSTICK ON A PIG', 'Colby Acuff', 'LIPSTICK ON A PIG', '2w8fEIPj57SD700dfv53EW', 'single', '2026-03-31', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273cd58b838ee21a4bf9dc2706d', 'https://i.scdn.co/image/ab67616d00001e02cd58b838ee21a4bf9dc2706d', 'https://i.scdn.co/image/ab67616d00004851cd58b838ee21a4bf9dc2706d', '5qPtFhfDr8rrNSsBihWteD', 'spotify:track:5qPtFhfDr8rrNSsBihWteD'),
  demoTrack(20, 'When No One\'s Around', 'Tayler Holder', 'When No One\'s Around', '4m5vI1NsjJ3MvsjrV4n042', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273c28d11b88e7421c12af3fa8f', 'https://i.scdn.co/image/ab67616d00001e02c28d11b88e7421c12af3fa8f', 'https://i.scdn.co/image/ab67616d00004851c28d11b88e7421c12af3fa8f', '6ui4qJEnZYZBX4qrGEJrM0', 'spotify:track:6ui4qJEnZYZBX4qrGEJrM0'),
  demoTrack(21, 'Gray Matter', 'Brooks Huntley', 'Gray Matter', '5WwN34WvKKOj3LqW3UkVZq', 'single', '2026-04-01', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273271d846ff4119d92604e6125', 'https://i.scdn.co/image/ab67616d00001e02271d846ff4119d92604e6125', 'https://i.scdn.co/image/ab67616d00004851271d846ff4119d92604e6125', '6sA9CIxZTyH2Yd2QdkLdbz', 'spotify:track:6sA9CIxZTyH2Yd2QdkLdbz'),
  demoTrack(22, 'Southern Rock', 'Cassidy Daniels', 'Southern Rock', '4F5BHJ6Pu2HFfA3RU6hGUS', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273fca90adbd09dba6575e7c541', 'https://i.scdn.co/image/ab67616d00001e02fca90adbd09dba6575e7c541', 'https://i.scdn.co/image/ab67616d00004851fca90adbd09dba6575e7c541', '2eaav9TAOQiurXbsUTsrZ9', 'spotify:track:2eaav9TAOQiurXbsUTsrZ9'),
  demoTrack(23, 'One Day I Will', 'Lockwood Barr', 'One Day I Will', '5d9uCpc7FXd2tbJ8DkmftP', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b2733ed716af00c850d712a6bdba', 'https://i.scdn.co/image/ab67616d00001e023ed716af00c850d712a6bdba', 'https://i.scdn.co/image/ab67616d000048513ed716af00c850d712a6bdba', '09CI1GGsz34g54FfZmZD2n', 'spotify:track:09CI1GGsz34g54FfZmZD2n'),
  demoTrack(24, 'Shiny New Thing', 'Kayley Bishop', 'Little Dove (Live From Nashville)', '1m39SSBHgYD7IHGXv0u2Us', 'album', '2026-04-03', 14, 1, '', 'https://i.scdn.co/image/ab67616d0000b273328f0f50b5599e115fc5847b', 'https://i.scdn.co/image/ab67616d00001e02328f0f50b5599e115fc5847b', 'https://i.scdn.co/image/ab67616d00004851328f0f50b5599e115fc5847b', '2FyzNxDUMAxe0NvVEbwWBM', 'spotify:track:2FyzNxDUMAxe0NvVEbwWBM'),
  demoTrack(25, 'forever', 'Jake Puliti', 'forever', '60y6N0vuVGSB8msKuuVmyS', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273a853c1b10e2f3d35a217a3c7', 'https://i.scdn.co/image/ab67616d00001e02a853c1b10e2f3d35a217a3c7', 'https://i.scdn.co/image/ab67616d00004851a853c1b10e2f3d35a217a3c7', '0nAUE146lK1lKwszMSPJbB', 'spotify:track:0nAUE146lK1lKwszMSPJbB'),
  demoTrack(26, 'STARLET', 'Ella Boh', 'STARLET', '7jG25C6PpgXzeZsXfyN47R', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b27333d86f07925df4681a3090e7', 'https://i.scdn.co/image/ab67616d00001e0233d86f07925df4681a3090e7', 'https://i.scdn.co/image/ab67616d0000485133d86f07925df4681a3090e7', '7fRaZXWjyVuJX9vkzGv0Dw', 'spotify:track:7fRaZXWjyVuJX9vkzGv0Dw'),
  demoTrack(27, 'LEAVIN\'', 'David J', 'LEAVIN\'', '7G1lZgwsHKzVC8cOeO4WOa', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273778e5c2e88c2d4f03cb301c9', 'https://i.scdn.co/image/ab67616d00001e02778e5c2e88c2d4f03cb301c9', 'https://i.scdn.co/image/ab67616d00004851778e5c2e88c2d4f03cb301c9', '7i7gUiOhASSBMBdgmagxBi', 'spotify:track:7i7gUiOhASSBMBdgmagxBi'),
  demoTrack(28, 'All In Already', 'Mackenzie Carpenter', 'All In Already', '1T9NKk59hEJVPYIi6K55xL', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b2737973dcf4c5219dff3a9dfa77', 'https://i.scdn.co/image/ab67616d00001e027973dcf4c5219dff3a9dfa77', 'https://i.scdn.co/image/ab67616d000048517973dcf4c5219dff3a9dfa77', '4dyhUKHZjlFyJHB6zlg904', 'spotify:track:4dyhUKHZjlFyJHB6zlg904'),
  demoTrack(29, 'paloma', 'Ashley Anne', 'paloma', '1jWxzB439p4Edc5L7LmaTo', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b27313c714ff8848b05cdcafc3f7', 'https://i.scdn.co/image/ab67616d00001e0213c714ff8848b05cdcafc3f7', 'https://i.scdn.co/image/ab67616d0000485113c714ff8848b05cdcafc3f7', '1jf0kGhPYaOmsDzCm0lDI4', 'spotify:track:1jf0kGhPYaOmsDzCm0lDI4'),
  demoTrack(30, 'Let The Games Begin', 'Chloe Collins', 'Let The Games Begin', '4tAJ2JO7vjgkXas1l8kU3Q', 'single', '2026-04-02', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b27391622b40a0b021354a49f66a', 'https://i.scdn.co/image/ab67616d00001e0291622b40a0b021354a49f66a', 'https://i.scdn.co/image/ab67616d0000485191622b40a0b021354a49f66a', '3QiD3ek6JlNNeLyX6Pspaj', 'spotify:track:3QiD3ek6JlNNeLyX6Pspaj'),
  demoTrack(31, 'The Jesus I Know Now', 'Lainey Wilson', 'The Jesus I Know Now', '7lnIDIoFSoHRRx2XJTsxju', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b2737bfb4c3d913ffcfecf0ed57e', 'https://i.scdn.co/image/ab67616d00001e027bfb4c3d913ffcfecf0ed57e', 'https://i.scdn.co/image/ab67616d000048517bfb4c3d913ffcfecf0ed57e', '5b1kZLzylm4PWvlX6DEklE', 'spotify:track:5b1kZLzylm4PWvlX6DEklE'),
  demoTrack(32, 'Cowgirl\'s Prayer', 'Danielle Bradbery', 'Cowgirl\'s Prayer', '1hYeAlSgqtocS7UjFXpy3U', 'single', '2026-04-03', 2, 1, '', 'https://i.scdn.co/image/ab67616d0000b2734992b05789773837bee9d7db', 'https://i.scdn.co/image/ab67616d00001e024992b05789773837bee9d7db', 'https://i.scdn.co/image/ab67616d000048514992b05789773837bee9d7db', '7zK7A1WPsnCaBZ2j2z1ELK', 'spotify:track:7zK7A1WPsnCaBZ2j2z1ELK'),
  demoTrack(33, 'Stepdad', 'Jay Allen', 'Stepdad', '6ymyg2hbVVHY9B3JZpOwyO', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b27380e1b67b901638a450504ab6', 'https://i.scdn.co/image/ab67616d00001e0280e1b67b901638a450504ab6', 'https://i.scdn.co/image/ab67616d0000485180e1b67b901638a450504ab6', '5FIJe9pC9g3PR4ldVyWRB3', 'spotify:track:5FIJe9pC9g3PR4ldVyWRB3'),
  demoTrack(34, 'You Got That Lovin\'', 'Kirstie Kraus', 'You Got That Lovin\'', '7C6tbRm2KUeExdqXMDcTqc', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b273befb8f6041c15b6ce951bc23', 'https://i.scdn.co/image/ab67616d00001e02befb8f6041c15b6ce951bc23', 'https://i.scdn.co/image/ab67616d00004851befb8f6041c15b6ce951bc23', '0b0biCBj1bOxZrxw8XtRmR', 'spotify:track:0b0biCBj1bOxZrxw8XtRmR'),
  demoTrack(35, 'In the Garden', 'Tiera Kennedy', 'In the Garden (Greenhouse Sessions) [Live]', '3xKzNm9Rd7Bq5JN6cVvh2P', 'single', '2026-04-03', 1, 1, '', 'https://i.scdn.co/image/ab67616d0000b2730c6952f29a51a68c9f5e3a5a', 'https://i.scdn.co/image/ab67616d00001e020c6952f29a51a68c9f5e3a5a', 'https://i.scdn.co/image/ab67616d000048510c6952f29a51a68c9f5e3a5a', '4TKzN8Rd7Bq5JN6cVvh2Q', 'spotify:track:4TKzN8Rd7Bq5JN6cVvh2Q'),
];

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */

export default function NewMusicFriday() {
  const { user, isGuest, isAdmin, signOut, signInWithGoogle, signInWithApple } = useAuth();
  const userId = user?.id || null;
  const nmfNavigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(getToken());
  const [phase, setPhase] = useState<Phase>('ready');
  const [allTracks, setAllTracks] = useState<TrackItem[]>([]);
  const [releases, setReleases] = useState<ReleaseCluster[]>([]);
  // Selection management extracted to hook
  const {
    selections, setSelections, selectionsByAlbum,
    handleSelectRelease, handleDeselect, handleSetCoverFeature,
    pushSelectionHistory, undoSelection, historyLength, haptic,
  } = useSelectionManager();
  const [targetCount, setTargetCount] = useState(32);
  const [scanStatus, setScanStatus] = useState('');
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('date');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Debounce: searchInput drives the controlled input, search drives expensive useMemos
  useEffect(() => {
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearch(searchInput), 150);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchInput]);
  const [error, setError] = useState('');
  const [artDownloading, setArtDownloading] = useState(false);
  const [artistCount, setArtistCount] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [appleEnriching, setAppleEnriching] = useState(false);
  const [featureCounts, setFeatureCounts] = useState<Map<string, number>>(new Map());
  const [activeSource, setActiveSource] = useState<MusicSource['id']>(() => {
    // Default Apple-signed-in users to Apple Music source
    return user?.app_metadata?.provider === 'apple' ? 'apple-music' : 'nashville';
  });
  // tracksPerSlide now from useCarouselState
  const [viewMode, setViewMode] = useState<'releases' | 'tracks'>('releases');
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [resolvedHandles, setResolvedHandles] = useState<Map<string, any>>(new Map());

  // Showcase categories + active filter — lifted here so they survive NashvilleReleases remounts
  const [activeShowcase, setActiveShowcase] = useState<string | null>(null);
  const [showcases, setShowcases] = useState<ShowcaseCategory[]>(() => {
    try {
      const cached = localStorage.getItem('nr_showcases');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* no cache */ }
    return [];
  });

  // Carousel state extracted to hook
  const {
    carouselAspect, setCarouselAspect, allPreviews, setAllPreviews,
    generating, setGenerating, exportScope, setExportScope,
    tracksPerSlide, setTracksPerSlide, carouselRef, cardSize, setCardSize,
  } = useCarouselState();

  // selectionHistory now in useSelectionManager hook

  // Quick Look: spacebar preview
  const [quickLookAlbum, setQuickLookAlbum] = useState<ReleaseCluster | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAddTracks, setShowAddTracks] = useState(false);
  const [showToolsSheet, setShowToolsSheet] = useState(false);
  const hoveredCluster = useRef<ReleaseCluster | null>(null);

  // Rubber-band drag select
  const [rubberBand, setRubberBand] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const rubberBandRef = useRef<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Shift-click multi-select tracking
  const lastClickedIdx = useRef<number>(-1);

  // Scan abort controller
  const scanAbortRef = useRef<AbortController | null>(null);

  // Fixed header/toolbar measurement
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(56);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [mobileCollapsed, setMobileCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // Measure header on mount + resize. Toolbar is measured via callback ref
  // because it conditionally renders (only in results phase on desktop).
  useEffect(() => {
    const measure = () => {
      if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (headerRef.current) ro.observe(headerRef.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  // Callback ref for the toolbar — measures immediately when it mounts/unmounts,
  // and observes size changes while mounted. Solves the race condition where
  // useEffect runs before the toolbar ref is assigned.
  const toolbarRoRef = useRef<ResizeObserver | null>(null);
  const toolbarCallbackRef = useCallback((node: HTMLDivElement | null) => {
    // Clean up previous observer
    if (toolbarRoRef.current) { toolbarRoRef.current.disconnect(); toolbarRoRef.current = null; }
    if (node) {
      setToolbarHeight(node.offsetHeight);
      toolbarRoRef.current = new ResizeObserver(() => setToolbarHeight(node.offsetHeight));
      toolbarRoRef.current.observe(node);
    } else {
      setToolbarHeight(0);
    }
  }, []);

  // Mobile: collapse header on scroll down to reclaim viewport space
  useEffect(() => {
    const handleScroll = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) { setMobileCollapsed(false); return; }
      setMobileCollapsed(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => { window.removeEventListener('scroll', handleScroll); window.removeEventListener('resize', handleScroll); };
  }, []);

  // Fetch showcase categories from API (runs once, persists to localStorage)
  useEffect(() => {
    fetch('/api/browse-artists')
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(d => {
        const cats = (d.categories || []).filter((c: ShowcaseCategory) => c.type === 'showcase');
        setShowcases(cats);
        if (cats.length > 0) {
          try { localStorage.setItem('nr_showcases', JSON.stringify(cats)); } catch { /* quota */ }
        }
      })
      .catch(() => {});
  }, []);

  // Step section refs for scroll-to
  const step1Ref = useRef<HTMLElement>(null);
  const step2Ref = useRef<HTMLElement>(null);
  const step3Ref = useRef<HTMLElement>(null);
  const step4Ref = useRef<HTMLElement>(null);
  const step5Ref = useRef<HTMLElement>(null);

  const weekDate = getLastFriday();

  // ─── Auto-save draft (scoped by user to prevent cross-account leakage) ───
  const DRAFT_KEY = userId ? `nmf_draft_${userId}` : 'nmf_draft_guest';
  const draftKeyRef = useRef(DRAFT_KEY);
  draftKeyRef.current = DRAFT_KEY;
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const draftRef = useRef<{ selections: SelectionSlot[]; allTracks: TrackItem[]; releases: ReleaseCluster[] } | null>(null);

  // Check for saved draft on mount — validate shape before offering restore
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.weekDate !== weekDate) { localStorage.removeItem(DRAFT_KEY); return; }
      // Validate draft has the expected shape
      if (!Array.isArray(draft.selections) || !Array.isArray(draft.allTracks)) {
        localStorage.removeItem(DRAFT_KEY); return;
      }
      // Validate first track has required fields
      if (draft.allTracks.length > 0 && !draft.allTracks[0].track_id && !draft.allTracks[0].track_name) {
        localStorage.removeItem(DRAFT_KEY); return;
      }
      if (draft.selections.length > 0 && draft.allTracks.length > 0) {
        draftRef.current = { selections: draft.selections, allTracks: draft.allTracks, releases: draft.releases || [] };
        setShowDraftBanner(true);
      }
    } catch { localStorage.removeItem(DRAFT_KEY); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restoreDraft = useCallback(() => {
    if (!draftRef.current) return;
    try {
      const { allTracks: t, releases: r, selections: s } = draftRef.current;
      if (!Array.isArray(t) || !Array.isArray(s) || t.length === 0) throw new Error('Invalid draft');
      setAllTracks(t);
      setReleases(Array.isArray(r) && r.length > 0 ? r : groupIntoReleases(t));
      setSelections(buildSlots(s));
      setPhase('results');
    } catch (e) {
      console.error('[Draft] Failed to restore, discarding:', e);
      localStorage.removeItem(DRAFT_KEY);
    }
    setShowDraftBanner(false);
    draftRef.current = null;
  }, [DRAFT_KEY]);

  const discardDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setShowDraftBanner(false);
    draftRef.current = null;
  }, [DRAFT_KEY]);

  // Refs for auto-save — intervals read from refs so they don't re-trigger on state changes
  const autoSaveRefs = useRef({ selections, allTracks, releases, weekDate, userId });
  autoSaveRefs.current = { selections, allTracks, releases, weekDate, userId };

  // Debounced save on selection change (write to localStorage)
  useEffect(() => {
    if (selections.length === 0 || allTracks.length === 0) return;
    const debounce = setTimeout(() => {
      try {
        localStorage.setItem(draftKeyRef.current, JSON.stringify({
          weekDate, selections, allTracks, releases,
          savedAt: new Date().toISOString(),
        }));
      } catch { /* quota exceeded */ }
    }, 2000);
    return () => clearTimeout(debounce);
  }, [selections, allTracks, releases, weekDate]);

  // Stable 30s intervals for localStorage + Supabase auto-save (reads from refs, never re-creates)
  useEffect(() => {
    const interval = setInterval(() => {
      const { selections: s, allTracks: t, releases: r, weekDate: w, userId: u } = autoSaveRefs.current;
      if (s.length === 0 || t.length === 0) return;
      try {
        localStorage.setItem(draftKeyRef.current, JSON.stringify({
          weekDate: w, selections: s, allTracks: t, releases: r,
          savedAt: new Date().toISOString(),
        }));
      } catch { /* quota exceeded */ }
      if (u && s.length > 0) {
        saveWeek({
          week_date: w,
          all_releases: t,
          selections: s,
          cover_feature: s.find((sl: any) => sl.isCoverFeature) || null,
          playlist_master_pushed: false,
          carousel_generated: false,
        }, u).catch(() => {});
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, []); // stable — never re-creates

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    const oauthError = searchParams.get('error');
    if (oauthError) {
      setSearchParams({}, { replace: true });
      const desc = searchParams.get('error_description') || oauthError;
      setError(`Spotify access denied: ${desc}. This app is in development mode and limited to approved accounts. Use the Manual/CSV import instead.`);
      return;
    }
    if (code) {
      setSearchParams({}, { replace: true });
      exchangeCode(code)
        .then(t => { setToken(t); setError(''); })
        .catch(e => {
          const msg = e.message || 'Unknown error';
          if (msg.includes('invalid_grant') || msg.includes('access_denied') || msg.includes('invalid_client')) {
            setError(`Spotify connection failed: ${msg}. This app is in Spotify development mode (limited users). Use the Manual/CSV import tab to import your releases without Spotify.`);
          } else {
            setError(`Auth failed: ${msg}`);
          }
        });
    }
  }, [searchParams, setSearchParams]);

  // Handle import from Browse Artists page
  useEffect(() => {
    if (searchParams.get('import') === 'browse') {
      setSearchParams({}, { replace: true });
      const stored = sessionStorage.getItem('nmf_import_tracks');
      if (stored) {
        sessionStorage.removeItem('nmf_import_tracks');
        try {
          const tracks = JSON.parse(stored) as TrackItem[];
          if (tracks.length > 0) {
            setAllTracks(tracks);
            setReleases(groupIntoReleases(tracks));
            setPhase('results');
            setLastScanned(new Date().toISOString());
          }
        } catch { /* corrupted */ }
      }
    }
  }, [searchParams, setSearchParams]);

  // Pre-authorize MusicKit for Apple-signed-in users so scan doesn't need a second login
  useEffect(() => {
    if (user?.app_metadata?.provider !== 'apple') return;
    (async () => {
      try {
        const { authorizeAppleMusic } = await import('../lib/sources/apple-music');
        await authorizeAppleMusic();
        if (import.meta.env.DEV) console.log('[AM] Pre-authorized MusicKit for Apple user');
      } catch {
        // User may decline or popup may be blocked — that's OK, scan button will retry
      }
    })();
  }, [user?.app_metadata?.provider]);

  // On mount: try to load cached results. Guests see empty state.
  useEffect(() => {
    // Guests/admin-bypass: no cached data, start fresh
    if (!userId) return;

    const cacheKey = `nmf_scan_${weekDate}_${userId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { tracks, timestamp } = JSON.parse(cached);
        if (tracks?.length) {
          setAllTracks(tracks);
          setReleases(groupIntoReleases(tracks));
          setPhase('results');
          setLastScanned(timestamp);
          setLoadedFromCache(true);
          return;
        }
      } catch { /* corrupted cache */ }
    }
    // No session cache — try Supabase (scoped by user_id)
    import('../lib/supabase').then(({ getWeek }) => {
      getWeek(weekDate, userId).then(week => {
        if (week?.all_releases && Array.isArray(week.all_releases) && (week.all_releases as TrackItem[]).length > 0) {
          const tracks = week.all_releases as TrackItem[];
          const savedAt = week.updated_at || week.created_at || null;
          setAllTracks(tracks);
          setReleases(groupIntoReleases(tracks));
          setPhase('results');
          setLastScanned(savedAt);
          setLoadedFromCache(true);
          sessionStorage.setItem(cacheKey, JSON.stringify({ tracks, timestamp: savedAt }));
          if (week.selections && Array.isArray(week.selections)) {
            setSelections(buildSlots(week.selections as SelectionSlot[]));
          }
          // Staleness warning: if cached data is >24h old, nudge re-scan
          if (savedAt) {
            const ageMs = Date.now() - new Date(savedAt).getTime();
            if (ageMs > 24 * 60 * 60 * 1000) {
              setError('Loaded cached results from ' + new Date(savedAt).toLocaleString() + '. Consider re-scanning for the latest releases.');
            }
          }
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When token arrives: move to ready (NOT scan). If we already have results, stay there.
  useEffect(() => {
    if (token && phase === 'auth') {
      setPhase('ready');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadDemo = () => {
    setAllTracks(DEMO_TRACKS);
    setReleases(groupIntoReleases(DEMO_TRACKS));
    setIsDemoMode(true);
    setPhase('results');
    setError('');
  };

  const runScan = useCallback(async (tkn: string) => {
    setPhase('scanning');
    setError('');
    setRateLimited(false);
    setLoadedFromCache(false);
    const abortController = new AbortController();
    scanAbortRef.current = abortController;
    const { signal } = abortController;
    const scanStart = Date.now();
    try {
      // Refresh token if expired
      let activeToken = tkn;
      if (isTokenExpired()) {
        setScanStatus('Refreshing Spotify token...');
        const refreshed = await refreshToken();
        if (refreshed) {
          activeToken = refreshed;
          setToken(refreshed);
        } else {
          setToken(null);
          setPhase('ready');
          setError('Session expired. Please reconnect Spotify.');
          return;
        }
      }

      // Pre-scan health check
      setScanStatus('Checking Spotify status...');
      const health = await checkScanHealth(activeToken);
      if (!health.ok) {
        setRateLimited(true);
        setError(health.message);
        setPhase('ready');
        return;
      }
      if (import.meta.env.DEV) console.log(`[SCAN] Health check: ${health.message}`);

      setScanStatus('Fetching followed artists...');
      const artists = await fetchFollowedArtists(activeToken, (cur, tot) => {
        setScanProgress({ current: cur, total: tot });
        setScanStatus(`Loaded ${cur} artists...`);
      }, false, signal);

      const cutoff = getScanCutoff();
      setScanStatus(`Scanning releases since ${cutoff}...`);
      setScanProgress({ current: 0, total: artists.length });

      let liveTrackCount = 0;
      const result = await fetchNewReleases(artists, activeToken, cutoff, (cur, tot, albumsFound, status) => {
        setScanProgress({ current: cur, total: tot });
        const elapsed = (Date.now() - scanStart) / 1000;
        const statusDot = status === 'green' ? '\uD83D\uDFE2' : status === 'yellow' ? '\uD83D\uDFE1' : '\uD83D\uDD34';
        const countLabel = `${albumsFound} album${albumsFound !== 1 ? 's' : ''} \u00B7 ${liveTrackCount} track${liveTrackCount !== 1 ? 's' : ''}`;
        if (status === 'red') {
          setScanStatus(`${statusDot} Rate limited \u2014 saving ${countLabel} found so far`);
        } else if (cur >= 30 && cur < tot) {
          const rate = cur / elapsed;
          const remaining = (tot - cur) / rate;
          const eta = remaining < 10 ? 'Almost done...'
            : remaining < 60 ? `~${Math.round(remaining)}s remaining`
            : `~${Math.floor(remaining / 60)}m ${Math.round(remaining % 60)}s remaining`;
          setScanStatus(`${statusDot} ${cur}/${tot} artists \u00B7 ${countLabel} \u00B7 ${eta}`);
        } else {
          setScanStatus(`${statusDot} ${cur}/${tot} artists \u00B7 ${countLabel}`);
        }
      }, (tracks) => {
        // Live track count update from onReleasesFound callback
        liveTrackCount = tracks.length;
        setAllTracks(tracks);
        setReleases(groupIntoReleases(tracks));
      }, signal);

      scanAbortRef.current = null;
      const { tracks, failCount, totalArtists, rateLimited: wasRateLimited, retryAfterSeconds } = result;

      // Handle user-cancelled scan
      if (result.aborted) {
        if (tracks.length > 0) {
          setAllTracks(tracks);
          setReleases(groupIntoReleases(tracks));
          setPhase('results');
          setError(`Scan cancelled after ${result.completedArtists}/${totalArtists} artists. Showing ${tracks.length} tracks found.`);
        } else {
          setPhase('ready');
        }
        return;
      }
      const now = new Date().toISOString();
      setAllTracks(tracks);
      setReleases(groupIntoReleases(tracks));
      setArtistCount(totalArtists);
      setLastScanned(now);
      setRateLimited(wasRateLimited);
      setPhase('results');

      if (wasRateLimited) {
        const mins = Math.ceil(retryAfterSeconds / 60);
        setError(`Rate limited after ${result.completedArtists}/${totalArtists} artists. Found ${tracks.length} releases. Try again in ~${mins} min.`);
      }

      // Background: query feature counts for "Previously Featured" badges
      const artistIds = [...new Set(tracks.map(t => t.artist_id).filter(Boolean))];
      if (artistIds.length > 0) {
        getFeatureCounts(artistIds).then(setFeatureCounts).catch(() => {});
      }

      // Background Apple Music enrichment (non-blocking)
      if (tracks.length > 0) {
        setAppleEnriching(true);
        batchResolveAppleMusic(tracks).then(appleMap => {
          setAllTracks(prev => prev.map(t => {
            const key = `${t.artist_names}::${t.track_name}`;
            const url = appleMap.get(key);
            return url ? { ...t, apple_music_url: url } : t;
          }));
          setAppleEnriching(false);
        }).catch(() => setAppleEnriching(false));
      }

      // Only cache if results > 0
      if (tracks.length > 0) {
        if (userId) {
          try {
            sessionStorage.setItem(`nmf_scan_${weekDate}_${userId}`, JSON.stringify({ tracks, timestamp: now }));
          } catch { /* storage full, ignore */ }
          saveWeek({ week_date: weekDate, all_releases: tracks, playlist_master_pushed: false, carousel_generated: false }, userId);
        }
      } else if (failCount > totalArtists * 0.5) {
        setError(`Spotify rate limit hit \u2014 ${failCount}/${totalArtists} artists failed. Wait 30-60 minutes and try again.`);
      } else {
        setError(`Scan found 0 releases since ${cutoff}. Try re-scanning.`);
      }
    } catch (e) {
      scanAbortRef.current = null;
      if ((e as DOMException).name === 'AbortError') {
        // Scan was cancelled by user
        if (allTracks.length > 0) setPhase('results');
        else setPhase('ready');
        return;
      }
      if ((e as Error).message === 'AUTH_EXPIRED') {
        setToken(null);
        setPhase('ready');
        setError('Spotify session expired. Use the Nashville source or paste artist names instead.');
      } else {
        setError((e as Error).message);
        setPhase('ready');
      }
    }
  }, [weekDate]);

  /** All selected slots grouped by album ID (supports multi-track per album) */
  // selectionsByAlbum, haptic, handleSelectRelease, handleDeselect, handleSetCoverFeature
  // — all now in useSelectionManager hook

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== 'results') return;
      const meta = e.metaKey || e.ctrlKey;
      // Cmd+A — Select All
      if (meta && !e.shiftKey && e.key === 'a') {
        e.preventDefault();
        setSelections(prev => {
          pushSelectionHistory(prev);
          const existing = new Set(prev.map(s => s.albumId));
          const newSlots = [...prev];
          for (const r of releases) {
            if (!existing.has(r.album_spotify_id)) {
              const track = r.tracks.find(t => t.track_id === r.titleTrackId) || r.tracks[0];
              newSlots.push({
                track, albumId: r.album_spotify_id,
                selectionNumber: newSlots.length + 1,
                slideGroup: getSlideGroup(newSlots.length + 1),
                positionInSlide: ((newSlots.length) % 8) + 1,
                isCoverFeature: false,
              });
            }
          }
          return buildSlots(newSlots);
        });
      }
      // Cmd+Shift+A — Clear All
      if (meta && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setSelections(prev => { pushSelectionHistory(prev); return []; });
      }
      // Cmd+Z — Undo
      if (meta && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undoSelection();
      }
      // Space — Quick Look preview of hovered album
      if (e.key === ' ' && !meta && hoveredCluster.current) {
        e.preventDefault();
        setQuickLookAlbum(prev => prev ? null : hoveredCluster.current);
      }
      // Escape — dismiss Quick Look or shortcuts overlay
      if (e.key === 'Escape') {
        if (quickLookAlbum) setQuickLookAlbum(null);
        if (showShortcuts) setShowShortcuts(false);
      }
      // ? — show keyboard shortcuts
      if (e.key === '?' || (meta && e.key === '/')) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, releases, pushSelectionHistory, quickLookAlbum, showShortcuts]);

  // Filtered releases for browse
  const filteredReleases = useMemo(() => {
    let result = [...releases];
    if (filter === 'single') result = result.filter(r => r.isSingle);
    else if (filter === 'album') result = result.filter(r => !r.isSingle);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.album_name.toLowerCase().includes(q) ||
        r.artist_names.toLowerCase().includes(q) ||
        r.tracks.some(t => t.track_name.toLowerCase().includes(q))
      );
    }
    if (sort === 'artist') result.sort((a, b) => a.artist_names.localeCompare(b.artist_names));
    else if (sort === 'title') result.sort((a, b) => a.album_name.localeCompare(b.album_name));
    return result;
  }, [releases, filter, sort, search]);

  // Wave 7 Block 9 — artist-grouped tile list. Groups filteredReleases
  // by primary artist (comma / feat. / ft. split, same regex as the
  // mobile MobileResultsView grouping). Features bucket under the
  // first-listed artist. Used by the desktop post-import grid below.
  const artistGroups = useMemo<ArtistGroup[]>(
    () => groupByPrimaryArtist(filteredReleases),
    [filteredReleases],
  );

  // Global selection ordinal map (track_id -> 1-based position in the
  // pick order). Drives the "#X" badge on each artist tile.
  const globalOrdinalByTrackId = useMemo(() => {
    const m = new Map<string, number>();
    selections.forEach((s, i) => m.set(s.track.track_id, i + 1));
    return m;
  }, [selections]);

  // (filter counts shown inline in sticky bar via filteredReleases.length)

  // Slide groups for TagBlocks — follows tracksPerSlide from carousel config
  const slideGroups = useMemo(() => {
    const groups: SelectionSlot[][] = [];
    for (let i = 0; i < selections.length; i += tracksPerSlide) {
      groups.push(selections.slice(i, i + tracksPerSlide));
    }
    return groups;
  }, [selections, tracksPerSlide]);

  // Selected tracks for downloads/playlist
  const selectedTracks = useMemo(() => selections.map(s => s.track), [selections]);

  const handleDisconnect = () => {
    clearToken();
    setToken(null);
    setPhase('ready');
    setAllTracks([]);
    setReleases([]);
    setSelections([]);
  };

  const handlePlaylistPush = async (mode: 'replace' | 'append') => {
    if (!token) return;
    const uris = selectedTracks.map(t => t.track_uri);
    if (mode === 'replace') {
      await replacePlaylistTracks(token, PLAYLIST_ID, uris);
    } else {
      await appendPlaylistTracks(token, PLAYLIST_ID, uris);
    }
    await handleSaveWeek({ playlist_master_pushed: true });
  };

  const handleCreateAndPush = async (name: string, isPublic: boolean) => {
    if (!token) throw new Error('Not authenticated');
    const uris = selectedTracks.map(t => t.track_uri);
    const result = await createPlaylist(token, name, isPublic, uris);
    await handleSaveWeek({ playlist_new_id: result.id, playlist_new_url: result.url });
    return result;
  };

  const handleSaveWeek = async (extra: Partial<NMFWeek> = {}) => {
    if (!userId) {
      setError('Sign in with Google to save your work to the archive. Guest sessions are not persisted.');
      return;
    }
    const week: NMFWeek = {
      week_date: weekDate,
      all_releases: allTracks,
      selections: selections,
      cover_feature: selections.find(s => s.isCoverFeature) || null,
      manifest_curated: selectedTracks,
      playlist_master_pushed: false,
      carousel_generated: false,
      ...extra,
    };
    await saveWeek(week, userId);
    const features = selections.map(s => ({
      week_date: weekDate,
      spotify_artist_id: s.track.artist_id,
      artist_name: s.track.artist_names,
      track_name: s.track.track_name,
      track_spotify_id: s.track.track_id,
      album_name: s.track.album_name,
      slide_number: s.slideGroup,
      slide_position: s.positionInSlide,
      was_cover_feature: s.isCoverFeature,
    }));
    await saveFeatures(features);
  };

  const handleLoadWeek = (week: NMFWeek) => {
    if (week.selections && Array.isArray(week.selections)) {
      setSelections(buildSlots(week.selections as SelectionSlot[]));
    }
    if (week.all_releases && Array.isArray(week.all_releases)) {
      setAllTracks(week.all_releases as TrackItem[]);
      setReleases(groupIntoReleases(week.all_releases as TrackItem[]));
    }
    setPhase('results');
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header — fixed at top, collapses to slim track-count bar on mobile scroll */}
      <header ref={headerRef} style={{
        padding: mobileCollapsed ? '4px 16px' : '16px 24px',
        borderBottom: '2px solid var(--gold-dark)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: mobileCollapsed ? 0 : 14,
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
        background: 'var(--midnight)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        transition: 'padding 200ms ease, gap 200ms ease',
      }}>
        {mobileCollapsed ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => { const idx = window.history.state?.idx; if (idx != null && idx > 0) nmfNavigate(-1); else nmfNavigate('/'); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                aria-label="Go back"
              >
                &larr;
              </button>
              <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: selections.length > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                {selections.length}/{allTracks.length} tracks
              </span>
            </div>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }}
              aria-label="Expand header"
            >
              &#9650;
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 2vw, 12px)', flexWrap: 'wrap' }}>
              <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
                <img src="/mmmc-logo-hires.png" alt="MMMC" style={{ width: 'clamp(40px, 10vw, 67px)', height: 'clamp(40px, 10vw, 67px)', borderRadius: 8, objectFit: 'cover' }} />
              </Link>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(var(--fs-lg), 3.5vw, var(--fs-2xl))', fontWeight: 600 }}>
                New Music Friday
              </h1>
              <ProductNav />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Cover feature + aspect toggle moved to Row 2 */}
              {lastScanned && (
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)' }}>
                  {new Date(lastScanned).toLocaleString()}
                </span>
              )}
              {/* Re-scan (Spotify-connected only — admin) */}
              {phase === 'results' && token && (
                <>
                  <button className="btn btn-sm" onClick={() => runScan(token)}>Re-scan</button>
                  <button className="btn btn-sm" onClick={() => { localStorage.removeItem('nmf_followed_artists'); runScan(token); }}>Refresh Follows</button>
                  <button className="btn btn-sm btn-danger" onClick={handleDisconnect} style={{ fontSize: 'var(--fs-2xs)' }}>Disconnect Spotify</button>
                </>
              )}
              {/* Account */}
              {user && (
                <>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-3xs)' }}>{user.email}</span>
                  <button className="btn btn-sm" onClick={signOut} style={{ fontSize: 'var(--fs-2xs)' }}>Sign Out</button>
                </>
              )}
              {!user && isGuest && (
                <button className="btn btn-sm" onClick={signOut} style={{ fontSize: 'var(--fs-2xs)' }}>Sign Out</button>
              )}
            </div>
          </>
        )}
      </header>
      {/* Spacer for fixed header — measured dynamically */}
      <div style={{ height: headerHeight }} />

      {error && (
        <div style={{
          padding: '12px 24px', background: 'rgba(204, 53, 53, 0.1)',
          borderBottom: '1px solid var(--mmmc-red)', color: '#E04A4A', fontSize: 'var(--fs-md)',
        }}>
          {error}
        </div>
      )}

      {appleEnriching && (
        <div style={{
          padding: '6px 24px', background: 'rgba(94,142,168,0.1)',
          borderBottom: '1px solid var(--steel-dark)', color: 'var(--steel)', fontSize: 'var(--fs-sm)',
        }}>
          Adding Apple Music links...
        </div>
      )}

      {loadedFromCache && phase === 'results' && (
        <div style={{
          padding: '10px 24px', background: 'rgba(212,168,67,0.08)',
          borderBottom: '1px solid var(--gold-dark)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          flexWrap: 'wrap',
        }}>
          <span style={{ color: 'var(--gold)', fontSize: 'var(--fs-md)' }}>
            Data last refreshed{lastScanned ? ` at ${new Date(lastScanned).toLocaleString()}` : ''}.
          </span>
          <button
            className="btn btn-sm btn-gold"
            onClick={() => {
              setLoadedFromCache(false);
              if (token) runScan(token);
              else setPhase('ready');
            }}
            style={{ fontSize: 'var(--fs-sm)', padding: '6px 16px' }}
          >
            Re-scan for latest releases
          </button>
        </div>
      )}

      {/* Auth phase removed — users always see the source selector (phase='ready') */}

      {/* Draft resume banner */}
      {showDraftBanner && phase === 'ready' && (
        <div style={{
          margin: '0 auto 16px', maxWidth: 700, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.3)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--gold)' }}>Resume your curation?</p>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
              {draftRef.current?.selections.length || 0} tracks selected from {draftRef.current?.allTracks.length || 0} releases
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-gold" onClick={restoreDraft} style={{ fontSize: 'var(--fs-sm)', padding: '8px 20px' }}>
              Resume
            </button>
            <button className="btn" onClick={discardDraft} style={{ fontSize: 'var(--fs-sm)', padding: '8px 16px' }}>
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Ready Phase -- token received, waiting for explicit scan */}
      {phase === 'ready' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: 24, textAlign: 'center',
        }}>
          <div className="animate-float-up" style={{ maxWidth: 700, width: '100%' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', marginBottom: 20 }}>
              Ready to <span style={{ color: 'var(--gold)' }}>Scan</span>
            </h2>

            <SourceSelector
              selected={activeSource}
              onSelect={setActiveSource}
              spotifyConnected={!!token}
              appleMusicConnected={false}
            />

            {/* Spotify source */}
            {activeSource === 'spotify' && (
              <div style={{ marginTop: 20 }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 'var(--fs-xl)' }}>
                  {token ? 'Scan your followed artists for new releases since last Friday.' : 'Connect your Spotify account to scan followed artists for new releases.'}
                </p>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {token ? (
                    <button data-testid="scan-button" className="btn btn-gold" onClick={() => runScan(token)} style={{ fontSize: 'var(--fs-xl)', padding: '16px 40px' }}>
                      Scan New Releases
                    </button>
                  ) : (
                    <button className="btn btn-spotify" onClick={startAuth} style={{ fontSize: 'var(--fs-xl)', padding: '16px 40px', opacity: isGuest ? 0.5 : 1, cursor: isGuest ? 'not-allowed' : 'pointer' }} disabled={isGuest}>
                      Connect Spotify
                    </button>
                  )}
                  <button className="btn" onClick={loadDemo} style={{ fontSize: 'var(--fs-xl)', padding: '16px 40px' }}>
                    Try Demo
                  </button>
                </div>
              </div>
            )}

            {/* Apple Music source — scan your library */}
            {activeSource === 'apple-music' && (
              <div className="animate-float-up" style={{ marginTop: 16, maxWidth: 500, width: '100%', margin: '16px auto 0', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 'var(--fs-md)', lineHeight: 1.6 }}>
                  {user?.app_metadata?.provider === 'apple'
                    ? 'Scan your favorited artists on Apple Music for new releases this week.'
                    : 'Connect your Apple Music account to scan for new releases from artists you follow.'}
                </p>
                <button
                  className="btn btn-gold"
                  onClick={async () => {
                    setPhase('scanning');
                    setScanStatus('Connecting to Apple Music...');
                    setScanProgress({ current: 0, total: 0 });
                    try {
                      const { authorizeAppleMusic, scanAppleMusicLibrary } = await import('../lib/sources/apple-music');
                      await authorizeAppleMusic();
                      setScanStatus('Scanning your library...');
                      const cutoff = getScanCutoff();
                      let artistCount = 0;
                      const tracks = await scanAppleMusicLibrary({
                        cutoffDate: cutoff,
                        onProgress: (current, total, found) => {
                          artistCount = total;
                          setScanProgress({ current, total });
                          setScanStatus(`${current}/${total} artists · ${found} releases found`);
                        },
                        onReleasesFound: (tracks) => {
                          setAllTracks(tracks);
                          setReleases(groupIntoReleases(tracks));
                        },
                      });
                      if (tracks.length > 0) {
                        setAllTracks(tracks);
                        setReleases(groupIntoReleases(tracks));
                        setPhase('results');
                        setLastScanned(new Date().toISOString());
                        setIsDemoMode(false);
                      } else if (artistCount === 0) {
                        setError('No artists found in your Apple Music library. Favorite some artists in Apple Music, then scan again.');
                        setPhase('ready');
                      } else {
                        setError(`Scanned ${artistCount} artists but none released new music since last Friday. Try the Nashville source.`);
                        setPhase('ready');
                      }
                    } catch (e) {
                      setError((e as Error).message);
                      setPhase('ready');
                    }
                  }}
                  style={{ fontSize: 'var(--fs-lg)', padding: '14px 32px' }}
                >
                  Scan All Favorited Artists
                </button>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 12 }}>
                  {user?.app_metadata?.provider === 'apple'
                    ? 'Scans your Apple Music library for releases since last Friday.'
                    : 'Opens an Apple ID sign-in popup. We only read your library — nothing is modified.'}
                </p>
              </div>
            )}

            {/* Nashville releases source — zero-login experience */}
            {activeSource === 'nashville' && (
              <div style={{ marginTop: 16, textAlign: 'left' }}>
                <ErrorBoundary fallbackMessage="Nashville Releases failed to load">
                <Suspense fallback={<div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading Nashville releases...</div>}>
                <NashvilleReleases showcases={showcases} activeShowcase={activeShowcase} onActiveShowcaseChange={setActiveShowcase} onImport={(tracks) => {
                  setAllTracks(tracks);
                  setReleases(groupIntoReleases(tracks));
                  setPhase('results');
                  setLastScanned(new Date().toISOString());
                  setIsDemoMode(false);
                  // Queue new artists for Research Agent enrichment (fire-and-forget)
                  queueNewArtistsForEnrichment(tracks).then(r => {
                    if (import.meta.env.DEV && r.queued > 0)
                      console.log(`[Enrichment] Queued ${r.queued} artists, ${r.alreadyCached} cached, ${r.total} total`);
                  }).catch(() => {});
                }} />
                </Suspense>
                </ErrorBoundary>
              </div>
            )}

            {/* Manual source */}
            {activeSource === 'manual' && (
              <div style={{ marginTop: 16, textAlign: 'left' }}>
                <ManualImport onImport={(tracks) => {
                  setAllTracks(tracks);
                  setReleases(groupIntoReleases(tracks));
                  setPhase('results');
                  setLastScanned(new Date().toISOString());
                  setIsDemoMode(false);
                }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Demo mode banner */}
      {isDemoMode && (
        <div style={{
          background: 'rgba(212,168,67,0.12)', borderBottom: '1px solid var(--gold-dark)',
          padding: '8px 24px', fontSize: 'var(--fs-md)', color: 'var(--gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Demo mode -- showing sample data. Connect Spotify and scan to see your real releases.</span>
          <button
            className="btn btn-sm"
            onClick={() => { setIsDemoMode(false); setAllTracks([]); setReleases([]); setSelections([]); setPhase('ready'); }}
            style={{ fontSize: 'var(--fs-xs)' }}
          >
            Exit Demo
          </button>
        </div>
      )}

      {/* Scanning Phase */}
      {phase === 'scanning' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: 24, textAlign: 'center',
        }}>
          <div style={{ maxWidth: 480, width: '100%' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-3xl)', marginBottom: 24 }}>
              Scanning<span style={{ color: 'var(--gold)' }}>...</span>
            </h2>
            <div className="progress-bar" style={{ marginBottom: 16 }}>
              <div className="progress-bar-fill" style={{
                width: scanProgress.total > 0 ? `${(scanProgress.current / scanProgress.total) * 100}%` : '0%',
              }} />
            </div>
            <p className="mono" style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-lg)' }}>
              {scanStatus}
            </p>
            <button
              className="btn btn-sm"
              onClick={() => scanAbortRef.current?.abort()}
              style={{ marginTop: 16, opacity: 0.7 }}
            >
              Cancel Scan
            </button>
          </div>
        </div>
      )}

      {/* Results Phase */}
      {phase === 'results' && isMobile && (
        <Suspense fallback={<div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>}>
        <MobileResultsView
          allTracks={allTracks}
          releases={filteredReleases}
          selections={selections}
          onSelectionChange={setSelections}
          selectionsByAlbum={selectionsByAlbum}
          onSelectRelease={handleSelectRelease}
          onDeselect={handleDeselect}
          onSetCoverFeature={handleSetCoverFeature}
          featureCounts={featureCounts}
          generating={generating}
          onGenerate={() => carouselRef.current?.generate()}
          allPreviews={allPreviews}
          onDownloadAll={() => carouselRef.current?.downloadAll()}
          onDownloadSlide={async (i) => {
            const res = await fetch(allPreviews[i]);
            const blob = await res.blob();
            const { downloadBlob } = await import('../lib/canvas-grid');
            downloadBlob(blob, `nmf-slide-${i + 1}.png`);
          }}
          tracksPerSlide={tracksPerSlide}
          onTracksPerSlideChange={setTracksPerSlide}
          carouselAspect={carouselAspect}
          onAspectChange={setCarouselAspect}
          pushSelectionHistory={pushSelectionHistory}
          gridTemplateId={carouselRef.current?.getGridTemplateId?.()}
          onGridTemplateChange={(id: string) => carouselRef.current?.setGridTemplateId?.(id)}
          titleTemplateId={carouselRef.current?.getTitleTemplateId?.()}
          onTitleTemplateChange={(id: string) => carouselRef.current?.setTitleTemplateId?.(id)}
          logoUrl={carouselRef.current?.getLogoUrl?.()}
          onLogoChange={(url: string) => carouselRef.current?.setLogoUrl?.(url)}
          targetCount={targetCount}
          onTargetCountChange={setTargetCount}
          onNewScan={() => setPhase('ready')}
        />
        </Suspense>
      )}
      {/* Hidden CarouselPreviewPanel on mobile — eager loaded so ref is ready immediately */}
      {phase === 'results' && isMobile && selections.length > 0 && (
        <ErrorBoundary
          fallbackMessage="Carousel preview failed"
          onReset={() => { setAllPreviews([]); setGenerating(false); }}
        >
        <div style={{ display: 'none' }}>
          <CarouselPreviewPanel
            ref={carouselRef}
            selectedTracks={selectedTracks}
            coverFeature={selections.find(s => s.isCoverFeature) || null}
            onTracksPerSlideChange={setTracksPerSlide}
            carouselAspect={carouselAspect}
            onAspectChange={setCarouselAspect}
            generating={generating}
            onGeneratingChange={setGenerating}
            allPreviews={allPreviews}
            onAllPreviewsChange={setAllPreviews}
          />
        </div>
        </ErrorBoundary>
      )}
      {phase === 'results' && !isMobile && (
        <>
          <StickyToolbar
            toolbarRef={toolbarCallbackRef}
            headerHeight={headerHeight}
            toolbarHeight={toolbarHeight}
            selections={selections}
            targetCount={targetCount}
            onTargetCountChange={setTargetCount}
            onSelectAll={() => {
              haptic();
              const newSelections: typeof selections = [];
              for (const cluster of filteredReleases) {
                const track = cluster.tracks.find(t => t.track_id === cluster.titleTrackId) || cluster.tracks[0];
                if (!selections.some(s => s.track.track_id === track.track_id)) {
                  newSelections.push({ track, albumId: cluster.album_spotify_id, selectionNumber: 0, slideGroup: 0, positionInSlide: 0, isCoverFeature: false });
                }
              }
              setSelections(prev => buildSlots([...prev, ...newSelections]));
            }}
            onClearSelections={() => { haptic(5); pushSelectionHistory(selections); setSelections([]); }}
            onNewScan={() => setPhase('ready')}
            showAddTracks={showAddTracks}
            onToggleAddTracks={() => setShowAddTracks(v => !v)}
            onCloseAddTracks={() => setShowAddTracks(false)}
            onManualImport={(tracks) => {
              setAllTracks(prev => {
                const existing = new Set(prev.map(t => t.track_id));
                const newTracks = tracks.filter(t => !existing.has(t.track_id));
                return [...prev, ...newTracks];
              });
              setReleases(groupIntoReleases([...allTracks, ...tracks]));
              setShowAddTracks(false);
            }}
            onNashvilleReleases={() => { setShowAddTracks(false); setPhase('ready'); setActiveSource('nashville'); }}
            token={token}
            onRescanSpotify={() => { setShowAddTracks(false); if (token) runScan(token); }}
            filter={filter}
            sort={sort}
            searchInput={searchInput}
            onFilterChange={setFilter}
            onSortChange={setSort}
            onSearchChange={setSearchInput}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            filteredReleasesCount={filteredReleases.length}
            trackCount={allTracks.length}
            cardSize={cardSize}
            onCardSizeChange={setCardSize}
            exportScope={exportScope}
            onExportScopeChange={setExportScope}
            selectedTracks={selectedTracks}
            allTracks={allTracks}
            artDownloading={artDownloading}
            onArtDownload={async () => { setArtDownloading(true); try { await downloadArt(exportScope === 'selects' ? selectedTracks : allTracks); } finally { setArtDownloading(false); } }}
            copied={copied}
            onCopyManifest={async () => {
              await navigator.clipboard.writeText(JSON.stringify(selectedTracks, null, 2));
              setCopied(true); setTimeout(() => setCopied(false), 2000);
            }}
            carouselAspect={carouselAspect}
            onAspectChange={setCarouselAspect}
            generating={generating}
            onGenerate={() => carouselRef.current?.generate()}
            onDownloadZip={() => carouselRef.current?.downloadAll()}
            allPreviewsCount={allPreviews.length}
            tracksPerSlide={tracksPerSlide}
            historyLength={historyLength}
            onUndo={undoSelection}
            onShowShortcuts={() => setShowShortcuts(true)}
            onShowToolsSheet={() => setShowToolsSheet(true)}
            filteredReleases={filteredReleases}
            onMobileSelectAll={() => {
              haptic();
              const newSelections: typeof selections = [];
              for (const cluster of filteredReleases) {
                const track = cluster.tracks.find(t => t.track_id === cluster.titleTrackId) || cluster.tracks[0];
                if (!selections.some(s => s.track.track_id === track.track_id)) {
                  newSelections.push({ track, albumId: cluster.album_spotify_id, selectionNumber: 0, slideGroup: 0, positionInSlide: 0, isCoverFeature: false });
                }
              }
              setSelections(prev => buildSlots([...prev, ...newSelections]));
            }}
            onMobileClear={() => { haptic(5); pushSelectionHistory(selections); setSelections([]); }}
          />

          {/* ---- Mobile bottom sheet (overflow tools) ---- */}
          {showToolsSheet && (
            <MobileToolsSheet
              onClose={() => setShowToolsSheet(false)}
              onNewScan={() => { setShowToolsSheet(false); setPhase('ready'); }}
              onAddTracks={() => { setShowToolsSheet(false); setShowAddTracks(true); }}
              onSelectAll={() => {
                haptic();
                const newSelections: typeof selections = [];
                for (const cluster of filteredReleases) {
                  const track = cluster.tracks.find(t => t.track_id === cluster.titleTrackId) || cluster.tracks[0];
                  if (!selections.some(s => s.track.track_id === track.track_id)) {
                    newSelections.push({ track, albumId: cluster.album_spotify_id, selectionNumber: 0, slideGroup: 0, positionInSlide: 0, isCoverFeature: false });
                  }
                }
                setSelections(prev => buildSlots([...prev, ...newSelections]));
              }}
              onClearSelections={() => { haptic(5); pushSelectionHistory(selections); setSelections([]); }}
              selectionsCount={selections.length}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              releaseCount={filteredReleases.length}
              trackCount={allTracks.length}
              cardSize={cardSize}
              onCardSizeChange={setCardSize}
              exportScope={exportScope}
              onExportScopeChange={setExportScope}
              selectedTracks={selectedTracks}
              allTracks={allTracks}
              artDownloading={artDownloading}
              onArtDownload={async () => { setArtDownloading(true); try { await downloadArt(exportScope === 'selects' ? selectedTracks : allTracks); } finally { setArtDownloading(false); } }}
              copied={copied}
              onCopyManifest={async () => {
                await navigator.clipboard.writeText(JSON.stringify(selectedTracks, null, 2));
                setCopied(true); setTimeout(() => setCopied(false), 2000);
              }}
              carouselAspect={carouselAspect}
              onAspectChange={setCarouselAspect}
              selections={selections}
              allPreviewsCount={allPreviews.length}
              tracksPerSlide={tracksPerSlide}
              onDownloadZip={() => carouselRef.current?.downloadAll()}
              historyLength={historyLength}
              onUndo={undoSelection}
              onShowShortcuts={() => setShowShortcuts(true)}
            />
          )}

          {/* ============================================================ */}
          {/*  STEP 1: SELECT TRACKS (scrollable grid below fixed bars)    */}
          {/* ============================================================ */}
          <section ref={step1Ref} style={{ scrollMarginTop: 160 }}>
            {/* Contextual guidance */}
            <div style={{
              padding: '12px 24px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)',
              lineHeight: 1.6, borderBottom: '1px solid var(--midnight-border)',
              background: 'rgba(212,168,67,0.04)',
            }}>
              {selections.length === 0 ? (
                <>Click releases to select tracks for your carousel. <strong>Shift-click</strong> to select a range. Albums with multiple tracks show a "Pick tracks" button to choose individual songs.</>
              ) : selections.length > 0 && !selections.some(s => s.isCoverFeature) ? (
                <>Click the <span style={{ color: 'var(--gold)', fontWeight: 700 }}>&#9733; star</span> on any selected release to set it as the <strong>featured artist on your title slide</strong>. Keep selecting to build your carousel.</>
              ) : (
                <>Scroll down to configure your carousel slides, pick templates, and export. Or keep selecting more tracks.</>
              )}
            </div>
            <div style={{ padding: 24 }}>

              {/* ---- ALBUM VIEW (default) ---- */}
              {viewMode === 'releases' && (
                <div
                  ref={gridContainerRef}
                  className="release-grid"
                  data-testid="track-grid"
                  style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`, position: 'relative' }}
                  onMouseDown={(e) => {
                    if (!e.shiftKey) return;
                    const rect = gridContainerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const initial = { startX: x, startY: y, endX: x, endY: y };
                    setRubberBand(initial);
                    rubberBandRef.current = initial;
                    const onMove = (ev: MouseEvent) => {
                      if (!rect) return;
                      const updated = rubberBandRef.current ? { ...rubberBandRef.current, endX: ev.clientX - rect.left, endY: ev.clientY - rect.top } : null;
                      rubberBandRef.current = updated;
                      setRubberBand(updated);
                    };
                    const onUp = () => {
                      // Wave 7 Block 9 — rubber-band now iterates artist
                      // tiles (`[data-artist-key]`) instead of album tiles.
                      // For each artist whose tile center falls inside the
                      // rubber-band rect, we add the PRIMARY release's title
                      // track — one track per artist, same semantics as the
                      // old album-based flow had one track per album.
                      const rb = rubberBandRef.current;
                      if (gridContainerRef.current && rb) {
                        const cards = gridContainerRef.current.querySelectorAll('[data-artist-key]');
                        const containerRect = gridContainerRef.current.getBoundingClientRect();
                        const selRect = {
                          left: Math.min(rb.startX, rb.endX),
                          top: Math.min(rb.startY, rb.endY),
                          right: Math.max(rb.startX, rb.endX),
                          bottom: Math.max(rb.startY, rb.endY),
                        };
                        const newSelections: SelectionSlot[] = [];
                        cards.forEach(card => {
                          const cardRect = card.getBoundingClientRect();
                          const cx = cardRect.left - containerRect.left + cardRect.width / 2;
                          const cy = cardRect.top - containerRect.top + cardRect.height / 2;
                          if (cx >= selRect.left && cx <= selRect.right && cy >= selRect.top && cy <= selRect.bottom) {
                            const key = card.getAttribute('data-artist-key');
                            if (key) {
                              const group = artistGroups.find(g => g.key === key);
                              if (group) {
                                const albumId = group.primary.album_spotify_id;
                                const track = group.primaryTrack;
                                if (!selections.some(s => s.track.track_id === track.track_id)) {
                                  newSelections.push({
                                    track, albumId,
                                    selectionNumber: 0, slideGroup: 0, positionInSlide: 0, isCoverFeature: false,
                                  });
                                }
                              }
                            }
                          }
                        });
                        if (newSelections.length > 0) {
                          pushSelectionHistory(selections);
                          setSelections(prev => buildSlots([...prev, ...newSelections]));
                        }
                      }
                      rubberBandRef.current = null;
                      setRubberBand(null);
                      document.removeEventListener('mousemove', onMove);
                      document.removeEventListener('mouseup', onUp);
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                  }}
                >
                  {/* Rubber band selection overlay */}
                  {rubberBand && (
                    <div style={{
                      position: 'absolute', zIndex: 10, pointerEvents: 'none',
                      left: Math.min(rubberBand.startX, rubberBand.endX),
                      top: Math.min(rubberBand.startY, rubberBand.endY),
                      width: Math.abs(rubberBand.endX - rubberBand.startX),
                      height: Math.abs(rubberBand.endY - rubberBand.startY),
                      background: 'rgba(212,168,67,0.15)',
                      border: '1px solid var(--gold)',
                      borderRadius: 2,
                    }} />
                  )}
                  {/* Wave 7 Block 9 — artist-grouped post-import tiles.
                      One tile per primary artist. Features bucket under
                      first-listed artist. Multi-track/multi-release
                      artists open a modal on click; single-track artists
                      toggle directly. Shift-click + rubber-band both use
                      artist indices. */}
                  {artistGroups.map((group, idx) => {
                    const slots: SelectionSlot[] = [];
                    let maxOrd = 0;
                    for (const t of group.tracks) {
                      const ord = globalOrdinalByTrackId.get(t.track_id);
                      if (ord) {
                        const slot = selections[ord - 1];
                        if (slot) slots.push(slot);
                        if (ord > maxOrd) maxOrd = ord;
                      }
                    }
                    return (
                      <ArtistClusterCard
                        key={group.key}
                        artist={group}
                        selectedSlots={slots}
                        maxOrdinal={maxOrd > 0 ? maxOrd : null}
                        hasSelections={selections.length > 0}
                        onSelectRelease={(c, trackId) => {
                          if (lastClickedIdx.current >= 0 && window.event && (window.event as KeyboardEvent).shiftKey) {
                            const start = Math.min(lastClickedIdx.current, idx);
                            const end = Math.max(lastClickedIdx.current, idx);
                            setSelections(prev => {
                              const updated = [...prev];
                              for (let i = start; i <= end; i++) {
                                const g = artistGroups[i];
                                if (!g) continue;
                                const t = g.primaryTrack;
                                const alreadyHas = updated.some(s => s.track.track_id === t.track_id);
                                if (!alreadyHas) {
                                  updated.push({
                                    track: t, albumId: g.primary.album_spotify_id,
                                    selectionNumber: updated.length + 1,
                                    slideGroup: getSlideGroup(updated.length + 1),
                                    positionInSlide: ((updated.length) % 8) + 1,
                                    isCoverFeature: false,
                                  });
                                }
                              }
                              return buildSlots(updated);
                            });
                          } else {
                            handleSelectRelease(c, trackId);
                          }
                          lastClickedIdx.current = idx;
                        }}
                        onDeselect={handleDeselect}
                        onSetCoverFeature={handleSetCoverFeature}
                        featureCount={featureCounts.get(group.primary.tracks[0]?.artist_id) || 0}
                        onHover={(c) => { hoveredCluster.current = c; }}
                      />
                    );
                  })}
                </div>
              )}

              {/* ---- TRACK VIEW (flat list, matches Python manifest) ---- */}
              {viewMode === 'tracks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {allTracks
                    .filter(t => {
                      if (filter === 'single') return t.album_type === 'single' && t.total_tracks === 1;
                      if (filter === 'album') return t.album_type !== 'single' || t.total_tracks > 1;
                      return true;
                    })
                    .filter(t => {
                      if (!search) return true;
                      const q = search.toLowerCase();
                      return t.artist_names.toLowerCase().includes(q) || t.track_name.toLowerCase().includes(q) || t.album_name.toLowerCase().includes(q);
                    })
                    .map((track, idx) => {
                      const isSelected = selections.some(s => s.track.track_id === track.track_id);
                      const slot = selections.find(s => s.track.track_id === track.track_id);
                      return (
                        <div
                          key={track.track_id}
                          onClick={(e) => {
                            // Shift-click range select in track view
                            if (lastClickedIdx.current >= 0 && e.shiftKey) {
                              const start = Math.min(lastClickedIdx.current, idx);
                              const end = Math.max(lastClickedIdx.current, idx);
                              setSelections(prev => {
                                const updated = [...prev];
                                const visibleTracks = allTracks; // use full list for indexing
                                for (let i = start; i <= end; i++) {
                                  const t = visibleTracks[i];
                                  if (!t || updated.some(s => s.track.track_id === t.track_id)) continue;
                                  updated.push({
                                    track: t, albumId: t.album_spotify_id,
                                    selectionNumber: updated.length + 1,
                                    slideGroup: getSlideGroup(updated.length + 1),
                                    positionInSlide: ((updated.length) % 8) + 1,
                                    isCoverFeature: false,
                                  });
                                }
                                return buildSlots(updated);
                              });
                            } else {
                              handleSelectRelease(
                                releases.find(r => r.album_spotify_id === track.album_spotify_id)!,
                                track.track_id,
                              );
                            }
                            lastClickedIdx.current = idx;
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                            background: isSelected ? 'rgba(212,168,67,0.1)' : 'transparent',
                            border: isSelected ? '1px solid var(--gold-dark)' : '1px solid transparent',
                            transition: 'all 0.1s',
                          }}
                        >
                          {/* Selection number or track number */}
                          <span className="mono" style={{
                            width: 24, textAlign: 'right', fontSize: 'var(--fs-xs)', fontWeight: 600,
                            color: isSelected ? 'var(--gold)' : 'var(--text-muted)',
                          }}>
                            {slot ? slot.selectionNumber : ''}
                          </span>
                          {track.cover_art_64 && (
                            <img src={track.cover_art_64} alt="" style={{ width: 32, height: 32, borderRadius: 4 }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 'var(--fs-md)', fontWeight: isSelected ? 600 : 400,
                              color: isSelected ? 'var(--gold)' : 'var(--text-primary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {track.track_name}
                            </div>
                            <div style={{
                              fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {track.artist_names} — {track.album_name}
                            </div>
                          </div>
                          <span className={`badge ${track.album_type === 'single' && track.total_tracks === 1 ? 'badge-single' : 'badge-album'}`} style={{ fontSize: 'var(--fs-3xs)' }}>
                            {track.album_type === 'single' && track.total_tracks === 1 ? 'Single' : track.album_type === 'album' ? 'Album' : 'EP'}
                          </span>
                          <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', width: 65, textAlign: 'right' }}>
                            {track.release_date}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}

              {filteredReleases.length === 0 && releases.length > 0 && viewMode === 'releases' && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 48 }}>
                  No releases match your filters.
                </p>
              )}
              {releases.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>
                    {rateLimited ? '429' : '\uD83C\uDFB5'}
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', marginBottom: 8 }}>
                    {rateLimited ? 'Spotify Rate Limited' : 'No releases found this week'}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 440, margin: '0 auto 24px', lineHeight: 1.6 }}>
                    {rateLimited
                      ? 'Spotify throttled the scan \u2014 most artist checks failed. Wait 30-60 minutes and try again, or load a saved week from History.'
                      : `Scanned ${artistCount || '~800'} followed artists for releases since last Friday. If this seems wrong, try re-scanning in a few minutes.`
                    }
                  </p>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {token && (
                      <button className="btn btn-sm btn-gold" onClick={() => runScan(token)}>Re-scan</button>
                    )}
                  </div>
                  {/* Feature overview cards */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 16, marginTop: 48, opacity: 0.5, maxWidth: 800, margin: '48px auto 0',
                  }}>
                    {[
                      { title: 'Scan Releases', desc: 'Finds new music from all your followed artists since last Friday' },
                      { title: 'Build Carousel', desc: 'Generates 1080x1080 Instagram carousel slides automatically' },
                      { title: 'Tag Blocks', desc: 'Auto-resolves Instagram handles for every artist featured' },
                      { title: 'Push to Playlist', desc: 'Updates your NMF Spotify playlist with one click' },
                    ].map(f => (
                      <div key={f.title} className="card" style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 'var(--fs-md)' }}>{f.title}</div>
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>{f.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Track suggestions (shows after 3+ selections) */}
          {selections.length >= 3 && !isMobile && (
            <div style={{ padding: '0 24px' }}>
              <TrackSuggestions releases={filteredReleases} selections={selections} onSelectRelease={handleSelectRelease} />
            </div>
          )}

          {/* ============================================================ */}
          {/*  STEPS 2-5: CAROUSEL BUILDER (CarouselPreviewPanel)          */}
          {/*  Internally contains:                                        */}
          {/*    Step 2 - Configure Slides (TrackCount, Platform, Grid,    */}
          {/*             SlideSplitter)                                    */}
          {/*    Step 3 - Grid Slide Style (TemplateSelector)              */}
          {/*    Step 4 - Title Slide Style (TitleTemplatePicker)          */}
          {/*    Step 5 - Preview & Export                                 */}
          {/* ============================================================ */}
          {selections.length > 0 && (
            <section ref={step2Ref} style={{ scrollMarginTop: 16, padding: '0 24px 24px' }}>
              {/* Provide anchor refs for steps 3-5 that the breadcrumb can scroll to */}
              <div ref={step3Ref as React.RefObject<HTMLDivElement>} style={{ scrollMarginTop: 16 }} />
              <div ref={step4Ref as React.RefObject<HTMLDivElement>} style={{ scrollMarginTop: 16 }} />
              <div ref={step5Ref as React.RefObject<HTMLDivElement>} style={{ scrollMarginTop: 16 }} />

              {/* Carousel builder guidance */}
              <div style={{
                padding: '12px 0 16px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)',
                lineHeight: 1.6, borderBottom: '1px solid var(--midnight-border)', marginBottom: 16,
              }}>
                {!selections.some(s => s.isCoverFeature) ? (
                  <span style={{ color: 'var(--gold)' }}>Tip: Go back up and click the <strong>&#9733; star</strong> on a release to set it as your title slide feature before generating.</span>
                ) : (
                  <>Choose how many tracks per slide, pick your grid and title styles, then hit <strong>Generate Carousel</strong>. Each slide exports as a 1080x1080 PNG ready for Instagram.</>
                )}
              </div>

              <ErrorBoundary
                fallbackMessage="Carousel builder encountered an error"
                onReset={() => { setAllPreviews([]); setGenerating(false); }}
              >
              <Suspense fallback={<div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading carousel tools...</div>}>
              <CarouselPreviewPanel
                ref={carouselRef}
                selectedTracks={selectedTracks}
                coverFeature={selections.find(s => s.isCoverFeature) || null}
                onTracksPerSlideChange={setTracksPerSlide}
                onCarouselGenerated={() => handleSaveWeek({ carousel_generated: true })}
                carouselAspect={carouselAspect}
                onAspectChange={setCarouselAspect}
                generating={generating}
                onGeneratingChange={setGenerating}
                allPreviews={allPreviews}
                onAllPreviewsChange={setAllPreviews}
              />
              </Suspense>
              </ErrorBoundary>

              {/* Guest sign-in prompt after carousel generation */}
              {allPreviews.length > 0 && !userId && (
                <div style={{
                  marginTop: 20, padding: '20px 24px', borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(212,168,67,0.08), rgba(62,230,195,0.06))',
                  border: '1px solid var(--gold)', textAlign: 'center',
                }}>
                  <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Your carousel is ready!
                  </p>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Sign in to save this week's curation and build your archive
                  </p>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-gold" onClick={signInWithGoogle}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      Continue with Google
                    </button>
                    <button className="btn" onClick={signInWithApple}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px',
                        background: 'var(--midnight-hover)', border: '1px solid var(--midnight-border)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                      Continue with Apple
                    </button>
                  </div>
                </div>
              )}

              <ShareCaptionSection
                allPreviewsReady={allPreviews.length > 0}
                slideGroups={slideGroups}
                onHandlesResolved={setResolvedHandles}
                selections={selections}
                resolvedHandles={resolvedHandles}
                weekDate={weekDate}
              />

              <PlaylistSection
                isAdmin={isAdmin}
                token={token}
                selectedCount={selections.length}
                weekDate={weekDate}
                selectedTracks={selectedTracks}
                onCreateAndPush={handleCreateAndPush}
                onPushMaster={handlePlaylistPush}
                startAuth={startAuth}
                setError={setError}
              />

              <details style={{ marginTop: 16, borderTop: '1px solid var(--midnight-border)', paddingTop: 16 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 'var(--fs-lg)', fontWeight: 600 }}>
                  Embed Widget
                </summary>
                <div style={{ marginTop: 12 }}>
                  <EmbedWidget />
                </div>
              </details>

              <details style={{ marginTop: 16, borderTop: '1px solid var(--midnight-border)', paddingTop: 16 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 'var(--fs-lg)', fontWeight: 600 }}>
                  Week History
                </summary>
                <div style={{ marginTop: 12 }}>
                  <WeekHistory onLoadWeek={handleLoadWeek} currentWeekDate={weekDate} />
                </div>
              </details>

              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--midnight-border)' }}>
                {userId ? (
                  <button className="btn btn-gold" onClick={() => handleSaveWeek()}>
                    Save Week to History
                  </button>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-md)', marginBottom: 12 }}>
                      Sign in to save your carousel and access it later
                    </p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="btn btn-gold" onClick={signInWithGoogle}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        Continue with Google
                      </button>
                      <button className="btn" onClick={signInWithApple}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px',
                          background: 'var(--midnight-hover)', border: '1px solid var(--midnight-border)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                        Continue with Apple
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {/* Quick Look modal (spacebar preview) */}
      {quickLookAlbum && (
        <div
          className="modal-overlay"
          onClick={() => setQuickLookAlbum(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 500, textAlign: 'center' }}>
            <img
              src={quickLookAlbum.cover_art_640}
              alt={quickLookAlbum.album_name}
              style={{ width: '100%', maxWidth: 480, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
            />
            <p style={{ fontSize: 'var(--fs-xl)', fontWeight: 600, marginTop: 16, color: 'var(--text-primary)' }}>
              {quickLookAlbum.album_name}
            </p>
            <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)' }}>
              {quickLookAlbum.artist_names}
            </p>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
              Press Space or Escape to close
            </p>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div
          onClick={() => setShowShortcuts(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--midnight-raised)', borderRadius: 16, padding: 32, maxWidth: 480, width: '90%', border: '1px solid var(--midnight-border)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', marginBottom: 20, color: 'var(--gold)' }}>Keyboard Shortcuts</h2>
            {[
              ['Cmd + A', 'Select all visible releases'],
              ['Cmd + Shift + A', 'Clear all selections'],
              ['Cmd + Z', 'Undo last selection change'],
              ['Space', 'Quick Look preview (hover over album first)'],
              ['Shift + Drag', 'Rubber-band select multiple albums'],
              ['Escape', 'Close modal / overlay'],
              ['?', 'Toggle this shortcuts panel'],
            ].map(([key, desc]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--midnight-border)' }}>
                <kbd style={{ background: 'var(--midnight)', padding: '3px 10px', borderRadius: 6, fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-mono)', color: 'var(--gold)', border: '1px solid var(--midnight-border)' }}>{key}</kbd>
                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>{desc}</span>
              </div>
            ))}
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginTop: 16, textAlign: 'center' }}>Press Escape or ? to close</p>
          </div>
        </div>
      )}

      {/* Status bar — Lightroom-style bottom bar */}
      {phase === 'results' && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
          background: 'var(--midnight-raised)', borderTop: '1px solid var(--midnight-border)',
          padding: '4px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
        }}>
          <span>{releases.length} {releases.length === 1 ? 'release' : 'releases'} &bull; {allTracks.length} {allTracks.length === 1 ? 'track' : 'tracks'}</span>
          <span>{selections.length} selected &bull; {allPreviews.length > 0 ? allPreviews.length : Math.ceil(selections.length / tracksPerSlide) + 1} slides</span>
          <span>NMF Curator Studio v1.0</span>
        </div>
      )}
      <ToastContainer />
      <KeyboardHelp />
      <Onboarding />
    </div>
  );
}
