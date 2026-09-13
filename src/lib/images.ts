import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";
import { supabase } from "./supabase";
import { isDemo } from "@/demo/mode";

export const BUCKET = "product-images";

/**
 * Phone cameras produce 4000px / 5 MB files. Jewellery detail reads
 * fine at 1400px, and the difference is the whole reason the catalogue
 * loads quickly on a patchy mobile connection -- and stays inside the
 * Supabase free tier.
 */
const MAX_EDGE = 1400;
const JPEG_QUALITY = 0.78;
const MAX_IMAGES_PER_PRODUCT = 8;

export type PickedImage = { uri: string; width: number; height: number };

/**
 * Let the owner pick several pieces at once.
 *
 * Deliberately no permission request first. Android's system photo
 * picker and iOS's PHPicker need no permission at all, and asking for
 * one would (a) force the app to declare READ_MEDIA_IMAGES, which Play
 * rejects for occasional-upload apps, and (b) on web, put an `await`
 * between the tap and the file dialog, which browsers may block.
 */
export async function pickImages(remainingSlots: number): Promise<PickedImage[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, Math.min(remainingSlots, MAX_IMAGES_PER_PRODUCT)),
    quality: 1, // compress ourselves, after resizing
    exif: false,
  });

  if (result.canceled) return [];
  return result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

/** Shoot a new photo straight into the product. */
export async function captureImage(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Camera access is off. Turn it on in Settings to photograph a piece.");
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 1,
    exif: false,
  });

  if (result.canceled) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

/** Resize the long edge down to MAX_EDGE and re-encode as JPEG. */
async function compress(image: PickedImage): Promise<string> {
  const longEdge = Math.max(image.width, image.height);
  const context = ImageManipulator.manipulate(image.uri);

  if (longEdge > MAX_EDGE) {
    context.resize(
      image.width >= image.height ? { width: MAX_EDGE } : { height: MAX_EDGE },
    );
  }

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });
  return saved.uri;
}

function newObjectPath(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${yyyy}/${mm}/${unique}.jpg`;
}

/**
 * Compress, upload, and hand back the public URL.
 *
 * `fetch(uri).arrayBuffer()` is the one path that works identically for
 * a native `file://` URI and a web `blob:` URI, which is what lets the
 * owner upload from the phone app or the browser with the same code.
 */
export async function uploadImage(
  image: PickedImage,
  onProgress?: (stage: "compressing" | "uploading") => void,
): Promise<string> {
  onProgress?.("compressing");
  const compressedUri = await compress(image);

  // The demo has nowhere to upload to; the compressed photo on this device
  // stands in for the stored copy until the app reloads.
  if (isDemo) return compressedUri;

  onProgress?.("uploading");
  const response = await fetch(compressedUri);
  const bytes = await response.arrayBuffer();

  if (bytes.byteLength === 0) {
    throw new Error("That photo could not be read. Please pick it again.");
  }

  const path = newObjectPath();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
    cacheControl: "31536000", // catalogue images never change in place
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadImages(
  images: PickedImage[],
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < images.length; i++) {
    urls.push(await uploadImage(images[i]));
    onProgress?.(i + 1, images.length);
  }
  return urls;
}

/**
 * Remove a file from storage given its public URL.
 * Failure is swallowed: an orphaned file is a rounding error on the
 * storage quota, and blocking a product edit on it would be worse.
 */
export async function deleteImageByUrl(publicUrl: string): Promise<void> {
  const marker = `/${BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return;

  const path = publicUrl.slice(index + marker.length).split("?")[0];
  try {
    await supabase.storage.from(BUCKET).remove([decodeURIComponent(path)]);
  } catch {
    // ignore
  }
}

export { MAX_IMAGES_PER_PRODUCT };

/** Web file inputs give us a File; wrap it so the same pipeline applies. */
export async function imageFromWebFile(file: File): Promise<PickedImage> {
  if (Platform.OS !== "web") throw new Error("Web only.");
  const uri = URL.createObjectURL(file);
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("That file is not a readable image."));
    img.src = uri;
  });
  return { uri, ...size };
}
