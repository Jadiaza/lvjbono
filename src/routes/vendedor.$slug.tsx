/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicResponsiblePage } from "@/lib/bono.functions";
import { padBonoNumber } from "@/lib/bono-domain";

export const Route = createFileRoute("/vendedor/$slug")({ component: SellerPage });
function SellerPage() {
  const { slug } = Route.useParams(),
    get = useServerFn(getPublicResponsiblePage);
  const { data, error } = useQuery({
    queryKey: ["seller", slug],
    queryFn: () => get({ data: { slug } }),
    retry: false,
  });
  if (error) return <main className="p-10 text-center">Página no disponible.</main>;
  if (!data) return <main className="p-10 text-center">Cargando…</main>;
  return (
    <main className="mx-auto min-h-screen max-w-5xl p-5">
      <h1 className="font-display text-3xl text-gold">{data.responsible.display_name}</h1>
      <p className="mb-5 text-muted-foreground">
        Bonos asignados. Los vendidos aparecen bloqueados.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.bonos.map((b: any) => {
          const nums = (b.raffle_bono_numbers ?? [])
            .sort((a: any, c: any) => a.option_number - c.option_number)
            .map((n: any) => padBonoNumber(n.numero));
          const available = ["asignado", "disponible", "devuelto"].includes(b.status);
          const message = encodeURIComponent(
            `Hola, quiero consultar el Bono ${padBonoNumber(b.serial)} (${nums.join(" / ")})`,
          );
          return (
            <article
              key={b.id}
              className={`rounded-xl border p-4 ${available ? "bg-card" : "bg-secondary opacity-70"}`}
            >
              <div className="flex justify-between">
                <strong>Bono {padBonoNumber(b.serial)}</strong>
                <span className="text-xs uppercase">{b.status}</span>
              </div>
              <div className="my-3 text-2xl font-black text-red-700">{nums.join(" / ")}</div>
              {available && data.responsible.phone && (
                <a
                  className="text-sm text-gold underline"
                  href={`https://wa.me/${data.responsible.phone.replace(/\D/g, "")}?text=${message}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Consultar este bono
                </a>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
