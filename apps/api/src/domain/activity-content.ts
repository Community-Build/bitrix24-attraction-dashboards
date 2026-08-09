const ACTIVITY_SUBJECT_LIMIT = 500;
const ACTIVITY_DESCRIPTION_LIMIT = 4_000;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function cleanActivityText(value: string | null | undefined, limit: number) {
  if (!value) return null;
  const cleaned = decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

  return cleaned ? cleaned.slice(0, limit) : null;
}

export function sanitizeActivitySubject(value: string | null | undefined) {
  return cleanActivityText(value, ACTIVITY_SUBJECT_LIMIT);
}

export function sanitizeActivityDescription(value: string | null | undefined) {
  return cleanActivityText(value, ACTIVITY_DESCRIPTION_LIMIT);
}
