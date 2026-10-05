/** Defines the accepted avatar types value. */
const ACCEPTED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Defines the max source bytes value. */
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
/** Defines the max output bytes value. */
const MAX_OUTPUT_BYTES = 512 * 1024;
/** Defines the avatar size value. */
const AVATAR_SIZE = 256;

/** Validates avatar file. */
export const validateAvatarFile = (file: Pick<File, "size" | "type">) => {
  if (!ACCEPTED_AVATAR_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_SOURCE_BYTES) {
    throw new Error("invalid-avatar-file");
  }
};

/** Provides canvas to blob behavior. */
const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("avatar-encoding-failed"))), "image/webp", 0.82);
  });

/** Provides blob to data url behavior. */
const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    /** Reads er. */
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("avatar-read-failed"));
    reader.onload = () =>
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("avatar-read-failed"));
    reader.readAsDataURL(blob);
  });

/** Stops subsequent image stages after their account visit or selection is retired. */
const checkAvatarPreparation = (signal?: AbortSignal) => {
  if (signal?.aborted) throw Object.assign(new Error("avatar-preparation-retired"), {name: "AbortError"});
};

/** Crops and encodes an avatar, skipping remaining stages when its owner retires. */
export async function prepareAvatarImage(file: File, signal?: AbortSignal): Promise<string> {
  validateAvatarFile(file);
  checkAvatarPreparation(signal);
  /** Provides bitmap behavior. */
  const bitmap = await createImageBitmap(file);
  try {
    checkAvatarPreparation(signal);
    /** Provides crop size behavior. */
    const cropSize = Math.min(bitmap.width, bitmap.height);
    /** Provides source x behavior. */
    const sourceX = (bitmap.width - cropSize) / 2;
    /** Provides source y behavior. */
    const sourceY = (bitmap.height - cropSize) / 2;
    /** Provides canvas behavior. */
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    /** Provides context behavior. */
    const context = canvas.getContext("2d");
    if (!context) throw new Error("avatar-canvas-unavailable");
    context.drawImage(bitmap, sourceX, sourceY, cropSize, cropSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    /** Provides blob behavior. */
    const blob = await canvasToBlob(canvas);
    checkAvatarPreparation(signal);
    if (blob.size > MAX_OUTPUT_BYTES) throw new Error("avatar-output-too-large");
    return blobToDataUrl(blob);
  } finally {
    bitmap.close();
  }
}
