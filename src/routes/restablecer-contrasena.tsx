import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/restablecer-contrasena")({
  head: () => ({
    meta: [{ title: "Nueva contraseña · Rifaya" }, { name: "robots", content: "noindex" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password !== confirmation) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña actualizada correctamente.");
      navigate({ to: "/admin", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible cambiar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="public-ticket-page flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-md rounded-2xl border border-gold/30 bg-card p-8 ticket-shadow">
        <KeyRound className="mx-auto h-9 w-9 text-gold" />
        <h1 className="mt-3 text-center font-display text-3xl">Crear nueva contraseña</h1>
        {ready ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="new-password">Nueva contraseña</Label>
              <Input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div>
              <Label htmlFor="password-confirmation">Confirmar contraseña</Label>
              <Input
                id="password-confirmation"
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Guardando…" : "Guardar nueva contraseña"}
            </Button>
          </form>
        ) : (
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              El enlace no es válido o ya venció. Solicita uno nuevo.
            </p>
            <Link
              to="/recuperar-contrasena"
              className="mt-5 inline-block text-sm font-semibold text-gold underline"
            >
              Solicitar otro enlace
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
