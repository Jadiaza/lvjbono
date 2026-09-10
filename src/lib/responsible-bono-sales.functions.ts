/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AuthContext = { supabase: any; userId: string };

async function getResponsible(context: AuthContext) {
  const { data, error } = await context.supabase
    .from("raffle_responsibles")
    .select("id, display_name, active")
    .eq("auth_user_id", context.userId)
    .eq("active", true)
    .maybeSingle();
  if (error || !data) throw new Error("Tu cuenta de responsable no está activa.");
  return data as any;
}

const customerSchema = z.object({
  bonoId: z.string().uuid(),
  buyer_name: z.string().trim().min(2).max(120),
  buyer_phone: z.string().trim().min(7).max(30),
  buyer_city: z.string().trim().max(100).optional().default(""),
  buyer_notes: z.string().trim().max(500).optional().default(""),
});

export const responsibleReserveBono = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => customerSchema.parse(value))
  .handler(async ({ data, context }) => {
    const responsible = await getResponsible(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bono, error: bonoError } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select("id, raffle_id, status, current_responsible_id")
      .eq("id", data.bonoId)
      .eq("current_responsible_id", responsible.id)
      .maybeSingle();
    if (bonoError || !bono) throw new Error("Bono no encontrado o no asignado a tu cuenta.");
    if (bono.status !== "asignado") throw new Error("Este bono ya no está disponible para reservar.");

    const now = new Date().toISOString();
    const { error } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .update({
        status: "reservado",
        buyer_name: data.buyer_name,
        buyer_phone: data.buyer_phone,
        buyer_city: data.buyer_city || null,
        buyer_notes: data.buyer_notes || null,
        reserved_at: now,
      })
      .eq("id", bono.id)
      .eq("status", "asignado")
      .eq("current_responsible_id", responsible.id);
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any).from("raffle_bono_events").insert({
      raffle_id: bono.raffle_id,
      bono_id: bono.id,
      actor_user_id: context.userId,
      responsible_id: responsible.id,
      event_type: "reservado",
      from_status: "asignado",
      to_status: "reservado",
      metadata: { buyer_name: data.buyer_name },
    });
    return { ok: true };
  });

export const responsibleCancelBonoReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ bonoId: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    const responsible = await getResponsible(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bono, error: bonoError } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select("id, raffle_id, status")
      .eq("id", data.bonoId)
      .eq("current_responsible_id", responsible.id)
      .maybeSingle();
    if (bonoError || !bono) throw new Error("Bono no encontrado o no asignado a tu cuenta.");
    if (bono.status !== "reservado") throw new Error("Solo se puede cancelar una reserva activa.");

    const { error } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .update({
        status: "asignado",
        buyer_name: null,
        buyer_phone: null,
        buyer_city: null,
        buyer_notes: null,
        reserved_at: null,
        reservation_expires_at: null,
      })
      .eq("id", bono.id)
      .eq("status", "reservado")
      .eq("current_responsible_id", responsible.id);
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any).from("raffle_bono_events").insert({
      raffle_id: bono.raffle_id,
      bono_id: bono.id,
      actor_user_id: context.userId,
      responsible_id: responsible.id,
      event_type: "reserva_cancelada",
      from_status: "reservado",
      to_status: "asignado",
    });
    return { ok: true };
  });

export const responsibleRevertBonoSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ bonoId: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    const responsible = await getResponsible(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: bono, error: bonoError } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select("id, raffle_id, status, sale_id, amount_paid, buyer_name")
      .eq("id", data.bonoId)
      .eq("current_responsible_id", responsible.id)
      .maybeSingle();

    if (bonoError || !bono) throw new Error("Bono no encontrado o no asignado a tu cuenta.");
    if (bono.status === "pagado" || Number(bono.amount_paid ?? 0) > 0) {
      throw new Error("Un bono pagado no puede ser revertido por el responsable. Debe hacerlo el administrador general.");
    }
    if (bono.status !== "vendido") throw new Error("Solo se puede revertir una venta que esté en estado Vendido.");

    const { error } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .update({
        status: "reservado",
        sold_at: null,
        amount_paid: 0,
        payment_reference: null,
        paid_at: null,
        sale_id: null,
      })
      .eq("id", bono.id)
      .eq("status", "vendido")
      .eq("current_responsible_id", responsible.id);
    if (error) throw new Error(error.message);

    if (bono.sale_id) {
      await (supabaseAdmin as any)
        .from("raffle_bono_sales")
        .update({ total_value: 0, amount_paid: 0, payment_reference: null, paid_at: null })
        .eq("id", bono.sale_id)
        .eq("responsible_id", responsible.id);
    }

    await (supabaseAdmin as any).from("raffle_bono_events").insert({
      raffle_id: bono.raffle_id,
      bono_id: bono.id,
      actor_user_id: context.userId,
      responsible_id: responsible.id,
      event_type: "venta_revertida",
      from_status: "vendido",
      to_status: "reservado",
      metadata: { buyer_name: bono.buyer_name ?? null },
    });

    return { ok: true };
  });
