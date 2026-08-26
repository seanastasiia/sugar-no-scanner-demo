import { uploadScanCrops, type UploadScanCrop } from "./upload-scan";

export interface PreparedUploadFrame {
  crop: UploadScanCrop;
  imageDataUrl: string;
}

function imageCropToDataUrl(image: HTMLImageElement, crop: UploadScanCrop): string {
  const sourceWidth = image.naturalWidth * crop.width;
  const sourceHeight = image.naturalHeight * crop.height;
  let scale = Math.min(1, 1280 / Math.max(sourceWidth, sourceHeight));
  let dataUrl = "";
  do {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image canvas is unavailable");
    context.drawImage(
      image,
      image.naturalWidth * crop.x,
      image.naturalHeight * crop.y,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
    dataUrl = canvas.toDataURL("image/jpeg", 0.78);
    scale *= 0.8;
  } while (dataUrl.length > 2_650_000 && scale > 0.25);
  if (dataUrl.length > 2_650_000) throw new Error("Image remains too large after resizing");
  return dataUrl;
}

export async function imageFileToScanFrames(file: File): Promise<PreparedUploadFrame[]> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = document.createElement("img");
    image.decoding = "async";
    image.src = sourceUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image could not be decoded"));
    });

    return uploadScanCrops(image.naturalWidth, image.naturalHeight).map((crop) => ({
      crop,
      imageDataUrl: imageCropToDataUrl(image, crop)
    }));
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
