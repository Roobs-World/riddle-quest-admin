const ACCEPTED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 512 * 1024;
const AVATAR_SIZE = 256;

export const validateAvatarFile = (file: Pick<File, "size" | "type">) => {
  if (!ACCEPTED_AVATAR_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_SOURCE_BYTES) {
    throw new Error("invalid-avatar-file");
  }
};

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("avatar-encoding-failed")),
      "image/webp",
      0.82,
    );
  });

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("avatar-read-failed"));
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("avatar-read-failed"));
    reader.readAsDataURL(blob);
  });

export async function prepareAvatarImage(file: File): Promise<string> {
  validateAvatarFile(file);
  const bitmap = await createImageBitmap(file);
  try {
    const cropSize = Math.min(bitmap.width, bitmap.height);
    const sourceX = (bitmap.width - cropSize) / 2;
    const sourceY = (bitmap.height - cropSize) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("avatar-canvas-unavailable");
    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      cropSize,
      cropSize,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
    const blob = await canvasToBlob(canvas);
    if (blob.size > MAX_OUTPUT_BYTES) throw new Error("avatar-output-too-large");
    return blobToDataUrl(blob);
  } finally {
    bitmap.close();
  }
}
