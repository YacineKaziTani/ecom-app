// Uploads are stored on Cloudinary at up to 1200×1200. Cloudinary can serve a
// resized copy in the best format the browser supports (WebP/AVIF) on the fly
// when a transformation is added to the URL — much smaller downloads for
// thumbnails and product grids. Non-Cloudinary URLs are returned unchanged.
const UPLOAD_SEGMENT = "/image/upload/";

export function optimizedImage(
  url: string | null | undefined,
  width: number,
): string | undefined {
  if (!url) return undefined;
  if (!url.includes("res.cloudinary.com") || !url.includes(UPLOAD_SEGMENT)) {
    return url;
  }
  return url.replace(
    UPLOAD_SEGMENT,
    `${UPLOAD_SEGMENT}f_auto,q_auto,c_limit,w_${width}/`,
  );
}
