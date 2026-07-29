export function normalizePublicRaffleSlug(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function getPublicRaffleSlug(raffle: {
  id: string;
  slug?: string | null;
  serie?: string | null;
}): string {
  return raffle.slug?.trim().toLowerCase() || normalizePublicRaffleSlug(raffle.serie) || raffle.id;
}
