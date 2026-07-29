import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSiteUrl } from "@/lib/site-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/recuperar-contrasena")({
  head: () => ({
    meta: [{ title: "Recuperar contraseña · Rifaya" }, { name: "robots", content: "noindex" }],
  }),
  component: RecoverPasswordPage,
});

function RecoverPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getSiteUrl()}/restablecer-contrasena`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Revisa tu correo para continuar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible enviar el correo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="public-ticket-page flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-md rounded-2xl border border-gold/30 bg-card p-8 ticket-shadow">
        <Mail className="mx-auto h-9 w-9 text-gold" />
        <h1 className="mt-3 text-center font-display text-3xl">Recuperar contraseña</h1>
        {sent ? (
          <div className="mt-5 text-center">
            <p className="text-sm text-muted-foreground">
              Si el correo está registrado, recibirás un enlace para crear una contraseña nueva.
              Revisa también la carpeta de correo no deseado.
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold"
            >
              <ArrowLeft className="h-4 w-4" /> Volver al acceso
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="recovery-email">Correo de acceso</Label>
              <Input id="recovery-email" name="email" type="email" autoComplete="email" required />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Enviando…" : "Enviar enlace de recuperación"}
            </Button>
            <Link
              to="/auth"
              className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-gold"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Volver al acceso
            </Link>
          </form>
        )}
      </section>
    </main>
  );
}
