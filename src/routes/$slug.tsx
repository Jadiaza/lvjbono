import { createFileRoute } from "@tanstack/react-router";
import { RafflePublicPage } from "./index";

export const Route = createFileRoute("/$slug")({
  component: PublicRaffleBySlug,
});

function PublicRaffleBySlug() {
  const { slug } = Route.useParams();
  return <RafflePublicPage slug={slug} />;
}
