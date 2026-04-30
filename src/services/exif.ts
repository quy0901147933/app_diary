import * as MediaLibrary from 'expo-media-library';
import * as Location from 'expo-location';
import type { ExifData } from '@/types';

export async function readExifFromAssetId(assetId: string): Promise<ExifData> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(assetId);
    const exif = (info.exif ?? {}) as Record<string, unknown>;

    const takenAtRaw = (exif['DateTimeOriginal'] as string | undefined) ?? info.creationTime;
    const takenAt =
      typeof takenAtRaw === 'string'
        ? takenAtRaw
        : typeof takenAtRaw === 'number'
          ? new Date(takenAtRaw).toISOString()
          : undefined;

    let latitude = info.location?.latitude ?? (exif['GPSLatitude'] as number | undefined);
    let longitude = info.location?.longitude ?? (exif['GPSLongitude'] as number | undefined);

    if (latitude == null || longitude == null) {
      const coords = await tryDeviceLocation();
      if (coords) {
        latitude = coords.latitude;
        longitude = coords.longitude;
      }
    }

    let city: string | undefined;
    let country: string | undefined;
    let locationText: string | undefined;
    if (latitude != null && longitude != null) {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
      const p = places[0];
      city = p?.city ?? p?.subregion ?? p?.region ?? undefined;
      country = p?.country ?? undefined;
      const parts = [city, country].filter(Boolean) as string[];
      locationText = parts.length ? parts.join(', ') : undefined;
    }

    return { takenAt, latitude, longitude, locationText, city, country, raw: exif };
  } catch {
    return {};
  }
}

async function tryDeviceLocation() {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) return null;
      perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return null;
    }
    const last = await Location.getLastKnownPositionAsync();
    if (last) return last.coords;
    const cur = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }).catch(() => null);
    return cur?.coords ?? null;
  } catch {
    return null;
  }
}

export function locationHashtagsFromExif(exif: ExifData): string[] {
  const tags: string[] = [];
  if (exif.city) tags.push(`#${toTag(exif.city)}`);
  if (exif.country) tags.push(`#${toTag(exif.country)}`);
  return tags;
}

export function formatHashtagFromExif(exif: ExifData): string[] {
  const tags = locationHashtagsFromExif(exif);
  if (exif.takenAt) {
    const d = new Date(exif.takenAt);
    if (!Number.isNaN(d.valueOf())) {
      const hour = d.getHours().toString().padStart(2, '0');
      const min = d.getMinutes().toString().padStart(2, '0');
      tags.push(`#${hour}:${min}`);
    }
  }
  return tags;
}

function toTag(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w[0] ?? '').toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}
