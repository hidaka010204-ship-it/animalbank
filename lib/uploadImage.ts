import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Upload an image URI to Supabase Storage.
 * On web: uses fetch → Blob (FileSystem is not available on web).
 * On native: uses ImageManipulator (JPEG compress) → FileSystem Base64 → Uint8Array.
 */
export async function uploadImageToStorage(
  uri: string,
  bucket: string,
  path: string,
): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      if (!response.ok) {
        console.warn(`[uploadImageToStorage] fetch failed: ${response.status}`);
        return null;
      }
      const blob = await response.blob();
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (error || !data) {
        console.warn(`[uploadImageToStorage] web upload error:`, error?.message);
        return null;
      }
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
      return publicUrl || null;
    } else {
      // Native path: JPEG compress then read as Base64
      const ImageManipulator = require('expo-image-manipulator');
      const FileSystem = require('expo-file-system/legacy');
      const converted = await ImageManipulator.manipulateAsync(
        uri,
        [],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      const base64: string = await FileSystem.readAsStringAsync(converted.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!base64) return null;
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let j = 0; j < binaryStr.length; j++) {
        bytes[j] = binaryStr.charCodeAt(j);
      }
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (error || !data) {
        console.warn(`[uploadImageToStorage] native upload error:`, error?.message);
        return null;
      }
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
      return publicUrl || null;
    }
  } catch (e) {
    console.warn(`[uploadImageToStorage] exception:`, e);
    return null;
  }
}
