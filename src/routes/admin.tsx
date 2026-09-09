import {
  createFileRoute,
  useNavigate,
  useRouterState,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminSelfBootstrap, adminListRaffles } from "@/lib/raffle.functions";
import { toast } from "sonner";
import {
  BellRing,
  HandHeart,
  LogOut,
  Ticket as TicketIcon,
  Settings,
  Trophy,
  Layers,
  CalendarClock,
  CreditCard,
  ContactRound,
  PackageCheck,
  Tickets,
} from "lucide-react";
import { useSelectedRaffle } from "@/hooks/use-selected-raffle";
import { getPublicSkinDefinition } from "@/lib/public-skins";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Rifaya · Administración" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
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
  const access = rafflesData?.access;
  const isPlatformAdmin = access?.role === "admin";
  const selectedRaffle =
    raffles.find((raffle) => raffle.id === selectedId) ??
    raffles.find((raffle) => raffle.activa) ??
    raffles[0];
  const adminSkin = selectedRaffle?.public_skin ?? "purpura-real";
  const isDualBono =
    (selectedRaffle as (typeof selectedRaffle & { raffle_mode?: string }) | undefined)
      ?.raffle_mode === "dual_bono";

  useEffect(() => {
    document.documentElement.dataset.adminSkin = adminSkin;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", getPublicSkinDefinition(adminSkin).colors[0]);
    return () => {
      delete document.documentElement.dataset.adminSkin;
    };
  }, [adminSkin]);

  // Ensure a raffle is always selected when available
  useEffect(() => {
    if (!raffles.length) return;
    if (!selectedId || !raffles.find((r) => r.id === selectedId)) {
      const active = raffles.find((r) => r.activa) ?? raffles[0];
      select(active.id);
    }
  }, [raffles, selectedId, select]);

  // The legacy /admin page reads from tickets. Dual-bono campaigns live in raffle_bonos,
  // so route the Boletas view to the dedicated dual-bono admin screen instead of showing 0.
  useEffect(() => {
    if (!selectedRaffle || pathname !== "/admin") return;
    if (isDualBono) {
      navigate({
        to: "/admin/bonos/$raffleId",
        params: { raffleId: selectedRaffle.id },
        replace: true,
      });
    }
  }, [isDualBono, navigate, pathname, selectedRaffle]);

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

  const boletasLink =
    isDualBono && selectedRaffle ? (
      <Link
        to="/admin/bonos/$raffleId"
        params={{ raffleId: selectedRaffle.id }}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-secondary"
        activeProps={{ className: "bg-secondary text-gold" }}
      >
        <TicketIcon className="h-4 w-4" />
        Boletas
      </Link>
    ) : (
      <Link
        to="/admin"
        activeOptions={{ exact: true }}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-secondary"
        activeProps={{ className: "bg-secondary text-gold" }}
      >
        <TicketIcon className="h-4 w-4" />
        Boletas
      </Link>
    );

  return (
    <div className="admin-ecosystem min-h-screen bg-background" data-public-skin={adminSkin}>
      <header className="admin-header border-b border-border bg-card">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <Link to="/admin" className="font-display text-xl text-gold shrink-0">
              Rifaya · Administración
            </Link>
            <nav className="order-2 hidden basis-full flex-wrap gap-1 border-t border-border/60 pt-2 text-sm sm:flex">
              {boletasLink}
              {!isPlatformAdmin && (
                <Link
                  to="/admin/pagos"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-secondary"
                  activeProps={{ className: "bg-secondary text-gold" }}
                >
                  <CreditCard className="h-4 w-4" />
                  Mis pagos
                </Link>
              )}
              {isPlatformAdmin && (
                <Link
                  to="/admin/rifa"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-secondary"
                  activeProps={{ className: "bg-secondary text-gold" }}
                >
                  <Layers className="h-4 w-4" />
                  Cartones
                </Link>
              )}
              {isPlatformAdmin && (
                <Link
                  to="/admin/bonos"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-secondary"
                  activeProps={{ className: "bg-secondary text-gold" }}
                >
                  <Tickets className="h-4 w-4" /> Bonos
                </Link>
              )}
              {isPlatformAdmin && (
                <Link
                  to="/admin/responsables"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-secondary"
                  activeProps={{ className: "bg-secondary text-gold" }}
                >
                  <ContactRound className="h-4 w-4" /> Responsables
                </Link>
              )}
              {isPlatformAdmin && (
                <Link
                  to="/admin/distribucion"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-secondary"
                  activeProps={{ className: "bg-secondary text-gold" }}
                >
                  <PackageCheck className="h-4 w-4" /> Distribución
                </Link>
              )}
              {isPlatformAdmin && (
                <Link
                  to="/admin/sorteo"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-secondary"
                  activeProps={{ className: "bg-secondary text-gold" }}
                >
                  <Trophy className="h-4 w-4" />
                  Sorteo
                </Link>
              )}
              {isPlatformAdmin && (
                <Link
                  to="/admin/recordatorios"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-secondary"
                  activeProps={{ className: "bg-secondary text-gold" }}
                >
                  <BellRing className="h-4 w-4" />
                  Recordatorios
                </Link>
              )}
              {isPlatformAdmin && (
                <Link
                  to="/admin/padrinos"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-secondary"
                  activeProps={{ className: "bg-secondary text-gold" }}
                >
                  <HandHeart className="h-4 w-4" />
                  Plan Padrino
                </Link>
              )}
              {isPlatformAdmin && (
                <Link
                  to="/admin/alquileres"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-secondary"
                  activeProps={{ className: "bg-secondary text-gold" }}
                >
                  <CalendarClock className="h-4 w-4" />
                  Alquileres
                </Link>
              )}
            </nav>
          </div>
          <div className="flex w-full min-w-0 items-center justify-between gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            {raffles.length > 0 && (
              <select
                value={selectedId ?? ""}
                onChange={(e) => select(e.target.value || null)}
                className="min-w-0 max-w-[calc(100vw-7rem)] flex-1 truncate rounded-md border border-border bg-secondary px-2 py-1.5 text-xs sm:max-w-[220px]"
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
        <details className="sm:hidden border-t border-border">
          <summary className="mx-auto max-w-6xl cursor-pointer list-none px-4 py-3 text-sm font-semibold">
            Menú de administración
          </summary>
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 pb-3 text-sm">
            {isDualBono && selectedRaffle ? (
              <Link
                to="/admin/bonos/$raffleId"
                params={{ raffleId: selectedRaffle.id }}
                className="rounded-md px-3 py-2 hover:bg-secondary"
              >
                Boletas
              </Link>
            ) : (
              <Link
                to="/admin"
                activeOptions={{ exact: true }}
                className="rounded-md px-3 py-2 hover:bg-secondary"
              >
                Boletas
              </Link>
            )}
            {!isPlatformAdmin && (
              <Link to="/admin/pagos" className="rounded-md px-3 py-2 hover:bg-secondary">
                Mis métodos de pago
              </Link>
            )}
            {isPlatformAdmin && (
              <>
                <Link to="/admin/rifa" className="rounded-md px-3 py-2 hover:bg-secondary">
                  Cartones
                </Link>
                <Link to="/admin/bonos" className="rounded-md px-3 py-2 hover:bg-secondary">
                  Bonos
                </Link>
                <Link
                  to="/admin/responsables"
                  className="rounded-md px-3 py-2 hover:bg-secondary"
                >
                  Responsables
                </Link>
                <Link
                  to="/admin/distribucion"
                  className="rounded-md px-3 py-2 hover:bg-secondary"
                >
                  Distribución
                </Link>
                <Link to="/admin/sorteo" className="rounded-md px-3 py-2 hover:bg-secondary">
                  Sorteo
                </Link>
                <Link
                  to="/admin/recordatorios"
                  className="rounded-md px-3 py-2 hover:bg-secondary"
                >
                  Recordatorios
                </Link>
                <Link to="/admin/padrinos" className="rounded-md px-3 py-2 hover:bg-secondary">
                  Plan Padrino
                </Link>
                <Link to="/admin/alquileres" className="rounded-md px-3 py-2 hover:bg-secondary">
                  Alquileres
                </Link>
              </>
            )}
          </nav>
        </details>
      </header>
      <main className="admin-content max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
