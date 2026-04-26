const GSI_API = 'https://msearch.gsi.go.jp/address-search/AddressSearch';

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `${GSI_API}?q=${encodeURIComponent(address)}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    // レスポンスは GeoJSON Feature の配列。coordinates は [lng, lat] 順
    if (!Array.isArray(data) || data.length === 0) return null;

    const coords = data[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;

    return { lat: coords[1], lng: coords[0] };
  } catch {
    return null;
  }
}
