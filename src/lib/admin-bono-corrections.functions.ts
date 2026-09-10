/* eslint-disable @typescript-eslint/no-explicit-any */
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

export const adminRevertPaidBono = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        bonoId: z.string().uuid(),
        reason: z.string().trim().min(3).max(300),
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: bono, error: lookupError } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select(
        "id, raffle_id, serial, status, current_responsible_id, sale_id, sale_value, amount_paid, payment_reference, paid_at",
      )
      .eq("id", data.bonoId)
      .single();

    if (lookupError || !bono) throw new Error("Bono no encontrado.");
    if (bono.status !== "pagado") {
      throw new Error("Solo se puede revertir un bono que esté en estado pagado.");
    }

    const now = new Date().toISOString();
    const previous = {
      amount_paid: bono.amount_paid ?? 0,
      payment_reference: bono.payment_reference ?? null,
      paid_at: bono.paid_at ?? null,
    };

    const { data: updated, error: updateError } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .update({
        status: "vendido",
        amount_paid: 0,
        payment_reference: null,
        paid_at: null,
        updated_at: now,
      })
      .eq("id", bono.id)
      .eq("status", "pagado")
      .select("id, serial, status, amount_paid, paid_at")
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "No fue posible revertir el pago.");
    }

    const { error: eventError } = await (supabaseAdmin as any)
      .from("raffle_bono_events")
      .insert({
        raffle_id: bono.raffle_id,
        bono_id: bono.id,
        actor_user_id: context.userId,
        responsible_id: bono.current_responsible_id,
        event_type: "pago_revertido_admin",
        from_status: "pagado",
        to_status: "vendido",
        metadata: {
          reason: data.reason,
          previous,
          sale_id: bono.sale_id,
          sale_value: bono.sale_value,
        },
      });

    if (eventError) {
      // La reversión ya se aplicó. Reportamos el fallo de auditoría para que no pase inadvertido.
      throw new Error(`El pago se revirtió, pero no se pudo registrar la auditoría: ${eventError.message}`);
    }

    return { bono: updated };
  });
