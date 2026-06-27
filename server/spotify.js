// spotify.js — fetch Spotify track/playlist/album metadata WITHOUT API keys.
// Works by reading Spotify's public embed page, which contains a JSON blob
// (__NEXT_DATA__) with the entity name, cover art, and full track list.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Parse a Spotify URL (or URI) into { type, id }. */
export function parseSpotifyUrl(input) {
  if (!input) return null;
  const str = String(input).trim();

  // spotify:track:ID  /  spotify:playlist:ID
  const uri = str.match(/spotify:(track|playlist|album):([A-Za-z0-9]+)/i);
  if (uri) return { type: uri[1].toLowerCase(), id: uri[2] };

  // https://open.spotify.com/track/ID  (optionally /intl-xx/ prefix, ?query)
  const url = str.match(
    /open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|playlist|album)\/([A-Za-z0-9]+)/i
  );
  if (url) return { type: url[1].toLowerCase(), id: url[2] };

  return null;
}

export function isSpotifyUrl(input) {
  return /open\.spotify\.com|spotify:(track|playlist|album):/i.test(String(input || ''));
}

// Handles both shapes Spotify uses:
//   coverArt.sources = [{ url, width, height }]
//   visualIdentity.image = [{ url, maxWidth, maxHeight }]
function pickCover(obj) {
  const list = obj?.sources || obj?.image || (Array.isArray(obj) ? obj : null);
  if (!list || !list.length) return null;
  const w = (s) => s.width || s.maxWidth || 0;
  return list.reduce((a, b) => (w(b) > w(a) ? b : a)).url;
}

function trackFromListItem(item) {
  // subtitle holds the artist(s), e.g. "Coldplay"
  return {
    title: item.title || '',
    artist: item.subtitle || '',
    duration: item.duration ? Math.round(item.duration / 1000) : 0,
    uri: item.uri || '',
    cover: pickCover(item.coverArt) || null,
  };
}

/**
 * Returns a normalized object:
 * {
 *   type: 'track' | 'playlist' | 'album',
 *   name: string,
 *   cover: string | null,
 *   tracks: [{ title, artist, duration, cover }]
 * }
 */
export async function getSpotifyData(input) {
  const parsed = parseSpotifyUrl(input);
  if (!parsed) throw new Error('Not a valid Spotify link.');

  const embedUrl = `https://open.spotify.com/embed/${parsed.type}/${parsed.id}`;
  const res = await fetch(embedUrl, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`Spotify returned HTTP ${res.status}. The link may be private or invalid.`);
  const html = await res.text();

  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Could not read Spotify data (page format changed or link is private).');

  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    throw new Error('Failed to parse Spotify data.');
  }

  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('No Spotify content found at that link.');

  const cover =
    pickCover(entity.coverArt) || pickCover(entity.visualIdentity?.image) || null;

  if (parsed.type === 'track') {
    const artist =
      entity.subtitle ||
      (entity.artists || []).map((a) => a.name).filter(Boolean).join(', ') ||
      '';
    return {
      type: 'track',
      name: entity.title || entity.name || 'Unknown track',
      cover,
      tracks: [
        {
          title: entity.title || entity.name || '',
          artist,
          duration: entity.duration ? Math.round(entity.duration / 1000) : 0,
          cover,
        },
      ],
    };
  }

  // playlist or album
  const list = entity.trackList || [];
  const tracks = list.map(trackFromListItem);
  if (!tracks.length) throw new Error('This playlist/album appears to be empty or private.');

  return {
    type: parsed.type,
    name: entity.name || entity.title || 'Unknown',
    cover,
    tracks,
  };
}
