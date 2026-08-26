/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BONO_STATUSES,
  calculateBonoSummary,
  canResponsibleTransition,
  type BonoStatus,
} from "./bono-domain";

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

async function getResponsible(context: AuthContext) {
  const { data, error } = await context.supabase
    .from("raffle_responsibles")
    .select("*")
    .eq("auth_user_id", context.userId)
    .eq("active", true)
    .maybeSingle();
  if (error || !data) throw new Error("Tu cuenta de responsable no está activa.");
  return data as any;
}

const nullableUrl = z
  .union([z.string().url().startsWith("https://"), z.literal(""), z.null()])
  .optional();
const campaignSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  valor_boleta: z.number().int().min(100),
  bono_total: z.number().int().min(1).max(500).default(500),
  fecha_sorteo: z.string().nullable().optional(),
  loteria: z.string().trim().max(120).nullable().optional(),
  bono_title: z.string().trim().max(120).default("BONO"),
  bono_subtitle: z.string().trim().max(200).nullable().optional(),
  bono_prize_name: z.string().trim().max(160).nullable().optional(),
  bono_prize_description: z.string().trim().max(500).nullable().optional(),
  bono_prize_dimensions: z.string().trim().max(160).nullable().optional(),
  bono_prize_image_url: nullableUrl,
  bono_side_image_url: nullableUrl,
  bono_logo_url: nullableUrl,
  bono_number_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#C51B1B"),
  bono_accent_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#C51B1B"),
  bono_footer_text: z.string().trim().max(200).default("¡Gracias por apoyar nuestra misión!"),
  bono_show_qr: z.boolean().default(true),
  bono_show_platform_branding: z.boolean().default(true),
});

export const adminCreateDualBonoCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => campaignSchema.parse(value))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      ...data,
      raffle_mode: "dual_bono",
      digitos: 3,
      bono_numbers_per_ticket: 2,
      staged_payments: false,
      activa: false,
      bono_prize_image_url: data.bono_prize_image_url || null,
      bono_side_image_url: data.bono_side_image_url || null,
      bono_logo_url: data.bono_logo_url || null,
    };
    const { data: raffle, error } = await (supabaseAdmin as any)
      .from("raffles")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const { data: generated, error: generationError } = await (supabaseAdmin as any).rpc(
      "generate_dual_bonos",
      { _raffle_id: raffle.id, _total_bonos: data.bono_total },
    );
    if (generationError) {
      await (supabaseAdmin as any).from("raffles").delete().eq("id", raffle.id);
      throw new Error(`No fue posible generar los bonos: ${generationError.message}`);
    }
    return { raffle, generated: Number(generated) };
  });

export const adminListDualBonoCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("raffles")
      .select("*")
      .eq("raffle_mode", "dual_bono")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { campaigns: data ?? [] };
  });

export const adminGetDualBonoCampaign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ raffleId: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [
      { data: raffle },
      { data: bonos },
      { data: numbers },
      { data: responsibles },
      { data: batches },
    ] = await Promise.all([
      (supabaseAdmin as any)
        .from("raffles")
        .select("*")
        .eq("id", data.raffleId)
        .eq("raffle_mode", "dual_bono")
        .single(),
      (supabaseAdmin as any)
        .from("raffle_bonos")
        .select("*")
        .eq("raffle_id", data.raffleId)
        .order("serial"),
      (supabaseAdmin as any)
        .from("raffle_bono_numbers")
        .select("bono_id, option_number, numero")
        .eq("raffle_id", data.raffleId),
      (supabaseAdmin as any)
        .from("raffle_responsibles")
        .select("id, display_name, username, phone, active")
        .order("display_name"),
      (supabaseAdmin as any)
        .from("raffle_bono_batches")
        .select("id, code, name, responsible_id")
        .eq("raffle_id", data.raffleId),
    ]);
    if (!raffle) throw new Error("Campaña no encontrada.");
    const numberMap = new Map<string, any[]>();
    for (const number of numbers ?? [])
      numberMap.set(number.bono_id, [...(numberMap.get(number.bono_id) ?? []), number]);
    const responsibleMap = new Map(
      (responsibles ?? []).map((item: any) => [item.id, item.display_name]),
    );
    const batchMap = new Map((batches ?? []).map((item: any) => [item.id, item.code]));
    const rows = (bonos ?? []).map((bono: any) => ({
      ...bono,
      responsible_name: responsibleMap.get(bono.current_responsible_id) ?? null,
      batch_code: batchMap.get(bono.current_batch_id) ?? null,
      numbers: (numberMap.get(bono.id) ?? []).sort((a, b) => a.option_number - b.option_number),
    }));
    const responsibleSummaries = (responsibles ?? []).map((responsible: any) => {
      const assigned = rows.filter((bono: any) => bono.current_responsible_id === responsible.id);
      return { ...responsible, ...calculateBonoSummary(assigned), total: assigned.length };
    });
    return {
      raffle,
      bonos: rows,
      responsibles: responsibleSummaries,
      summary: calculateBonoSummary(rows),
    };
  });

const responsibleSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/),
  display_name: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(128),
  phone: z.string().trim().max(30).nullable().optional(),
  public_page_enabled: z.boolean().default(false),
});

export const adminCreateResponsible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => responsibleSchema.parse(value))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = `${data.username}@responsables.rifaya.local`;
    const slug = data.username.replace(/[._]+/g, "-");
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      app_metadata: { account_type: "raffle_responsible" },
    });
    if (authError || !authData.user)
      throw new Error(authError?.message ?? "No fue posible crear la cuenta.");
    const { data: responsible, error } = await (supabaseAdmin as any)
      .from("raffle_responsibles")
      .insert({
        auth_user_id: authData.user.id,
        username: data.username,
        display_name: data.display_name,
        phone: data.phone || null,
        email,
        slug,
        public_page_enabled: data.public_page_enabled,
      })
      .select("id, username, display_name, phone, slug, active, public_page_enabled")
      .single();
    if (error) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(error.message);
    }
    return { responsible };
  });

export const adminListResponsibles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("raffle_responsibles")
      .select("id, username, display_name, phone, slug, active, public_page_enabled, created_at")
      .order("display_name");
    if (error) throw new Error(error.message);
    return { responsibles: data ?? [] };
  });

export const adminSetResponsibleActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z.object({ responsibleId: z.string().uuid(), active: z.boolean() }).parse(value),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("raffle_responsibles")
      .update({ active: data.active })
      .eq("id", data.responsibleId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminResetResponsiblePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({ responsibleId: z.string().uuid(), password: z.string().min(8).max(128) })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: responsible } = await (supabaseAdmin as any)
      .from("raffle_responsibles")
      .select("auth_user_id")
      .eq("id", data.responsibleId)
      .single();
    if (!responsible?.auth_user_id)
      throw new Error("El responsable no tiene una cuenta vinculada.");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(responsible.auth_user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    await (supabaseAdmin as any)
      .from("raffle_responsibles")
      .update({ must_change_password: true })
      .eq("id", data.responsibleId);
    return { ok: true };
  });

export const adminAssignBonoBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        raffleId: z.string().uuid(),
        responsibleId: z.string().uuid(),
        quantity: z.number().int().min(1).max(500).optional(),
        bonoIds: z.array(z.string().uuid()).max(500).optional(),
        name: z.string().trim().min(2).max(100),
      })
      .refine((v) => v.quantity || v.bonoIds?.length, "Selecciona una cantidad o bonos concretos.")
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = (supabaseAdmin as any)
      .from("raffle_bonos")
      .select("id, serial, status")
      .eq("raffle_id", data.raffleId)
      .in("status", ["disponible", "devuelto"])
      .order("serial");
    if (data.bonoIds?.length) query = query.in("id", data.bonoIds);
    else query = query.limit(data.quantity!);
    const { data: bonos, error } = await query;
    if (error || !bonos?.length) throw new Error(error?.message ?? "No hay bonos disponibles.");
    if (data.quantity && bonos.length !== data.quantity)
      throw new Error("No hay suficientes bonos disponibles.");
    const code = `LOT-${Date.now().toString(36).toUpperCase()}`;
    const { data: batch, error: batchError } = await (supabaseAdmin as any)
      .from("raffle_bono_batches")
      .insert({
        raffle_id: data.raffleId,
        responsible_id: data.responsibleId,
        code,
        name: data.name,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (batchError) throw new Error(batchError.message);
    const ids = bonos.map((bono: any) => bono.id);
    const { error: updateError } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .update({
        current_responsible_id: data.responsibleId,
        current_batch_id: batch.id,
        status: "asignado",
      })
      .in("id", ids)
      .in("status", ["disponible", "devuelto"]);
    if (updateError) throw new Error(updateError.message);
    await (supabaseAdmin as any).from("raffle_bono_assignments").insert(
      ids.map((bonoId: string) => ({
        raffle_id: data.raffleId,
        bono_id: bonoId,
        responsible_id: data.responsibleId,
        batch_id: batch.id,
        created_by: context.userId,
      })),
    );
    await (supabaseAdmin as any).from("raffle_bono_events").insert(
      ids.map((bonoId: string) => ({
        raffle_id: data.raffleId,
        bono_id: bonoId,
        actor_user_id: context.userId,
        responsible_id: data.responsibleId,
        event_type: "asignado",
        from_status: "disponible",
        to_status: "asignado",
        metadata: { batch_id: batch.id },
      })),
    );
    return { batch, assigned: ids.length };
  });

export const adminReturnBonos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z.object({ bonoIds: z.array(z.string().uuid()).min(1).max(500) }).parse(value),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bonos } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select("id, raffle_id, status, current_responsible_id")
      .in("id", data.bonoIds);
    if (!bonos || bonos.length !== data.bonoIds.length) throw new Error("Bonos no encontrados.");
    if (bonos.some((bono: any) => ["vendido", "pagado", "anulado"].includes(bono.status)))
      throw new Error("No se pueden devolver bonos vendidos, pagados o anulados.");
    for (const bono of bonos as any[]) {
      await (supabaseAdmin as any)
        .from("raffle_bono_assignments")
        .update({ ended_at: new Date().toISOString(), end_reason: "devuelto" })
        .eq("bono_id", bono.id)
        .is("ended_at", null);
      const { error } = await (supabaseAdmin as any)
        .from("raffle_bonos")
        .update({ status: "devuelto", current_responsible_id: null, current_batch_id: null })
        .eq("id", bono.id)
        .eq("status", bono.status);
      if (error) throw new Error(error.message);
      await (supabaseAdmin as any).from("raffle_bono_events").insert({
        raffle_id: bono.raffle_id,
        bono_id: bono.id,
        actor_user_id: context.userId,
        responsible_id: bono.current_responsible_id,
        event_type: "devuelto",
        from_status: bono.status,
        to_status: "devuelto",
      });
    }
    return { returned: bonos.length };
  });

const responsibleMutationSchema = z.object({
  bonoIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(["reserve", "cancel_reservation", "sell", "pay"]),
  buyer_name: z.string().trim().min(2).max(120).optional(),
  buyer_phone: z.string().trim().min(5).max(30).optional(),
  buyer_city: z.string().trim().max(100).optional(),
  buyer_notes: z.string().trim().max(500).optional(),
  amount_paid: z.number().int().min(0).optional(),
  payment_reference: z.string().trim().max(120).optional(),
});

export const responsibleUpdateBonos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => responsibleMutationSchema.parse(value))
  .handler(async ({ data, context }) => {
    const responsible = await getResponsible(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bonos } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select("*")
      .in("id", data.bonoIds)
      .eq("current_responsible_id", responsible.id);
    if (!bonos || bonos.length !== data.bonoIds.length)
      throw new Error("Uno o más bonos no te pertenecen.");
    if (new Set(bonos.map((bono: any) => bono.raffle_id)).size !== 1)
      throw new Error("Una venta múltiple debe contener bonos de una sola campaña.");
    const target: BonoStatus =
      data.action === "reserve"
        ? "reservado"
        : data.action === "cancel_reservation"
          ? "asignado"
          : data.action === "sell"
            ? "vendido"
            : "pagado";
    if (bonos.some((bono: any) => !canResponsibleTransition(bono.status, target)))
      throw new Error("La transición de estado no está permitida.");
    if (data.action === "sell" && (!data.buyer_name || !data.buyer_phone))
      throw new Error("Nombre y teléfono del comprador son obligatorios.");
    const now = new Date().toISOString();
    let saleId: string | null = null;
    if (data.action === "sell") {
      const totalValue = bonos.reduce(
        (sum: number, bono: any) => sum + Number(bono.sale_value ?? 0),
        0,
      );
      const { data: sale, error } = await (supabaseAdmin as any)
        .from("raffle_bono_sales")
        .insert({
          raffle_id: bonos[0].raffle_id,
          responsible_id: responsible.id,
          buyer_name: data.buyer_name,
          buyer_phone: data.buyer_phone,
          buyer_city: data.buyer_city || null,
          buyer_notes: data.buyer_notes || null,
          total_value: totalValue,
          amount_paid: Math.min(data.amount_paid ?? 0, totalValue),
          payment_reference: data.payment_reference || null,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      saleId = sale.id;
    }
    let remainingPayment = data.amount_paid ?? 0;
    for (const bono of bonos as any[]) {
      const patch: Record<string, unknown> = { status: target };
      if (target === "reservado") patch.reserved_at = now;
      if (data.action === "cancel_reservation") {
        patch.reserved_at = null;
        patch.reservation_expires_at = null;
      }
      if (target === "vendido")
        Object.assign(patch, {
          sale_id: saleId,
          buyer_name: data.buyer_name,
          buyer_phone: data.buyer_phone,
          buyer_city: data.buyer_city || null,
          buyer_notes: data.buyer_notes || null,
          sold_at: now,
          amount_paid: Math.min(remainingPayment, bono.sale_value ?? 0),
          payment_reference: data.payment_reference || null,
        });
      if (target === "pagado")
        Object.assign(patch, {
          amount_paid: bono.sale_value,
          payment_reference: data.payment_reference || bono.payment_reference,
          paid_at: now,
        });
      if (target === "vendido") {
        remainingPayment = Math.max(0, remainingPayment - Number(bono.sale_value ?? 0));
      }
      const { error } = await (supabaseAdmin as any)
        .from("raffle_bonos")
        .update(patch)
        .eq("id", bono.id)
        .eq("status", bono.status)
        .eq("current_responsible_id", responsible.id);
      if (error) throw new Error(error.message);
      await (supabaseAdmin as any).from("raffle_bono_events").insert({
        raffle_id: bono.raffle_id,
        bono_id: bono.id,
        actor_user_id: context.userId,
        responsible_id: responsible.id,
        event_type: target,
        from_status: bono.status,
        to_status: target,
        metadata: saleId ? { sale_id: saleId } : {},
      });
    }
    return { updated: bonos.length, saleId };
  });

export const responsibleGetDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const responsible = await getResponsible(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bonos } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select(
        "*, raffles(nombre, valor_boleta), raffle_bono_numbers(option_number, numero), raffle_bono_batches(code, name)",
      )
      .eq("current_responsible_id", responsible.id)
      .order("serial");
    const rows = bonos ?? [];
    return { responsible, bonos: rows, summary: calculateBonoSummary(rows) };
  });

export const getPublicBonoByCode = createServerFn({ method: "GET" })
  .validator((value: unknown) => z.object({ code: z.string().uuid() }).parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bono } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select(
        "id, serial, status, verification_code, raffle_bono_numbers(option_number, numero), raffles(nombre, fecha_sorteo, loteria, bono_title, bono_subtitle, bono_prize_name, bono_prize_description, bono_prize_dimensions, bono_prize_image_url, bono_side_image_url, bono_logo_url, bono_number_color, bono_accent_color, bono_footer_text, bono_show_qr, bono_show_platform_branding)",
      )
      .eq("verification_code", data.code)
      .maybeSingle();
    if (!bono) throw new Error("Bono no encontrado.");
    return { bono };
  });

export const getPublicResponsiblePage = createServerFn({ method: "GET" })
  .validator((value: unknown) => z.object({ slug: z.string().min(3).max(80) }).parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: responsible } = await (supabaseAdmin as any)
      .from("raffle_responsibles")
      .select("id, display_name, phone, slug")
      .eq("slug", data.slug)
      .eq("active", true)
      .eq("public_page_enabled", true)
      .maybeSingle();
    if (!responsible) throw new Error("Página no disponible.");
    const { data: bonos } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select("id, serial, status, raffle_bono_numbers(option_number, numero), raffles(nombre)")
      .eq("current_responsible_id", responsible.id)
      .neq("status", "anulado")
      .order("serial");
    return { responsible, bonos: bonos ?? [] };
  });

export { BONO_STATUSES };
