import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/responsable-login")({ component: ResponsibleLogin });
function ResponsibleLogin() {
  const navigate = useNavigate(),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget),
      username = String(fd.get("username") ?? "")
        .trim()
        .toLowerCase(),
      password = String(fd.get("password") ?? "");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: `${username}@responsables.rifaya.local`,
        password,
      });
      if (error) throw error;
      navigate({ to: "/responsable", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Credenciales inválidas.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-7 shadow-xl"
      >
        <div>
          <h1 className="font-display text-2xl text-gold">Acceso de responsable</h1>
          <p className="text-sm text-muted-foreground">
            Usa el usuario y contraseña asignados por el administrador.
          </p>
        </div>
        <div>
          <Label htmlFor="username">Usuario</Label>
          <Input
            id="username"
            name="username"
            required
            autoCapitalize="none"
            autoComplete="username"
          />
        </div>
        <div>
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
          />
        </div>
        <Button disabled={busy} className="w-full">
          {busy ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>
    </main>
  );
}
