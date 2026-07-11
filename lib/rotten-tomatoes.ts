interface OmdbResponse {
  Ratings?: Array<{
    Source: string;
    Value: string;
  }>;
}

const OMDB_BASE_URL = "https://www.omdbapi.com/";
const ROTTEN_TOMATOES_SOURCE = "Rotten Tomatoes";
const IMDB_ID_PATTERN = /^tt\d+$/;
const SCORE_PATTERN = /^(100|\d{1,2})%$/;
const OMDB_TIMEOUT_MS = 3000;

export async function getRottenTomatoesScore(
  imdbId: string | null | undefined,
): Promise<number | null> {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey || !imdbId || !IMDB_ID_PATTERN.test(imdbId)) return null;

  const url = new URL(OMDB_BASE_URL);
  url.search = new URLSearchParams({ apikey: apiKey, i: imdbId }).toString();

  try {
    const response = await fetch(url, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(OMDB_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as OmdbResponse;
    const value = data.Ratings?.find(
      ({ Source }) => Source === ROTTEN_TOMATOES_SOURCE,
    )?.Value;
    const match = value?.match(SCORE_PATTERN);

    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}
