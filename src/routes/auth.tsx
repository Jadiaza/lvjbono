import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { getSiteUrl } from "@/lib/site-url";
import { isAdminSetupPending } from "@/lib/raffle.functions";
import { useServerFn } from "@tanstack/react-start";
import { getPublicSkinDefinition, type PublicSkin } from "@/lib/public-skins";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceso administrador · ¡Qué Locura de Rifa!" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [signupAllowed, setSignupAllowed] = useState(false);
  const [skin, setSkin] = useState<PublicSkin>("verde-esmeralda");
  const checkSetup = useServerFn(isAdminSetupPending);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    checkSetup()
      .then(setSignupAllowed)
      .catch(() => setSignupAllowed(false));
  }, [checkSetup]);

  useEffect(() => {
    supabase
      .from("raffles")
      .select("public_skin")
      .eq("activa", true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.public_skin) setSkin(data.public_skin as PublicSkin);
      });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.publicActiveSkin = skin;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", getPublicSkinDefinition(skin).colors[0]);
    return () => {
      delete document.documentElement.dataset.publicActiveSkin;
    };
  }, [skin]);

  async function handle(fd: FormData) {
    setLoading(true);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${getSiteUrl()}/admin` },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Cuenta creada. Confirma tu correo antes de iniciar sesión.");
          setMode("signin");
          return;
        }
        toast.success("Cuenta creada. Revisa tu email si se requiere confirmación.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/admin", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="public-ticket-page min-h-screen flex items-center justify-center px-4"
      data-public-skin={skin}
    >
      <div className="w-full max-w-sm rounded-2xl border border-gold/30 bg-card p-8 ticket-shadow">
        <div className="text-center mb-6">
          <Lock className="h-8 w-8 text-gold mx-auto" />
          <h1 className="font-display text-2xl mt-2">Panel administrador</h1>
          <p className="text-xs text-muted-foreground">
            El primer usuario que se registre será administrador.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handle(new FormData(e.currentTarget));
          }}
          className="space-y-3"
        >
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" required minLength={6} />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gold-gradient text-primary-foreground font-semibold"
          >
            {loading ? "…" : mode === "signin" ? "Iniciar sesión" : "Crear cuenta"}
          </Button>
        </form>
        {signupAllowed && (
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-xs text-muted-foreground hover:text-gold"
          >
            {mode === "signin"
              ? "¿No tienes cuenta? Crear una"
              : "¿Ya tienes cuenta? Iniciar sesión"}
          </button>
        )}
      </div>
    </div>
  );
}
