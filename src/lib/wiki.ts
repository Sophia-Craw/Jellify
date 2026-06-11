export interface WikiSummary {
  title: string;
  extract: string;
  thumbnail?: { source: string; width: number; height: number };
  content_urls?: { desktop: { page: string } };
}

async function fetchSummary(title: string): Promise<WikiSummary | null> {
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data.type === "disambiguation") return null;
  return {
    title: data.title,
    extract: data.extract || "",
    thumbnail: data.thumbnail,
    content_urls: data.content_urls,
  };
}

async function searchWiki(term: string): Promise<string | null> {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&format=json&origin=*&srlimit=3`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data.query?.search as { title: string }[] | undefined;
  if (!pages?.length) return null;
  return pages[0].title;
}

export async function fetchArtistBio(artistName: string): Promise<WikiSummary | null> {
  let result = await fetchSummary(artistName);
  if (result) return result;

  result = await fetchSummary(`${artistName} (musician)`);
  if (result) return result;

  const searchTitle = await searchWiki(`${artistName} musician`);
  if (searchTitle && searchTitle !== artistName) {
    result = await fetchSummary(searchTitle);
    if (result) return result;
  }

  return null;
}
