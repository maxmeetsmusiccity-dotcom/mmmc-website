import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { startAuth, exchangeCode, getToken, clearToken, refreshToken, isTokenExpired } from '../lib/auth';
import {
  fetchFollowedArtists,
  fetchNewReleases,
  getLastFriday,
  getScanCutoff,
  groupIntoReleases,
  replacePlaylistTracks,
  appendPlaylistTracks,
  getPlaylistName,
  createPlaylist,
  type TrackItem,
  type ReleaseCluster,
} from '../lib/spotify';
import {
  type SelectionSlot,
  buildSlots,
  getSlideGroup,
} from '../lib/selection';
import { downloadJSON, downloadCSV, downloadArt } from '../lib/downloads';
import { saveWeek, saveFeatures, getFeatureCounts, type NMFWeek } from '../lib/supabase';
import { batchResolveAppleMusic } from '../lib/apple-music';
import ClusterCard from '../components/ClusterCard';
import FilterBar from '../components/FilterBar';
import PlaylistCreate from '../components/PlaylistCreate';
import CarouselPreviewPanel from '../components/CarouselPreviewPanel';
import TagBlocks from '../components/TagBlocks';
import WeekHistory from '../components/WeekHistory';
import EmbedWidget from '../components/EmbedWidget';
import ProductNav from '../components/ProductNav';
import SourceSelector from '../components/SourceSelector';
import ManualImport from '../components/ManualImport';
import CaptionGenerator from '../components/CaptionGenerator';
import type { MusicSource } from '../lib/sources/types';
import { checkScanHealth } from '../lib/spotify';
import { useAuth } from '../lib/auth-context';

type Phase = 'auth' | 'ready' | 'scanning' | 'results';
type FilterKey = 'all' | 'single' | 'album';
type SortKey = 'date' | 'artist' | 'title';

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
  const { user, isGuest, signOut } = useAuth();
  const userId = user?.id || null;
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(getToken());
  const [phase, setPhase] = useState<Phase>('auth');
  const [allTracks, setAllTracks] = useState<TrackItem[]>([]);
  const [releases, setReleases] = useState<ReleaseCluster[]>([]);
  const [selections, setSelections] = useState<SelectionSlot[]>([]);
  const [targetCount, setTargetCount] = useState(32);
  const [scanStatus, setScanStatus] = useState('');
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('date');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [artDownloading, setArtDownloading] = useState(false);
  const [artistCount, setArtistCount] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [appleEnriching, setAppleEnriching] = useState(false);
  const [featureCounts, setFeatureCounts] = useState<Map<string, number>>(new Map());
  const [activeSource, setActiveSource] = useState<MusicSource['id']>('spotify');
  const [tracksPerSlide, setTracksPerSlide] = useState(8);
  const [viewMode, setViewMode] = useState<'releases' | 'tracks'>('releases');
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [cardSize, setCardSize] = useState(() => {
    try { return parseInt(localStorage.getItem('nmf_card_size') || '240'); } catch { return 240; }
  });

  // Undo stack for selections (last 20 states)
  const selectionHistory = useRef<SelectionSlot[][]>([]);

  // Quick Look: spacebar preview
  const [quickLookAlbum, setQuickLookAlbum] = useState<ReleaseCluster | null>(null);
  const hoveredCluster = useRef<ReleaseCluster | null>(null);

  // Rubber-band drag select
  const [rubberBand, setRubberBand] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const pushSelectionHistory = useCallback((prev: SelectionSlot[]) => {
    selectionHistory.current = [...selectionHistory.current.slice(-19), prev];
  }, []);

  // Shift-click multi-select tracking
  const lastClickedIdx = useRef<number>(-1);

  // Step section refs for scroll-to
  const step1Ref = useRef<HTMLElement>(null);
  const step2Ref = useRef<HTMLElement>(null);
  const step3Ref = useRef<HTMLElement>(null);
  const step4Ref = useRef<HTMLElement>(null);
  const step5Ref = useRef<HTMLElement>(null);

  const weekDate = getLastFriday();


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
          setPhase('auth');
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
      console.log(`[SCAN] Health check: ${health.message}`);

      setScanStatus('Fetching followed artists...');
      const artists = await fetchFollowedArtists(activeToken, (cur, tot) => {
        setScanProgress({ current: cur, total: tot });
        setScanStatus(`Loaded ${cur} artists...`);
      });

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
      });

      const { tracks, failCount, totalArtists, rateLimited: wasRateLimited, retryAfterSeconds } = result;
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
      if ((e as Error).message === 'AUTH_EXPIRED') {
        setToken(null);
        setPhase('auth');
        setError('Session expired. Please reconnect.');
      } else {
        setError((e as Error).message);
        setPhase('auth');
      }
    }
  }, [weekDate]);

  // Selection helpers — keyed by track ID so multiple tracks per album can be selected
  const selectionByAlbum = useMemo(() => {
    const map = new Map<string, SelectionSlot>();
    for (const s of selections) {
      if (!map.has(s.albumId)) map.set(s.albumId, s);
    }
    return map;
  }, [selections]);

  /** All selected slots grouped by album ID (supports multi-track per album) */
  const selectionsByAlbum = useMemo(() => {
    const map = new Map<string, SelectionSlot[]>();
    for (const s of selections) {
      const arr = map.get(s.albumId) || [];
      arr.push(s);
      map.set(s.albumId, arr);
    }
    return map;
  }, [selections]);

  /** Haptic tap for mobile — light vibration on selection actions */
  const haptic = useCallback((ms = 10) => {
    try { navigator?.vibrate?.(ms); } catch { /* not supported */ }
  }, []);

  const handleSelectRelease = useCallback((cluster: ReleaseCluster, trackId?: string) => {
    haptic();
    setSelections(prev => {
      pushSelectionHistory(prev);
      const chosenTrackId = trackId || cluster.titleTrackId;
      const track = cluster.tracks.find(t => t.track_id === chosenTrackId) || cluster.tracks[0];

      // Already selected this specific track? Deselect it
      const existingTrack = prev.findIndex(s => s.track.track_id === track.track_id);
      if (existingTrack >= 0) {
        return buildSlots(prev.filter((_, i) => i !== existingTrack));
      }

      // For singles (1 track): if album already selected, this is a deselect of the only track
      if (cluster.isSingle) {
        const existingAlbum = prev.findIndex(s => s.albumId === cluster.album_spotify_id);
        if (existingAlbum >= 0) {
          return buildSlots(prev.filter((_, i) => i !== existingAlbum));
        }
      }

      // Add new selection (allows multiple tracks from same album)
      const newSlot: SelectionSlot = {
        track,
        albumId: cluster.album_spotify_id,
        selectionNumber: prev.length + 1,
        slideGroup: getSlideGroup(prev.length + 1),
        positionInSlide: ((prev.length) % 8) + 1,
        isCoverFeature: false,
      };

      return buildSlots([...prev, newSlot]);
    });
  }, []);

  const handleDeselect = useCallback((albumId: string, trackId?: string) => {
    haptic(5);
    setSelections(prev => {
      if (trackId) {
        // Deselect specific track
        return buildSlots(prev.filter(s => s.track.track_id !== trackId));
      }
      // Deselect all tracks from this album
      return buildSlots(prev.filter(s => s.albumId !== albumId));
    });
  }, []);

  const handleSetCoverFeature = useCallback((trackId: string) => {
    haptic(15);
    setSelections(prev => prev.map(s => ({
      ...s,
      isCoverFeature: s.track.track_id === trackId,
    })));
  }, []);

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
        const prev = selectionHistory.current.pop();
        if (prev) setSelections(prev);
      }
      // Space — Quick Look preview of hovered album
      if (e.key === ' ' && !meta && hoveredCluster.current) {
        e.preventDefault();
        setQuickLookAlbum(prev => prev ? null : hoveredCluster.current);
      }
      // Escape — dismiss Quick Look
      if (e.key === 'Escape' && quickLookAlbum) {
        setQuickLookAlbum(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, releases, pushSelectionHistory, quickLookAlbum]);

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
    setPhase('auth');
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
    if (!userId) return; // Guests don't persist to Supabase
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
      {/* Header — sticky on desktop */}
      <header style={{
        padding: '14px 24px',
        borderBottom: '1px solid var(--midnight-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14,
        position: 'sticky', top: 0, zIndex: 30,
        background: 'var(--midnight)',
        boxShadow: '0 1px 8px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ProductNav />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', fontWeight: 600 }}>
            New Music Friday
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {lastScanned && (
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)' }}>
              {new Date(lastScanned).toLocaleString()}
            </span>
          )}
          {/* Re-scan: works with Spotify token OR via server-side scan */}
          {phase === 'results' && (
            <>
              {token ? (
                <>
                  <button className="btn btn-sm" onClick={() => runScan(token)}>Re-scan</button>
                  <button className="btn btn-sm" onClick={() => { localStorage.removeItem('nmf_followed_artists'); runScan(token); }}>Refresh Follows</button>
                  <button className="btn btn-sm btn-danger" onClick={handleDisconnect} style={{ fontSize: 'var(--fs-2xs)' }}>Disconnect Spotify</button>
                </>
              ) : (
                <button className="btn btn-sm" onClick={() => setPhase(token ? 'ready' : 'auth')}>New Scan</button>
              )}
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
      </header>

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
            Showing cached results{lastScanned ? ` from ${new Date(lastScanned).toLocaleString()}` : ''}.
          </span>
          <button
            className="btn btn-sm btn-gold"
            onClick={() => {
              setLoadedFromCache(false);
              if (token) runScan(token);
              else setPhase(token ? 'ready' : 'auth');
            }}
            style={{ fontSize: 'var(--fs-sm)', padding: '6px 16px' }}
          >
            Re-scan for latest releases
          </button>
        </div>
      )}

      {/* Auth Phase */}
      {phase === 'auth' && !token && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: 24, textAlign: 'center',
        }}>
          <div className="animate-float-up" style={{ maxWidth: 400 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', marginBottom: 12 }}>
              Connect <span style={{ color: 'var(--gold)' }}>Spotify</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
              Scan your followed artists for new releases since last Friday.
            </p>
            <button className="btn btn-spotify" onClick={startAuth} style={{ fontSize: 'var(--fs-lg)', padding: '14px 32px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Connect Spotify
            </button>
            <button className="btn" onClick={loadDemo} style={{ fontSize: 'var(--fs-lg)', padding: '14px 32px' }}>
              Try Demo
            </button>
            <div style={{ marginTop: 32 }}>
              <details style={{ textAlign: 'left' }}>
                <summary style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-md)', cursor: 'pointer' }}>
                  Manual token entry (if redirect fails)
                </summary>
                <div style={{ marginTop: 12 }}>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Paste access token or full redirect URL..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim();
                        try {
                          const url = new URL(val);
                          const code = url.searchParams.get('code');
                          if (code) {
                            exchangeCode(code).then(t => { setToken(t); setError(''); }).catch(err => setError(err.message));
                            return;
                          }
                        } catch { /* not a URL */ }
                        if (val.length > 20) {
                          sessionStorage.setItem('spotify_token', val);
                          setToken(val);
                        }
                      }
                    }}
                  />
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginTop: 8 }}>
                    Press Enter to submit. Accepts a full redirect URL with code= or a raw access token.
                  </p>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Ready Phase -- token received, waiting for explicit scan */}
      {phase === 'ready' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: 24, textAlign: 'center',
        }}>
          <div className="animate-float-up" style={{ maxWidth: 560, width: '100%' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', marginBottom: 16 }}>
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
              <div style={{ marginTop: 16 }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 'var(--fs-md)' }}>
                  Scan your followed artists for new releases since last Friday.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button data-testid="scan-button" className="btn btn-gold" onClick={() => token && runScan(token)} style={{ fontSize: 'var(--fs-lg)', padding: '14px 32px' }}>
                    Scan New Releases
                  </button>
                  <button className="btn" onClick={loadDemo}>
                    Try Demo
                  </button>
                </div>
              </div>
            )}

            {/* Apple Music source — coming soon */}
            {activeSource === 'apple-music' && (
              <div style={{ marginTop: 16 }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 'var(--fs-md)' }}>
                  Apple Music library scanning is coming soon. In the meantime, use Spotify or import a CSV manifest.
                </p>
                <button
                  className="btn"
                  disabled
                  style={{ fontSize: 'var(--fs-lg)', padding: '14px 32px', opacity: 0.5, cursor: 'not-allowed' }}
                >
                  Coming Soon
                </button>
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
            onClick={() => { setIsDemoMode(false); setAllTracks([]); setReleases([]); setSelections([]); setPhase(token ? 'ready' : 'auth'); }}
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
          </div>
        </div>
      )}

      {/* Results Phase -- single scrollable page with 5 steps */}
      {phase === 'results' && (
        <>
          {/* ============================================================ */}
          {/*  STICKY TOOLBAR: counter + filters (consolidated 4→2 rows)    */}
          {/* ============================================================ */}
          <div style={{
            position: 'sticky', top: 48, zIndex: 20,
            background: 'var(--midnight)', borderBottom: '1px solid var(--midnight-border)',
          }}>
            {/* Row 1: Selection counter + target + filters + stats */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 10,
              padding: '12px 24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="mono" style={{
                  fontSize: 'var(--fs-2xl)', fontWeight: 700,
                  color: selections.length > targetCount ? 'var(--mmmc-red)' : selections.length > 0 ? 'var(--gold)' : 'var(--text-muted)',
                }}>
                  {selections.length}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-md)' }}>/ {targetCount}</span>
                {selections.length > targetCount && (
                  <span style={{ color: 'var(--mmmc-red)', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>Over limit!</span>
                )}
                <select
                  value={targetCount}
                  onChange={e => setTargetCount(Number(e.target.value))}
                  style={{
                    background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
                    borderRadius: 6, color: 'var(--text-secondary)', padding: '3px 6px',
                    fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)',
                  }}
                >
                  {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} track{n !== 1 ? 's' : ''}</option>
                  ))}
                </select>
                {/* Source switcher — add more tracks from any source */}
                <details style={{ position: 'relative', display: 'inline-block' }}>
                  <summary style={{
                    fontSize: 'var(--fs-2xs)', color: 'var(--gold)', cursor: 'pointer',
                    padding: '2px 8px', borderRadius: 6,
                    border: '1px solid var(--gold-dark)', background: 'rgba(212,168,67,0.08)',
                    listStyle: 'none',
                  }} title="Add more tracks from Spotify, CSV, or artist browser">
                    + Add Tracks
                  </summary>
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100,
                    background: 'var(--midnight-raised)', border: '1px solid var(--midnight-border)',
                    borderRadius: 8, padding: 12, minWidth: 280, maxHeight: '60vh', overflow: 'auto',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}>
                    <ManualImport onImport={(tracks) => {
                      setAllTracks(prev => {
                        const existing = new Set(prev.map(t => t.track_id));
                        const newTracks = tracks.filter(t => !existing.has(t.track_id));
                        return [...prev, ...newTracks];
                      });
                      setReleases(groupIntoReleases([...allTracks, ...tracks]));
                    }} />
                    {token && (
                      <button className="btn btn-sm btn-spotify" onClick={() => runScan(token)} style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}>
                        Re-scan Spotify
                      </button>
                    )}
                  </div>
                </details>
                <span style={{ color: 'var(--midnight-border)', margin: '0 2px' }}>|</span>
                {/* Select All / Clear */}
                <button
                  onClick={() => {
                    haptic();
                    const newSelections: typeof selections = [];
                    for (const cluster of filteredReleases) {
                      const track = cluster.tracks.find(t => t.track_id === cluster.titleTrackId) || cluster.tracks[0];
                      if (!selections.some(s => s.track.track_id === track.track_id)) {
                        newSelections.push({
                          track, albumId: cluster.album_spotify_id,
                          selectionNumber: 0, slideGroup: 0, positionInSlide: 0, isCoverFeature: false,
                        });
                      }
                    }
                    setSelections(prev => buildSlots([...prev, ...newSelections]));
                  }}
                  style={{ fontSize: 'var(--fs-2xs)', color: 'var(--steel)', cursor: 'pointer', padding: '2px 6px' }}
                  title="Select the title track from every visible release (Cmd+A)"
                >
                  Select All
                </button>
                {selections.length > 0 && (
                  <button
                    onClick={() => { haptic(5); pushSelectionHistory(selections); setSelections([]); }}
                    style={{ fontSize: 'var(--fs-2xs)', color: 'var(--mmmc-red)', cursor: 'pointer', padding: '2px 6px' }}
                    title="Remove all selections (Cmd+Shift+A)"
                  >
                    Clear
                  </button>
                )}
                <span style={{ color: 'var(--midnight-border)', margin: '0 2px' }}>|</span>
                <FilterBar
                  filter={filter} sort={sort} search={search}
                  onFilterChange={setFilter} onSortChange={setSort} onSearchChange={setSearch}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>
                  {viewMode === 'releases'
                    ? `${filteredReleases.length} releases (${allTracks.length} tracks)`
                    : `${allTracks.length} tracks`}
                </span>
                <button
                  className={`filter-pill ${viewMode === 'releases' ? 'active' : ''}`}
                  onClick={() => setViewMode('releases')}
                  style={{ fontSize: 'var(--fs-2xs)', padding: '2px 8px' }}
                >Albums</button>
                <button
                  className={`filter-pill ${viewMode === 'tracks' ? 'active' : ''}`}
                  onClick={() => setViewMode('tracks')}
                  style={{ fontSize: 'var(--fs-2xs)', padding: '2px 8px' }}
                >Tracks</button>
                <Link to="/newmusicfriday/archive" className="filter-pill" style={{ textDecoration: 'none', fontSize: 'var(--fs-2xs)', padding: '2px 8px' }}>
                  Archive
                </Link>
                {/* Thumbnail size slider */}
                <span style={{ color: 'var(--midnight-border)', margin: '0 2px' }}>|</span>
                <input
                  type="range" min="120" max="350" value={cardSize}
                  onChange={e => { const v = Number(e.target.value); setCardSize(v); try { localStorage.setItem('nmf_card_size', String(v)); } catch {} }}
                  style={{ width: 80 }}
                  title={`Card size: ${cardSize}px`}
                />
              </div>
            </div>

            {/* Row 2: Downloads (collapsed into a details for space) */}
            <div style={{
              padding: '4px 24px 8px',
              display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
              fontSize: 'var(--fs-xs)',
            }}>
              <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }} onClick={() => downloadCSV(allTracks, 'nmf-all-tracks.csv')}>CSV</button>
              <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }} onClick={() => downloadJSON(allTracks, 'nmf-all-tracks.json')}>JSON</button>
              <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }} onClick={async () => { setArtDownloading(true); try { await downloadArt(allTracks); } finally { setArtDownloading(false); } }} disabled={artDownloading}>
                {artDownloading ? '...' : 'Art ZIP'}
              </button>
              {selections.length > 0 && (
                <>
                  <span style={{ color: 'var(--midnight-border)' }}>|</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{selections.length} selected:</span>
                  <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }} onClick={() => downloadCSV(selectedTracks, 'nmf-curated.csv')}>CSV</button>
                  <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }} onClick={() => downloadJSON(selectedTracks, 'nmf-curated.json')}>JSON</button>
                  <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }} onClick={async () => {
                    await navigator.clipboard.writeText(JSON.stringify(selectedTracks, null, 2));
                    setCopied(true); setTimeout(() => setCopied(false), 2000);
                  }}>{copied ? 'Copied!' : 'Manifest'}</button>
                </>
              )}
            </div>
          </div>

          {/* ============================================================ */}
          {/*  STEP 1: SELECT TRACKS (scrollable grid below sticky bar)    */}
          {/* ============================================================ */}
          <section ref={step1Ref} style={{ scrollMarginTop: 120 }}>
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
                    setRubberBand({ startX: x, startY: y, endX: x, endY: y });
                    const onMove = (ev: MouseEvent) => {
                      if (!rect) return;
                      setRubberBand(prev => prev ? { ...prev, endX: ev.clientX - rect.left, endY: ev.clientY - rect.top } : null);
                    };
                    const onUp = () => {
                      // Select all cards within the rubber band
                      if (gridContainerRef.current && rubberBand) {
                        const cards = gridContainerRef.current.querySelectorAll('[data-album-id]');
                        const containerRect = gridContainerRef.current.getBoundingClientRect();
                        const selRect = {
                          left: Math.min(rubberBand.startX, rubberBand.endX),
                          top: Math.min(rubberBand.startY, rubberBand.endY),
                          right: Math.max(rubberBand.startX, rubberBand.endX),
                          bottom: Math.max(rubberBand.startY, rubberBand.endY),
                        };
                        const newSelections: SelectionSlot[] = [];
                        cards.forEach(card => {
                          const cardRect = card.getBoundingClientRect();
                          const cx = cardRect.left - containerRect.left + cardRect.width / 2;
                          const cy = cardRect.top - containerRect.top + cardRect.height / 2;
                          if (cx >= selRect.left && cx <= selRect.right && cy >= selRect.top && cy <= selRect.bottom) {
                            const albumId = card.getAttribute('data-album-id');
                            if (albumId) {
                              const cluster = filteredReleases.find(r => r.album_spotify_id === albumId);
                              if (cluster && !selections.some(s => s.albumId === albumId)) {
                                const track = cluster.tracks.find(t => t.track_id === cluster.titleTrackId) || cluster.tracks[0];
                                newSelections.push({
                                  track, albumId,
                                  selectionNumber: 0, slideGroup: 0, positionInSlide: 0, isCoverFeature: false,
                                });
                              }
                            }
                          }
                        });
                        if (newSelections.length > 0) {
                          pushSelectionHistory(selections);
                          setSelections(prev => buildSlots([...prev, ...newSelections]));
                        }
                      }
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
                  {filteredReleases.map((cluster, idx) => (
                    <ClusterCard
                      key={cluster.album_spotify_id}
                      cluster={cluster}
                      selectionSlot={selectionByAlbum.get(cluster.album_spotify_id) || null}
                      selectedSlots={selectionsByAlbum.get(cluster.album_spotify_id)}
                      hasSelections={selections.length > 0}
                      onSelectRelease={(c, trackId) => {
                        if (lastClickedIdx.current >= 0 && window.event && (window.event as KeyboardEvent).shiftKey) {
                          const start = Math.min(lastClickedIdx.current, idx);
                          const end = Math.max(lastClickedIdx.current, idx);
                          setSelections(prev => {
                            const updated = [...prev];
                            for (let i = start; i <= end; i++) {
                              const r = filteredReleases[i];
                              const alreadyHas = updated.some(s => s.albumId === r.album_spotify_id);
                              if (!alreadyHas) {
                                const track = r.tracks.find(t => t.track_id === r.titleTrackId) || r.tracks[0];
                                updated.push({
                                  track, albumId: r.album_spotify_id,
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
                      featureCount={featureCounts.get(cluster.tracks[0]?.artist_id) || 0}
                      onHover={(c) => { hoveredCluster.current = c; }}
                    />
                  ))}
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

              <CarouselPreviewPanel
                selectedTracks={selectedTracks}
                coverFeature={selections.find(s => s.isCoverFeature) || null}
                onTracksPerSlideChange={setTracksPerSlide}
              />

              {/* Collapsible extras */}
              <details style={{ marginTop: 24, borderTop: '1px solid var(--midnight-border)', paddingTop: 16 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 'var(--fs-lg)', fontWeight: 600 }}>
                  Instagram Tags
                </summary>
                <TagBlocks slideGroups={slideGroups} />
                <CaptionGenerator selections={selections} handles={new Map()} weekDate={weekDate} />
              </details>

              <details style={{ marginTop: 16, borderTop: '1px solid var(--midnight-border)', paddingTop: 16 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 'var(--fs-lg)', fontWeight: 600 }}>
                  Push to Spotify
                </summary>
                <div style={{ marginTop: 12 }}>
                  {token ? (
                    <PlaylistCreate
                      selectedCount={selections.length}
                      weekDate={weekDate}
                      onCreateAndPush={handleCreateAndPush}
                      onPushMaster={handlePlaylistPush}
                      getPlaylistName={() => getPlaylistName(token, PLAYLIST_ID)}
                    />
                  ) : (
                    <>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-md)' }}>Connect Spotify to push to a Spotify playlist.</p>
                    <button
                      className="btn btn-sm"
                      style={{ marginTop: 8 }}
                      onClick={async () => {
                        try {
                          const { authorizeAppleMusic } = await import('../lib/sources/apple-music');
                          await authorizeAppleMusic();
                          const music = (window as any).MusicKit?.getInstance();
                          if (!music) throw new Error('MusicKit not available');
                          // Create playlist
                          const name = `New Music Friday — ${new Date(weekDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
                          const trackIds = selectedTracks
                            .filter(t => t.apple_music_url)
                            .map(t => {
                              const match = t.apple_music_url?.match(/\/(\d+)$/);
                              return match ? { id: match[1], type: 'songs' as const } : null;
                            })
                            .filter(Boolean);
                          if (trackIds.length === 0) {
                            alert('No Apple Music track IDs found. Run Apple Music enrichment first.');
                            return;
                          }
                          await music.api.music('/v1/me/library/playlists', undefined, {
                            fetchOptions: {
                              method: 'POST',
                              body: JSON.stringify({
                                attributes: { name, description: 'Curated by Max Meets Music City' },
                                relationships: { tracks: { data: trackIds } },
                              }),
                            },
                          });
                          alert(`Created Apple Music playlist: ${name}`);
                        } catch (e) {
                          alert(`Apple Music error: ${(e as Error).message}`);
                        }
                      }}
                    >
                      Push to Apple Music
                    </button>
                    </>
                  )}
                </div>
              </details>

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
                  Import CSV Manifest
                </summary>
                <div style={{ marginTop: 12 }}>
                  <ManualImport onImport={(tracks) => {
                    setAllTracks(prev => {
                      const existingIds = new Set(prev.map(t => t.track_id));
                      const newTracks = tracks.filter(t => !existingIds.has(t.track_id));
                      const merged = [...prev, ...newTracks];
                      setReleases(groupIntoReleases(merged));
                      return merged;
                    });
                  }} />
                  <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                    Import additional tracks from a CSV manifest. Duplicates are skipped.
                  </p>
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
                <button className="btn btn-gold" onClick={() => handleSaveWeek()}>
                  Save Week to History
                </button>
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

      {/* Status bar — Lightroom-style bottom bar */}
      {phase === 'results' && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
          background: 'var(--midnight-raised)', borderTop: '1px solid var(--midnight-border)',
          padding: '4px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
        }}>
          <span>{releases.length} releases &bull; {allTracks.length} tracks</span>
          <span>{selections.length} selected &bull; {Math.ceil(selections.length / tracksPerSlide)} slides</span>
          <span>NMF Curator Studio v1.0</span>
        </div>
      )}
    </div>
  );
}
