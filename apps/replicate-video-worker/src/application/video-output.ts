export function findVideoOutputUrl(output: unknown): string {
  const urls = flatten(output).filter((item): item is string => typeof item === "string");
  const videoUrl = urls.find((url) => /^https?:\/\//.test(url) && /\.(mp4|mov|webm)(\?|$)/i.test(url));

  if (videoUrl) {
    return videoUrl;
  }

  const firstUrl = urls.find((url) => /^https?:\/\//.test(url));

  if (!firstUrl) {
    throw new Error("Replicate prediction succeeded without a downloadable video URL");
  }

  return firstUrl;
}

function flatten(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap(flatten);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(flatten);
  }

  return [value];
}

