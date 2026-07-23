function withProtocol(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function getSiteUrl(): string {
  const explicit = import.meta.env.VITE_SITE_URL as string | undefined;
  const preview = import.meta.env.VITE_VERCEL_URL as string | undefined;
  const browserOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
  const value = explicit || preview || browserOrigin;
  return value ? withProtocol(value).replace(/\/+$/, "") : "";
}
