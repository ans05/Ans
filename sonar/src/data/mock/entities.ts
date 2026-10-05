import type { Artist, Label, Producer, Song, Venue } from "@/domain/types";

/**
 * Entirely fictional dataset. No real artists, labels or venues are depicted,
 * and every figure is invented for demonstration.
 */

export const artists: Artist[] = [
  {
    id: "velvet-arcade", type: "artist", name: "Velvet Arcade", city: "Los Angeles",
    genre: "Alt R&B", monthlyListeners: 8_420_000,
    topTracks: [{ title: "Neon Lullaby", songId: "neon-lullaby" }, { title: "Glass Hour" }, { title: "Sundown Protocol", songId: "sundown-protocol" }],
    recentReleases: [{ title: "Afterglow Tapes", kind: "Album", date: "2026-08-14" }, { title: "Glass Hour", kind: "Single", date: "2026-05-02" }],
  },
  {
    id: "kaito-rune", type: "artist", name: "Kaito Rune", city: "Los Angeles",
    genre: "Hip-Hop", monthlyListeners: 12_900_000,
    topTracks: [{ title: "Low Orbit", songId: "low-orbit" }, { title: "Marble Freeway" }, { title: "Sundown Protocol", songId: "sundown-protocol" }],
    recentReleases: [{ title: "Marble Freeway", kind: "Album", date: "2026-09-05" }, { title: "Low Orbit", kind: "Single", date: "2026-06-20" }],
  },
  {
    id: "marisol-vega", type: "artist", name: "Marisol Vega", city: "Los Angeles",
    genre: "Latin Pop", monthlyListeners: 6_100_000,
    topTracks: [{ title: "Costa Eléctrica", songId: "costa-electrica" }, { title: "Domingo Azul" }],
    recentReleases: [{ title: "Domingo Azul", kind: "EP", date: "2026-07-11" }],
  },
  {
    id: "ellery-cross", type: "artist", name: "Ellery Cross", city: "Atlanta",
    genre: "Trap", monthlyListeners: 15_300_000,
    topTracks: [{ title: "Concrete Halo", songId: "concrete-halo" }, { title: "Southbound" }, { title: "Low Orbit", songId: "low-orbit" }],
    recentReleases: [{ title: "Southbound", kind: "Album", date: "2026-09-19" }, { title: "Concrete Halo", kind: "Single", date: "2026-04-18" }],
  },
  {
    id: "nia-okafor", type: "artist", name: "Nia Okafor", city: "Atlanta",
    genre: "Afro-Fusion", monthlyListeners: 5_700_000,
    topTracks: [{ title: "Lagos to Peachtree", songId: "lagos-to-peachtree" }, { title: "Slow Fire" }],
    recentReleases: [{ title: "Slow Fire", kind: "EP", date: "2026-08-01" }],
  },
  {
    id: "tempest-jones", type: "artist", name: "Tempest Jones", city: "Atlanta",
    genre: "Trap", monthlyListeners: 9_200_000,
    topTracks: [{ title: "Concrete Halo", songId: "concrete-halo" }, { title: "Static Bloom" }],
    recentReleases: [{ title: "Static Bloom", kind: "Mixtape", date: "2026-06-06" }],
  },
  {
    id: "juno-halloran", type: "artist", name: "Juno Halloran", city: "New York",
    genre: "Indie Pop", monthlyListeners: 4_900_000,
    topTracks: [{ title: "Fire Escape Summer", songId: "fire-escape-summer" }, { title: "Pale Blue Dot Com" }],
    recentReleases: [{ title: "Pale Blue Dot Com", kind: "Album", date: "2026-03-27" }],
  },
  {
    id: "cairo-blake", type: "artist", name: "Cairo Blake", city: "New York",
    genre: "Hip-Hop", monthlyListeners: 10_800_000,
    topTracks: [{ title: "Basement Gospel", songId: "basement-gospel" }, { title: "Fire Escape Summer", songId: "fire-escape-summer" }],
    recentReleases: [{ title: "Basement Gospel", kind: "Album", date: "2026-09-12" }],
  },
  {
    id: "mina-sato", type: "artist", name: "Mina Sato", city: "New York",
    genre: "Electronic", monthlyListeners: 3_600_000,
    topTracks: [{ title: "Tokyo Subway Dream" }, { title: "Neon Lullaby", songId: "neon-lullaby" }],
    recentReleases: [{ title: "Tokyo Subway Dream", kind: "EP", date: "2026-07-25" }],
  },
  {
    id: "ode-to-neon", type: "artist", name: "Ode to Neon", city: "London",
    genre: "Synthwave", monthlyListeners: 7_300_000,
    topTracks: [{ title: "Midnight Zone 1" }, { title: "Neon Lullaby", songId: "neon-lullaby" }],
    recentReleases: [{ title: "Midnight Zone 1", kind: "Album", date: "2026-05-30" }],
  },
  {
    id: "ayo-bankole", type: "artist", name: "Ayo Bankole", city: "London",
    genre: "Afrobeats", monthlyListeners: 11_400_000,
    topTracks: [{ title: "Lagos to Peachtree", songId: "lagos-to-peachtree" }, { title: "Thames Run" }],
    recentReleases: [{ title: "Thames Run", kind: "Album", date: "2026-09-26" }],
  },
  {
    id: "rosa-delacroix", type: "artist", name: "Rosa Delacroix", city: "London",
    genre: "Neo-Soul", monthlyListeners: 4_200_000,
    topTracks: [{ title: "Ironworks Blues", songId: "ironworks-blues" }, { title: "Candlewick" }],
    recentReleases: [{ title: "Candlewick", kind: "EP", date: "2026-08-22" }],
  },
  {
    id: "static-choir", type: "artist", name: "Static Choir", city: "Chicago",
    genre: "House", monthlyListeners: 3_100_000,
    topTracks: [{ title: "Lakeshore 4AM", songId: "lakeshore-4am" }, { title: "Sundown Protocol", songId: "sundown-protocol" }],
    recentReleases: [{ title: "Lakeshore 4AM", kind: "EP", date: "2026-06-13" }],
  },
  {
    id: "dagny-pierce", type: "artist", name: "Dagny Pierce", city: "Chicago",
    genre: "Indie Rock", monthlyListeners: 2_700_000,
    topTracks: [{ title: "Wreck Room Radio" }, { title: "Fire Escape Summer", songId: "fire-escape-summer" }],
    recentReleases: [{ title: "Wreck Room Radio", kind: "Album", date: "2026-04-04" }],
  },
  {
    id: "marquis-vale", type: "artist", name: "Marquis Vale", city: "Chicago",
    genre: "Drill", monthlyListeners: 8_900_000,
    topTracks: [{ title: "Lakeshore 4AM", songId: "lakeshore-4am" }, { title: "Cold Frontage" }],
    recentReleases: [{ title: "Cold Frontage", kind: "Album", date: "2026-09-02" }],
  },
];

export const producers: Producer[] = [
  { id: "halcyon-wu", type: "producer", name: "Halcyon Wu", city: "Los Angeles", genre: "Alt R&B / Ambient", credits: 214, monthlyListeners: 1_900_000 },
  { id: "bo-mercer", type: "producer", name: "Bo Mercer", city: "Los Angeles", genre: "Hip-Hop", credits: 168, monthlyListeners: 2_400_000 },
  { id: "sable-stone", type: "producer", name: "Sable Stone", city: "Atlanta", genre: "Trap", credits: 342, monthlyListeners: 3_100_000 },
  { id: "zeke-monroe", type: "producer", name: "Zeke Monroe", city: "Atlanta", genre: "Afro-Fusion / Trap", credits: 121, monthlyListeners: 1_100_000 },
  { id: "tomi-adebayo", type: "producer", name: "Tomi Adebayo", city: "London", genre: "Afrobeats", credits: 189, monthlyListeners: 2_700_000 },
  { id: "pip-lorrimer", type: "producer", name: "Pip Lorrimer", city: "London", genre: "Synth / Soul", credits: 97, monthlyListeners: 880_000 },
  { id: "lux-navarro", type: "producer", name: "Lux Navarro", city: "New York", genre: "Hip-Hop / Boom Bap", credits: 276, monthlyListeners: 2_200_000 },
  { id: "orla-finch", type: "producer", name: "Orla Finch", city: "New York", genre: "Indie / Electronic", credits: 133, monthlyListeners: 1_300_000 },
  { id: "dub-cathedral", type: "producer", name: "Dub Cathedral", city: "Chicago", genre: "House / Dub", credits: 158, monthlyListeners: 970_000 },
  { id: "reese-tanaka", type: "producer", name: "Reese Tanaka", city: "Chicago", genre: "Drill", credits: 204, monthlyListeners: 1_700_000 },
];

export const songs: Song[] = [
  { id: "neon-lullaby", type: "song", name: "Neon Lullaby", city: "Los Angeles", genre: "Alt R&B", releaseDate: "2026-01-23", streams: 412_000_000, durationSec: 214 },
  { id: "low-orbit", type: "song", name: "Low Orbit", city: "Los Angeles", genre: "Hip-Hop", releaseDate: "2026-06-20", streams: 268_000_000, durationSec: 187 },
  { id: "sundown-protocol", type: "song", name: "Sundown Protocol", city: "Los Angeles", genre: "Electronic R&B", releaseDate: "2026-02-14", streams: 190_000_000, durationSec: 233 },
  { id: "costa-electrica", type: "song", name: "Costa Eléctrica", city: "Los Angeles", genre: "Latin Pop", releaseDate: "2026-07-11", streams: 154_000_000, durationSec: 198 },
  { id: "concrete-halo", type: "song", name: "Concrete Halo", city: "Atlanta", genre: "Trap", releaseDate: "2026-04-18", streams: 521_000_000, durationSec: 176 },
  { id: "lagos-to-peachtree", type: "song", name: "Lagos to Peachtree", city: "Atlanta", genre: "Afro-Fusion", releaseDate: "2026-05-16", streams: 337_000_000, durationSec: 205 },
  { id: "fire-escape-summer", type: "song", name: "Fire Escape Summer", city: "New York", genre: "Indie Pop", releaseDate: "2026-06-06", streams: 144_000_000, durationSec: 192 },
  { id: "basement-gospel", type: "song", name: "Basement Gospel", city: "New York", genre: "Hip-Hop", releaseDate: "2026-09-12", streams: 98_000_000, durationSec: 221 },
  { id: "ironworks-blues", type: "song", name: "Ironworks Blues", city: "London", genre: "Neo-Soul", releaseDate: "2026-03-08", streams: 61_000_000, durationSec: 243 },
  { id: "lakeshore-4am", type: "song", name: "Lakeshore 4AM", city: "Chicago", genre: "House / Drill", releaseDate: "2026-06-13", streams: 176_000_000, durationSec: 209 },
];

export const labels: Label[] = [
  { id: "nightshift-records", type: "label", name: "Nightshift Records", city: "Los Angeles", genre: "Alt R&B / Hip-Hop", founded: 2009 },
  { id: "southpaw-audio", type: "label", name: "Southpaw Audio", city: "Atlanta", genre: "Trap / Afro-Fusion", founded: 2012 },
  { id: "brickhouse-sound", type: "label", name: "Brickhouse Sound", city: "New York", genre: "Hip-Hop / Indie", founded: 1998 },
  { id: "tidewater-music", type: "label", name: "Tidewater Music", city: "London", genre: "Afrobeats / Soul", founded: 2015 },
  { id: "lakefront-collective", type: "label", name: "Lakefront Collective", city: "Chicago", genre: "House / Drill / Rock", founded: 2017 },
];

export const venues: Venue[] = [
  { id: "the-parallax", type: "venue", name: "The Parallax", city: "Los Angeles", capacity: 3200, genre: "Multi-genre" },
  { id: "foxglove-hall", type: "venue", name: "Foxglove Hall", city: "Atlanta", capacity: 4500, genre: "Hip-Hop / Trap" },
  { id: "basement-9", type: "venue", name: "Basement 9", city: "New York", capacity: 900, genre: "Underground" },
  { id: "ironworks", type: "venue", name: "Ironworks", city: "London", capacity: 2400, genre: "Soul / Electronic" },
  { id: "the-wreck-room", type: "venue", name: "The Wreck Room", city: "Chicago", capacity: 1200, genre: "Rock / House" },
];
