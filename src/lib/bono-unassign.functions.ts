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

export const adminUnassignResponsibleFromBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ batchId: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: batch, error: batchError } = await (supabaseAdmin as any)
      .from("raffle_bono_batches")
      .select("id, raffle_id, responsible_id, code, name")
      .eq("id", data.batchId)
      .single();
    if (batchError || !batch) throw new Error("Lote no encontrado.");
    if (!batch.responsible_id) throw new Error("Este lote ya está libre.");

    const { data: bonos, error: bonosError } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select("id, status")
      .eq("current_batch_id", batch.id)
      .eq("current_responsible_id", batch.responsible_id);
    if (bonosError) throw new Error(bonosError.message);
    if (!bonos?.length) throw new Error("El lote no tiene bonos asignados al responsable actual.");

    const blocked = bonos.filter((bono: any) => bono.status !== "asignado");
    if (blocked.length) {
      const counts = blocked.reduce((acc: Record<string, number>, bono: any) => {
        acc[bono.status] = (acc[bono.status] ?? 0) + 1;
        return acc;
      }, {});
      const detail = Object.entries(counts)
        .map(([status, count]) => `${count} ${status}`)
        .join(", ");
      throw new Error(
        `No se puede liberar el lote porque contiene bonos con movimiento (${detail}). Cancela las reservas o regulariza las ventas/pagos antes de desasignarlo.`,
      );
    }

    const ids = bonos.map((bono: any) => bono.id);
    const now = new Date().toISOString();

    const { error: bonoUpdateError } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .update({ current_responsible_id: null, status: "disponible" })
      .in("id", ids)
      .eq("current_responsible_id", batch.responsible_id)
      .eq("status", "asignado");
    if (bonoUpdateError) throw new Error(bonoUpdateError.message);

    const { error: batchUpdateError } = await (supabaseAdmin as any)
      .from("raffle_bono_batches")
      .update({ responsible_id: null, returned_at: now })
      .eq("id", batch.id)
      .eq("responsible_id", batch.responsible_id);
    if (batchUpdateError) throw new Error(batchUpdateError.message);

    const { error: assignmentError } = await (supabaseAdmin as any)
      .from("raffle_bono_assignments")
      .update({ ended_at: now, end_reason: "desasignado_por_administrador" })
      .eq("batch_id", batch.id)
      .eq("responsible_id", batch.responsible_id)
      .is("ended_at", null);
    if (assignmentError) throw new Error(assignmentError.message);

    const { error: eventError } = await (supabaseAdmin as any).from("raffle_bono_events").insert(
      ids.map((bonoId: string) => ({
        raffle_id: batch.raffle_id,
        bono_id: bonoId,
        actor_user_id: context.userId,
        responsible_id: batch.responsible_id,
        event_type: "desasignado",
        from_status: "asignado",
        to_status: "disponible",
        metadata: { batch_id: batch.id, batch_code: batch.code },
      })),
    );
    if (eventError) throw new Error(eventError.message);

    return { unassigned: ids.length, batchId: batch.id, batchCode: batch.code };
  });
