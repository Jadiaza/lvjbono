import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AuthContext = { supabase: any; userId: string };

async function requireAdmin(context: AuthContext) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Se requiere acceso de administrador.");
}

const slugSchema = z.object({
  raffleId: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .transform((value) => value.toLowerCase())
    .refine((value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
      message: "Usa solo letras, números y guiones, por ejemplo bsm-001.",
    }),
});

export const adminSetDualBonoPublicSlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => slugSchema.parse(value))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await (supabaseAdmin as any)
      .from("raffles")
      .select("id")
      .ilike("slug", data.slug)
      .neq("id", data.raffleId)
      .maybeSingle();
    if (existing) throw new Error("Ese código público ya está siendo utilizado.");

    const { data: raffle, error } = await (supabaseAdmin as any)
      .from("raffles")
      .update({ slug: data.slug, serie: data.slug.toUpperCase() })
      .eq("id", data.raffleId)
      .eq("raffle_mode", "dual_bono")
      .select("id, slug, serie")
      .single();
    if (error) throw new Error(error.message);
    return { raffle };
  });
