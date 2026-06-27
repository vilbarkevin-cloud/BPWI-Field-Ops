export function sanitizePayload(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sanitizePayload);
  if (obj && typeof obj === "object" && !(obj instanceof Date)) {
    const cleaned: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v != null && v !== "") {
        cleaned[k] = sanitizePayload(v);
      }
    }
    return cleaned;
  }
  return obj;
}
