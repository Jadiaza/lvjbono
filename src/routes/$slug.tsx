import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RafflePublicPage } from "./index";
import { getPublicCampaignKind } from "@/lib/bono-public.functions";
import { DualBonoPublicPage } from "@/components/dual-bono-public-page";

export const Route = createFileRoute("/$slug")({
  component: PublicRaffleBySlug,
});

function PublicRaffleBySlug() {
  const { slug } = Route.useParams();
  const getCampaignKind = useServerFn(getPublicCampaignKind);
  const { data, isLoading } = useQuery({
    queryKey: ["public-campaign-kind", slug],
    queryFn: () => getCampaignKind({ data: { slug } }),
  });

  if (isLoading) return <main className="p-10 text-center">Cargando campaña…</main>;
  if (data?.mode === "dual_bono" && data.raffle) {
    return <DualBonoPublicPage raffle={data.raffle} sellers={data.sellers ?? []} />;
  }
  return <RafflePublicPage slug={slug} />;
}
