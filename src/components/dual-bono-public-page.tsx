import { Link } from "@tanstack/react-router";
import { Calendar, Gift, TicketCheck, Users } from "lucide-react";
import { formatCOP, formatDate } from "@/lib/format";

type DualBonoPublicPageProps = {
  raffle: any;
  sellers: Array<{ id: string; display_name: string; slug: string; phone?: string | null }>;
};

export function DualBonoPublicPage({ raffle, sellers }: DualBonoPublicPageProps) {
  const accent = raffle.bono_accent_color || "#B8860B";
  return (
    <main className="min-h-screen bg-[#fffaf0] text-slate-950">
      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[1.05fr_.95fr] lg:py-16">
        <div>
          <div
            className="inline-flex rounded-full px-4 py-2 text-xs font-black uppercase tracking-[.2em]"
            style={{ background: `${accent}20`, color: accent }}
          >
            Bono en duplas
          </div>
          <h1 className="mt-5 text-4xl font-black leading-tight sm:text-6xl">
            {raffle.bono_subtitle || raffle.nombre}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
            Cada bono participa con dos números de tres cifras. Los bonos se distribuyen por lotes a responsables autorizados.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Info icon={<TicketCheck className="h-5 w-5" />} label="Valor" value={formatCOP(raffle.valor_boleta)} />
            <Info icon={<Calendar className="h-5 w-5" />} label="Sorteo" value={raffle.fecha_sorteo ? formatDate(raffle.fecha_sorteo) : "Por definir"} />
            <Info icon={<Gift className="h-5 w-5" />} label="Premio" value={raffle.bono_prize_name || "Premio especial"} />
          </div>

          {raffle.bono_prize_description && (
            <p className="mt-6 max-w-2xl text-base text-slate-600">{raffle.bono_prize_description}</p>
          )}
          {raffle.bono_prize_dimensions && (
            <p className="mt-2 font-semibold">Características: {raffle.bono_prize_dimensions}</p>
          )}
          {raffle.loteria && <p className="mt-2 text-sm text-slate-500">Juega con {raffle.loteria}.</p>}
        </div>

        <div className="rounded-[32px] border bg-white p-5 shadow-sm" style={{ borderColor: `${accent}55` }}>
          {raffle.bono_prize_image_url ? (
            <img
              src={raffle.bono_prize_image_url}
              alt={raffle.bono_prize_name || "Premio"}
              className="h-[360px] w-full rounded-3xl object-contain"
            />
          ) : (
            <div className="grid h-[360px] place-items-center rounded-3xl bg-slate-100 text-slate-400">
              Imagen del premio
            </div>
          )}
        </div>
      </section>

      <section className="border-t bg-white">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6" style={{ color: accent }} />
            <div>
              <h2 className="text-2xl font-black">Elige un responsable</h2>
              <p className="text-sm text-slate-500">Consulta los cartones y duplas disponibles de cada lote.</p>
            </div>
          </div>

          {sellers.length ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sellers.map((seller) => (
                <Link
                  key={seller.id}
                  to="/vendedor/$slug"
                  params={{ slug: seller.slug }}
                  className="rounded-2xl border bg-[#fffaf0] p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                  style={{ borderColor: `${accent}55` }}
                >
                  <strong className="text-lg">{seller.display_name}</strong>
                  <p className="mt-2 text-sm text-slate-500">Ver bonos y números disponibles</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed p-8 text-center text-slate-500">
              Los lotes aún no han sido publicados por sus responsables.
            </p>
          )}
        </div>
      </section>

      <footer className="px-5 py-6 text-center font-semibold text-white" style={{ background: accent }}>
        {raffle.bono_footer_text || "¡Gracias por apoyar nuestra misión!"}
      </footer>
    </main>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      </div>
      <strong className="mt-2 block text-lg">{value}</strong>
    </div>
  );
}
