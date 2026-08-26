/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicBonoByCode } from "@/lib/bono.functions";
import { BonoDualCard } from "@/components/bono-dual-card";

export const Route = createFileRoute("/bono/$codigo")({ component: PublicBono });
function PublicBono() {
  const { codigo } = Route.useParams(),
    get = useServerFn(getPublicBonoByCode);
  const { data, error } = useQuery({
    queryKey: ["public-bono", codigo],
    queryFn: () => get({ data: { code: codigo } }),
    retry: false,
  });
  if (error) return <main className="p-10 text-center">Bono no encontrado.</main>;
  if (!data) return <main className="p-10 text-center">Verificando bono…</main>;
  const b: any = data.bono;
  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <BonoDualCard
          bono={{
            ...b,
            numbers: (b.raffle_bono_numbers ?? [])
              .sort((a: any, c: any) => a.option_number - c.option_number)
              .map((n: any) => n.numero),
            raffle: b.raffles,
          }}
        />
        <div className="mx-auto mt-4 max-w-xl rounded-lg border bg-white p-4 text-center text-sm">
          <strong>Estado verificado:</strong> <span className="uppercase">{b.status}</span>
          <p className="mt-1 text-slate-500">
            Esta consulta no muestra datos privados del comprador.
          </p>
        </div>
      </div>
    </main>
  );
}
