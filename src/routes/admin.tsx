import { createFileRoute, useNavigate, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminSelfBootstrap, adminListRaffles } from "@/lib/raffle.functions";
import { toast } from "sonner";
import { LogOut, Ticket as TicketIcon, Settings, Trophy, Layers } from "lucide-react";
import { useSelectedRaffle } from "@/hooks/use-selected-raffle";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · Rifa" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const bootstrap = useServerFn(adminSelfBootstrap);
  const listRaffles = useServerFn(adminListRaffles);
  const { id: selectedId, select } = useSelectedRaffle();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      try {
        const r = await bootstrap();
        if (!r.granted) {
          toast.error("Tu usuario no tiene permisos de administrador.");
          await supabase.auth.signOut();
          navigate({ to: "/auth", replace: true });
          return;
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
        await supabase.auth.signOut();
        navigate({ to: "/auth", replace: true });
        return;
      }
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [navigate, bootstrap]);

  const { data: rafflesData } = useQuery({
    queryKey: ["admin-raffles"],
    queryFn: () => listRaffles(),
    enabled: ready,
  });
  const raffles = rafflesData?.raffles ?? [];

  // Ensure a raffle is always selected when available
  useEffect(() => {
    if (!raffles.length) return;
    if (!selectedId || !raffles.find((r) => r.id === selectedId)) {
      const active = raffles.find((r) => r.activa) ?? raffles[0];
      select(active.id);
    }
  }, [raffles, selectedId, select]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!ready)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Verificando acceso…
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/admin" className="font-display text-xl text-gold shrink-0">
              Admin · Rifa
            </Link>
            <nav className="hidden sm:flex gap-1 text-sm">
              <Link
                to="/admin"
                activeOptions={{ exact: true }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-secondary"
                activeProps={{ className: "bg-secondary text-gold" }}
              >
                <TicketIcon className="h-4 w-4" />
                Boletas
              </Link>
              <Link
                to="/admin/rifa"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-secondary"
                activeProps={{ className: "bg-secondary text-gold" }}
              >
                <Layers className="h-4 w-4" />
                Cartones
              </Link>
              <Link
                to="/admin/sorteo"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-secondary"
                activeProps={{ className: "bg-secondary text-gold" }}
              >
                <Trophy className="h-4 w-4" />
                Sorteo
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {raffles.length > 0 && (
              <select
                value={selectedId ?? ""}
                onChange={(e) => select(e.target.value || null)}
                className="max-w-[220px] truncate rounded-md border border-border bg-secondary px-2 py-1.5 text-xs"
                title="Cartón activo"
              >
                {raffles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.activa ? "● " : "○ "}
                    {r.serie ? `[${r.serie}] ` : ""}
                    {r.nombre}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={signOut}
              className="text-sm text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
            >
              <LogOut className="h-4 w-4" /> <Settings className="hidden" /> Salir
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
