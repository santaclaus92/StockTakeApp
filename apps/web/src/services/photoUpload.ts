import { getSupabaseAuthClient } from "./supabaseAuth";

const BUCKET = "item-photos";
const MAX_BYTES = 200 * 1024; // 200 KB

/** Resize + compress a photo File to ≤200 KB and return a JPEG Blob. */
async function compressPhoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }

      const originalWidth = img.naturalWidth;
      const originalHeight = img.naturalHeight;

      // Each attempt: [dimensionScale, jpegQuality]
      const attempts: [number, number][] = [
        [1.0, 0.85],
        [1.0, 0.70],
        [0.75, 0.80],
        [0.75, 0.65],
        [0.50, 0.75],
        [0.50, 0.60],
        [0.35, 0.65],
        [0.25, 0.60],
      ];

      const tryCompress = (scale: number, quality: number): Blob => {
        canvas.width = Math.max(1, Math.round(originalWidth * scale));
        canvas.height = Math.max(1, Math.round(originalHeight * scale));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64 = dataUrl.split(",")[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: "image/jpeg" });
      };

      for (const [scale, quality] of attempts) {
        const blob = tryCompress(scale, quality);
        if (blob.size <= MAX_BYTES) {
          resolve(blob);
          return;
        }
      }

      // Last resort — still return it even if slightly over
      resolve(tryCompress(0.25, 0.60));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = objectUrl;
  });
}

/**
 * Compress a photo File to ≤200 KB, upload it to Supabase Storage bucket
 * `item-photos`, and return the public URL.
 */
export async function uploadPhoto(file: File): Promise<string> {
  const supabase = getSupabaseAuthClient();
  if (!supabase) throw new Error("Supabase client not available — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");

  const blob = await compressPhoto(file);
  const path = `photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false
  });

  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
