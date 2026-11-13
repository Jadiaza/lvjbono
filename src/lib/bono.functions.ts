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

function shuffleBonos<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const target = random[0] % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

async function imageToDataUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const response = await fetch(parsed.toString(), { redirect: "follow" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_IMAGE_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) return null;
    return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

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
  raffle_mode: z.enum(["dual_bono", "material_2d"]).default("dual_bono"),
  nombre: z.string().trim().min(2).max(120),
  valor_boleta: z.number().int().min(100),
  bono_total: z.number().int().min(1).max(500).default(500),
  bono_prize_value: z.number().int().min(0).nullable().optional(),
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
  .validator((value: unknown) =>
    campaignSchema
      .superRefine((campaign, ctx) => {
        if (campaign.raffle_mode === "material_2d" && campaign.bono_total !== 100) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["bono_total"],
            message: "La rifa material de dos cifras debe tener exactamente 100 números.",
          });
        }
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      ...data,
      raffle_mode: data.raffle_mode,
      digitos: data.raffle_mode === "material_2d" ? 2 : 3,
      bono_numbers_per_ticket: data.raffle_mode === "material_2d" ? 1 : 2,
      staged_payments: false,
      activa: false,
      bono_total: data.raffle_mode === "material_2d" ? 100 : data.bono_total,
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
    const { data: generated, error: generationError } = await context.supabase.rpc(
      "generate_dual_bonos",
      { _raffle_id: raffle.id, _total_bonos: data.bono_total },
    );
    if (generationError) {
      await (supabaseAdmin as any).from("raffles").delete().eq("id", raffle.id);
      throw new Error(`No fue posible generar los bonos: ${generationError.message}`);
    }
    const [
      { count: bonoCount, error: bonoCountError },
      { data: generatedNumbers, error: numberError },
    ] = await Promise.all([
      (supabaseAdmin as any)
        .from("raffle_bonos")
        .select("id", { count: "exact", head: true })
        .eq("raffle_id", raffle.id),
      (supabaseAdmin as any)
        .from("raffle_bono_numbers")
        .select("bono_id, numero")
        .eq("raffle_id", raffle.id),
    ]);
    const expectedBonos = data.bono_total;
    const expectedNumbers = expectedBonos * (data.raffle_mode === "material_2d" ? 1 : 2);
    const numbers = generatedNumbers ?? [];
    const uniqueNumbers = new Set(numbers.map((item: any) => item.numero));
    const numbersPerBono = new Map<string, number>();
    for (const item of numbers) {
      numbersPerBono.set(item.bono_id, (numbersPerBono.get(item.bono_id) ?? 0) + 1);
    }
    const generationIsComplete =
      !bonoCountError &&
      !numberError &&
      bonoCount === expectedBonos &&
      numbers.length === expectedNumbers &&
      uniqueNumbers.size === expectedNumbers &&
      numbersPerBono.size === expectedBonos &&
      [...numbersPerBono.values()].every(
        (count) => count === (data.raffle_mode === "material_2d" ? 1 : 2),
      );
    if (!generationIsComplete) {
      await (supabaseAdmin as any).from("raffles").delete().eq("id", raffle.id);
      throw new Error(
        `La generación quedó incompleta. Se esperaban ${expectedBonos} bonos y ${expectedNumbers} números únicos.`,
      );
    }
    return { raffle, generated: Number(generated), generatedNumbers: numbers.length };
  });

export const adminListDualBonoCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("raffles")
      .select("*")
      .in("raffle_mode", ["dual_bono", "material_2d"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { campaigns: data ?? [] };
  });

export const adminDeleteBonoCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ raffleId: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: raffle, error: raffleError } = await (supabaseAdmin as any)
      .from("raffles").select("id, raffle_mode, nombre").eq("id", data.raffleId).single();
    if (raffleError || !raffle || !["dual_bono", "material_2d"].includes(raffle.raffle_mode)) {
      throw new Error("Campaña de bonos no encontrada.");
    }
    const [bonosResult, salesResult, eventsResult, assignmentsResult, batchesResult] = await Promise.all([
      (supabaseAdmin as any).from("raffle_bonos").select("id, serial, status, sale_id, amount_paid, reservation_expires_at").eq("raffle_id", data.raffleId),
      (supabaseAdmin as any).from("raffle_bono_sales").select("id", { count: "exact", head: true }).eq("raffle_id", data.raffleId),
      (supabaseAdmin as any).from("raffle_bono_events").select("id", { count: "exact", head: true }).eq("raffle_id", data.raffleId).neq("event_type", "generado"),
      (supabaseAdmin as any).from("raffle_bono_assignments").select("id", { count: "exact", head: true }).eq("raffle_id", data.raffleId),
      (supabaseAdmin as any).from("raffle_bono_batches").select("id, responsible_id").eq("raffle_id", data.raffleId),
    ]);
    for (const result of [bonosResult, salesResult, eventsResult, assignmentsResult, batchesResult]) {
      if (result.error) throw new Error("No fue posible validar el historial de la campaña.");
    }
    const bonos = bonosResult.data ?? [];
    const sold = bonos.filter((bono: any) => ["vendido", "pagado"].includes(bono.status) || bono.sale_id || Number(bono.amount_paid ?? 0) > 0).length;
    if (sold || salesResult.count) throw new Error(`No se puede eliminar: hay ${sold || salesResult.count} bono(s) con ventas o pagos registrados.`);
    const activeReservations = bonos.filter((bono: any) => bono.status === "reservado" && (!bono.reservation_expires_at || new Date(bono.reservation_expires_at) > new Date())).length;
    if (activeReservations) throw new Error(`No se puede eliminar: hay ${activeReservations} reserva(s) activas. Cancélalas primero.`);
    if (eventsResult.count || assignmentsResult.count || batchesResult.data?.some((batch: any) => batch.responsible_id)) {
      throw new Error("No se puede eliminar: la campaña tiene historial de asignaciones o actividad. Devuelve los bonos y conserva el historial.");
    }
    if (bonos.some((bono: any) => bono.status === "anulado" || bono.status === "devuelto")) {
      throw new Error("No se puede eliminar: hay bonos anulados o devueltos con historial que debe conservarse.");
    }
    const { error: batchesDeleteError } = await (supabaseAdmin as any).from("raffle_bono_batches").delete().eq("raffle_id", data.raffleId);
    if (batchesDeleteError) throw new Error("No fue posible eliminar los lotes vacíos.");
    const { error: deleteError } = await (supabaseAdmin as any).from("raffles").delete().eq("id", data.raffleId);
    if (deleteError) throw new Error("No fue posible eliminar la campaña.");
    return { deleted: true, name: raffle.nombre };
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
        .in("raffle_mode", ["dual_bono", "material_2d"])
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
    const [prizeDataUrl, logoDataUrl, sideDataUrl] = await Promise.all([
      imageToDataUrl(raffle.bono_prize_image_url),
      imageToDataUrl(raffle.bono_logo_url),
      imageToDataUrl(raffle.bono_side_image_url),
    ]);
    const enrichedRaffle = {
      ...raffle,
      bono_prize_image_data_url: prizeDataUrl,
      bono_logo_data_url: logoDataUrl,
      bono_side_image_data_url: sideDataUrl,
    };
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
      raffle: enrichedRaffle,
      bonos: rows,
      responsibles: responsibleSummaries,
      summary: calculateBonoSummary(rows),
    };
  });

export const adminAssignCampaignNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({
    raffleId: z.string().uuid(),
    responsibleId: z.string().uuid(),
    bonoIds: z.array(z.string().uuid()).min(1).max(500),
  }).parse(value))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: responsible, error: responsibleError } = await (supabaseAdmin as any)
      .from("raffle_responsibles")
      .select("id, active")
      .eq("id", data.responsibleId)
      .single();
    if (responsibleError || !responsible?.active) throw new Error("El responsable no está activo.");
    const { data: raffle, error: raffleError } = await (supabaseAdmin as any)
      .from("raffles")
      .select("id, raffle_mode")
      .eq("id", data.raffleId)
      .single();
    if (raffleError || !raffle || !["material_2d", "dual_bono"].includes(raffle.raffle_mode)) {
      throw new Error("Campaña de bonos no encontrada.");
    }
    const { data: bonos, error: bonosError } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select("id, raffle_id, status, current_responsible_id")
      .eq("raffle_id", data.raffleId)
      .in("id", data.bonoIds);
    if (bonosError || bonos?.length !== data.bonoIds.length) throw new Error("No se encontraron todos los números seleccionados.");
    if (bonos.some((bono: any) => bono.current_responsible_id || !["disponible", "devuelto"].includes(bono.status))) {
      throw new Error("Selecciona únicamente números disponibles y sin responsable.");
    }

    const code = `DIR-${Date.now().toString(36).toUpperCase()}`;
    const { data: batch, error: batchError } = await (supabaseAdmin as any)
      .from("raffle_bono_batches")
      .insert({ raffle_id: data.raffleId, responsible_id: data.responsibleId, code, name: "Números asignados", created_by: context.userId })
      .select("id")
      .single();
    if (batchError) throw new Error(batchError.message);
    const { data: updated, error: updateError } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .update({ current_responsible_id: data.responsibleId, current_batch_id: batch.id, status: "asignado" })
      .eq("current_responsible_id", null)
      .in("id", data.bonoIds)
      .select("id");
    if (updateError || updated?.length !== data.bonoIds.length) throw new Error(updateError?.message ?? "Uno de los números ya fue asignado. Actualiza la lista e intenta de nuevo.");
    await (supabaseAdmin as any).from("raffle_bono_assignments").insert(data.bonoIds.map((bonoId) => ({ raffle_id: data.raffleId, bono_id: bonoId, responsible_id: data.responsibleId, batch_id: batch.id, created_by: context.userId })));
    await (supabaseAdmin as any).from("raffle_bono_events").insert(data.bonoIds.map((bonoId) => ({ raffle_id: data.raffleId, bono_id: bonoId, actor_user_id: context.userId, responsible_id: data.responsibleId, event_type: "asignado", from_status: "disponible", to_status: "asignado", metadata: { batch_id: batch.id } })));
    await (supabaseAdmin as any).from("raffle_responsibles").update({ public_page_enabled: true }).eq("id", data.responsibleId);
    return { assigned: data.bonoIds.length };
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

const updateResponsibleSchema = z.object({
  responsibleId: z.string().uuid(),
  display_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).nullable().optional(),
  public_page_enabled: z.boolean(),
});

export const adminUpdateResponsible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => updateResponsibleSchema.parse(value))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { responsibleId, ...patch } = data;
    const { data: responsible, error } = await (supabaseAdmin as any)
      .from("raffle_responsibles")
      .update({ ...patch, phone: patch.phone || null })
      .eq("id", responsibleId)
      .select("id, username, display_name, phone, slug, active, public_page_enabled")
      .single();
    if (error) throw new Error(error.message);
    return { responsible };
  });

export const adminDeleteResponsible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ responsibleId: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: responsible, error: lookupError } = await (supabaseAdmin as any)
      .from("raffle_responsibles")
      .select("auth_user_id")
      .eq("id", data.responsibleId)
      .single();
    if (lookupError || !responsible) throw new Error("Responsable no encontrado.");

    const relatedTables = ["raffle_bono_batches", "raffle_bono_assignments", "raffle_bono_sales"];
    for (const table of relatedTables) {
      const { count, error } = await (supabaseAdmin as any)
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("responsible_id", data.responsibleId);
      if (error) throw new Error(error.message);
      if (count) {
        throw new Error(
          "Este responsable tiene historial de bonos. Desactívalo para conservar la trazabilidad.",
        );
      }
    }
    const { error } = await (supabaseAdmin as any)
      .from("raffle_responsibles")
      .delete()
      .eq("id", data.responsibleId);
    if (error) throw new Error(error.message);
    if (responsible.auth_user_id) {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
        responsible.auth_user_id,
      );
      if (authError)
        throw new Error(`Se eliminó el perfil, pero no el acceso: ${authError.message}`);
    }
    return { deleted: true };
  });

export const adminListBonoBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: batches, error }, { data: bonos, error: bonosError }] = await Promise.all([
      (supabaseAdmin as any)
        .from("raffle_bono_batches")
        .select("*, raffles(nombre), raffle_responsibles(display_name, username, slug)")
        .order("assigned_at", { ascending: false }),
      (supabaseAdmin as any)
        .from("raffle_bonos")
        .select("current_batch_id, status")
        .not("current_batch_id", "is", null),
    ]);
    if (error) throw new Error(error.message);
    if (bonosError) throw new Error(bonosError.message);
    const counts = new Map<string, Record<string, number>>();
    for (const bono of bonos ?? []) {
      const current = counts.get(bono.current_batch_id) ?? { total: 0 };
      current.total = (current.total ?? 0) + 1;
      current[bono.status] = (current[bono.status] ?? 0) + 1;
      counts.set(bono.current_batch_id, current);
    }
    return {
      batches: (batches ?? []).map((batch: any) => ({
        ...batch,
        counts: counts.get(batch.id) ?? { total: 0 },
      })),
    };
  });

export const adminGenerateBalancedBatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({ raffleId: z.string().uuid(), lotCount: z.number().int().min(1).max(500) })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: available, error } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select("id")
      .eq("raffle_id", data.raffleId)
      .in("status", ["disponible", "devuelto"])
      .is("current_batch_id", null);
    if (error) throw new Error(error.message);
    if (!available?.length) throw new Error("No hay bonos sin lote para distribuir.");
    if (data.lotCount > available.length)
      throw new Error("No puede haber más lotes que bonos disponibles.");

    const shuffled = shuffleBonos(available);
    const baseSize = Math.floor(shuffled.length / data.lotCount);
    const remainder = shuffled.length % data.lotCount;
    const batchSizes = Array.from(
      { length: data.lotCount },
      (_, index) => baseSize + (index < remainder ? 1 : 0),
    );
    const created: Array<{ id: string; code: string; size: number }> = [];
    let cursor = 0;
    for (let index = 0; index < batchSizes.length; index++) {
      const size = batchSizes[index];
      const code = `LOT-${Date.now().toString(36).toUpperCase()}-${String(index + 1).padStart(2, "0")}`;
      const { data: batch, error: batchError } = await (supabaseAdmin as any)
        .from("raffle_bono_batches")
        .insert({
          raffle_id: data.raffleId,
          responsible_id: null,
          code,
          name: `Lote ${String(index + 1).padStart(2, "0")}`,
          created_by: context.userId,
        })
        .select("id, code")
        .single();
      if (batchError) throw new Error(batchError.message);
      const ids = shuffled.slice(cursor, cursor + size).map((bono: any) => bono.id);
      cursor += size;
      const { error: updateError } = await (supabaseAdmin as any)
        .from("raffle_bonos")
        .update({ current_batch_id: batch.id })
        .in("id", ids)
        .is("current_batch_id", null);
      if (updateError) throw new Error(updateError.message);
      created.push({ ...batch, size });
    }
    return {
      batches: created,
      total: shuffled.length,
      minSize: baseSize,
      maxSize: baseSize + (remainder ? 1 : 0),
    };
  });

export const adminAssignResponsibleToBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z.object({ batchId: z.string().uuid(), responsibleId: z.string().uuid() }).parse(value),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: batch, error: batchError } = await (supabaseAdmin as any)
      .from("raffle_bono_batches")
      .select("id, raffle_id, responsible_id")
      .eq("id", data.batchId)
      .single();
    if (batchError || !batch) throw new Error("Lote no encontrado.");
    if (batch.responsible_id) throw new Error("Este lote ya tiene un responsable asignado.");
    const { data: bonos, error: bonosError } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select("id, status")
      .eq("current_batch_id", batch.id)
      .is("current_responsible_id", null)
      .in("status", ["disponible", "devuelto"]);
    if (bonosError || !bonos?.length) throw new Error("El lote no tiene bonos disponibles.");
    const ids = bonos.map((bono: any) => bono.id);
    const { error: updateError } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .update({ current_responsible_id: data.responsibleId, status: "asignado" })
      .in("id", ids)
      .is("current_responsible_id", null);
    if (updateError) throw new Error(updateError.message);
    const { error: batchUpdateError } = await (supabaseAdmin as any)
      .from("raffle_bono_batches")
      .update({ responsible_id: data.responsibleId })
      .eq("id", batch.id)
      .is("responsible_id", null);
    if (batchUpdateError) throw new Error(batchUpdateError.message);
    await (supabaseAdmin as any).from("raffle_bono_assignments").insert(
      ids.map((bonoId: string) => ({
        raffle_id: batch.raffle_id,
        bono_id: bonoId,
        responsible_id: data.responsibleId,
        batch_id: batch.id,
        created_by: context.userId,
      })),
    );
    await (supabaseAdmin as any).from("raffle_bono_events").insert(
      ids.map((bonoId: string) => ({
        raffle_id: batch.raffle_id,
        bono_id: bonoId,
        actor_user_id: context.userId,
        responsible_id: data.responsibleId,
        event_type: "asignado",
        from_status: "disponible",
        to_status: "asignado",
        metadata: { batch_id: batch.id },
      })),
    );
    await (supabaseAdmin as any)
      .from("raffle_responsibles")
      .update({ public_page_enabled: true })
      .eq("id", data.responsibleId);
    return { assigned: ids.length };
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
    const { data: bonos, error } = await query;
    if (error || !bonos?.length) throw new Error(error?.message ?? "No hay bonos disponibles.");
    if (data.quantity && bonos.length < data.quantity)
      throw new Error("No hay suficientes bonos disponibles.");
    const selectedBonos = data.bonoIds?.length
      ? bonos
      : shuffleBonos(bonos).slice(0, data.quantity!);
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
    const ids = selectedBonos.map((bono: any) => bono.id);
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
    const { data: bonos, error } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select(
        "*, raffles(nombre, valor_boleta), raffle_bono_numbers!raffle_bono_numbers_bono_campaign_fkey(option_number, numero), raffle_bono_batches(code, name)",
      )
      .eq("current_responsible_id", responsible.id)
      .order("serial");
    if (error) throw new Error(error.message);
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
        "id, serial, status, verification_code, raffle_bono_numbers!raffle_bono_numbers_bono_campaign_fkey(option_number, numero), raffles(raffle_mode, nombre, digitos, bono_numbers_per_ticket, valor_boleta, fecha_sorteo, loteria, bono_title, bono_subtitle, bono_prize_name, bono_prize_description, bono_prize_dimensions, bono_prize_value, bono_prize_image_url, bono_side_image_url, bono_logo_url, bono_number_color, bono_accent_color, bono_footer_text, bono_show_qr, bono_show_platform_branding)",
      )
      .eq("verification_code", data.code)
      .maybeSingle();
    if (!bono) throw new Error("Bono no encontrado.");
    let enrichedRaffle = bono.raffles;
    if (enrichedRaffle) {
      const [prizeDataUrl, logoDataUrl, sideDataUrl] = await Promise.all([
        imageToDataUrl(enrichedRaffle.bono_prize_image_url),
        imageToDataUrl(enrichedRaffle.bono_logo_url),
        imageToDataUrl(enrichedRaffle.bono_side_image_url),
      ]);
      enrichedRaffle = {
        ...enrichedRaffle,
        bono_prize_image_data_url: prizeDataUrl,
        bono_logo_data_url: logoDataUrl,
        bono_side_image_data_url: sideDataUrl,
      };
    }
    return { bono: { ...bono, raffles: enrichedRaffle } };
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
      .select("id, serial, status, raffle_bono_numbers!raffle_bono_numbers_bono_campaign_fkey(option_number, numero), raffles(nombre)")
      .eq("current_responsible_id", responsible.id)
      .neq("status", "anulado")
      .order("serial");
    return { responsible, bonos: bonos ?? [] };
  });

const adminBonoEditSchema = z.object({
  bonoId: z.string().uuid(),
  serial: z.number().int().min(1).max(500),
  numbers: z.array(z.number().int()).min(1).max(2),
  buyer_name: z.string().trim().max(120).nullable(),
  buyer_phone: z.string().trim().max(30).nullable(),
  buyer_city: z.string().trim().max(100).nullable(),
  buyer_notes: z.string().trim().max(500).nullable(),
});

const adminCampaignEditSchema = z.object({
  raffleId: z.string().uuid(),
  nombre: z.string().trim().min(1).max(160),
  valor_boleta: z.number().int().min(0),
  fecha_sorteo: z.string().nullable(),
  loteria: z.string().trim().max(160).nullable(),
  bono_title: z.string().trim().max(100),
  bono_subtitle: z.string().trim().max(200).nullable(),
  bono_prize_name: z.string().trim().max(160),
  bono_prize_description: z.string().trim().max(2000).nullable(),
  bono_prize_dimensions: z.string().trim().max(500).nullable(),
  bono_prize_value: z.number().int().min(0).nullable(),
  bono_prize_image_url: z.string().url().nullable().or(z.literal("")),
  bono_side_image_url: z.string().url().nullable().or(z.literal("")),
  bono_logo_url: z.string().url().nullable().or(z.literal("")),
  bono_number_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  bono_accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  bono_footer_text: z.string().trim().max(300),
  bono_show_qr: z.boolean(),
  bono_show_platform_branding: z.boolean(),
});

export const adminUpdateBonoCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => adminCampaignEditSchema.parse(value))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { raffleId, ...patch } = data;
    const { data: raffle, error: readError } = await supabaseAdmin
      .from("raffles")
      .select("raffle_mode")
      .eq("id", raffleId)
      .maybeSingle();
    if (readError || !raffle) throw new Error("No se encontró la campaña.");
    if (raffle.raffle_mode !== "dual_bono" && raffle.raffle_mode !== "material_2d") {
      throw new Error("La campaña no corresponde a un bono.");
    }
    const campaignPatch = {
      ...patch,
      fecha_sorteo: patch.fecha_sorteo || null,
      bono_subtitle: patch.bono_subtitle || null,
      bono_prize_description: patch.bono_prize_description || null,
      bono_prize_dimensions: patch.bono_prize_dimensions || null,
      bono_prize_image_url: patch.bono_prize_image_url || null,
      bono_side_image_url: patch.bono_side_image_url || null,
      bono_logo_url: patch.bono_logo_url || null,
    };
    const { error } = await (supabaseAdmin as any).from("raffles").update(campaignPatch).eq("id", raffleId);
    if (error) throw new Error("No fue posible guardar los cambios de la campaña.");
    return { ok: true };
  });

export const adminUpdateBono = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => adminBonoEditSchema.parse(value))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.rpc("admin_update_raffle_bono", {
      _bono_id: data.bonoId,
      _actor_user_id: context.userId,
      _serial: data.serial,
      _numbers: data.numbers,
      _buyer_name: data.buyer_name,
      _buyer_phone: data.buyer_phone,
      _buyer_city: data.buyer_city,
      _buyer_notes: data.buyer_notes,
    });

    if (error) {
      const messages: Record<string, string> = {
        forbidden: "Se requiere acceso de administrador.",
        bono_not_found: "Bono no encontrado.",
        bono_serial_conflict: "Ese serial ya está asignado a otro bono de la campaña.",
        bono_number_conflict: "Uno o más números ya están asignados a otro bono de la campaña.",
        bono_financial_history_locked:
          "No se puede cambiar el serial o los números de un bono con ventas o pagos registrados.",
        bono_identity_locked:
          "No se puede cambiar el serial o los números de un bono reservado o asignado. Cancela primero la reserva o asignación.",
        invalid_bono_data:
          "El nombre y teléfono del comprador son obligatorios cuando existe una venta registrada.",
        invalid_bono_numbers: "Los números no corresponden a la modalidad de esta campaña.",
        invalid_bono_serial: "El serial está fuera del rango permitido para esta campaña.",
      };
      throw new Error(messages[error.message] ?? error.message);
    }
    return { ok: true };
  });

export const adminDeleteBono = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ bonoId: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: result, error } = await context.supabase.rpc("admin_delete_raffle_bono", {
      _bono_id: data.bonoId,
      _actor_user_id: context.userId,
    });
    if (error) {
      const messages: Record<string, string> = {
        forbidden: "Se requiere acceso de administrador.",
        bono_not_found: "Bono no encontrado.",
        bono_financial_history_locked:
          "No se puede eliminar ni anular un bono con una venta o pago registrado. Usa el flujo de corrección administrativa.",
        bono_already_void: "El bono ya está anulado.",
        bono_active_reservation_locked:
          "Cancela formalmente la reserva antes de eliminar o anular este bono.",
      };
      throw new Error(messages[error.message] ?? error.message);
    }
    return result as { deleted: boolean; status: string | null };
  });

export { BONO_STATUSES };
