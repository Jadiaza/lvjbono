/* eslint-disable @typescript-eslint/no-explicit-any -- rental tables are ahead of generated Supabase types */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { PUBLIC_SKIN_IDS } from "@/lib/public-skins";
import { normalizePublicRaffleSlug } from "@/lib/public-raffle-url";

function getPublicClient() {
  const url = process.env.SUPABASE_URL?.replace(/^\uFEFF/, "").trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.replace(/^\uFEFF/, "").trim();
  if (!url || !key) throw new Error("El servicio no está configurado temporalmente.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

async function verifyTurnstileToken(token: string): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    console.error("[Turnstile] Missing TURNSTILE_SECRET_KEY");
    throw new Error("La verificación antirrobot no está configurada.");
  }

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!response.ok) throw new Error("No fue posible comprobar la verificación antirrobot.");
  const result = (await response.json()) as { success?: boolean };
  if (!result.success) throw new Error("La verificación antirrobot venció. Inténtalo nuevamente.");
}

// ============ PÚBLICO ============

export const isAdminSetupPending = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await getPublicClient().rpc("is_admin_setup_pending");
  if (error) throw new Error("No fue posible consultar la configuración administrativa.");
  return data === true;
});

export const getRaffleData = createServerFn({ method: "GET" }).handler(async () => {
  const s = getPublicClient();
  const { data: raffle, error: raffleError } = await s
    .from("raffles")
    .select(
      "id, nombre, serie, digitos, valor_boleta, fecha_sorteo, loteria, activa, whatsapp_admin, nequi, daviplata, bre_b, nequi_qr_url, daviplata_qr_url, bre_b_qr_url, mercadopago_url, premio_mayor, premio_seco1, premio_seco2, premio_aprox_ant, premio_aprox_pos, public_skin, staged_payments, installment_amount",
    )
    .eq("activa", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (raffleError) {
    console.error("[getRaffleData] raffle query failed", {
      code: raffleError.code,
      message: raffleError.message,
      details: raffleError.details,
      hint: raffleError.hint,
    });
    throw new Error("No fue posible cargar la rifa.");
  }
  if (!raffle) return { raffle: null, tickets: [], stages: [], setupRequired: false };

  const { data: tickets, error: ticketsError } = await s.rpc("get_public_tickets", {
    _raffle_id: raffle.id,
  });
  if (ticketsError) {
    console.error("[getRaffleData] public ticket query failed", {
      code: ticketsError.code,
      message: ticketsError.message,
      details: ticketsError.details,
      hint: ticketsError.hint,
    });
    if (ticketsError.code === "PGRST202") {
      return { raffle, tickets: [], stages: [], setupRequired: true };
    }
    throw new Error("No fue posible cargar el talonario.");
  }

  const { data: stages, error: stagesError } = raffle.staged_payments
    ? await s.rpc("get_public_raffle_stages", { _raffle_id: raffle.id })
    : { data: [], error: null };
  if (stagesError) throw new Error("No fue posible cargar la programación de sorteos.");

  return {
    raffle,
    tickets: (tickets ?? []).sort((a, b) => a.numero - b.numero),
    stages: stages ?? [],
    setupRequired: false,
  };
});

export const getPublicRaffleCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const [{ data: raffles, error }, { data: rentals }] = await Promise.all([
    (supabaseAdmin as any)
      .from("raffles")
      .select(
        "id, nombre, serie, slug, responsable, fecha_sorteo, loteria, valor_boleta, premio_mayor, public_skin",
      )
      .eq("activa", true)
      .order("created_at", { ascending: false }),
    (supabaseAdmin as any).from("raffle_rentals").select("raffle_id, active, starts_at, ends_at"),
  ]);
  if (error) throw new Error("No fue posible cargar las rifas disponibles.");
  const rentalsByRaffle = new Map<string, any[]>();
  for (const rental of rentals ?? []) {
    const current = rentalsByRaffle.get(rental.raffle_id) ?? [];
    current.push(rental);
    rentalsByRaffle.set(rental.raffle_id, current);
  }
  return (raffles ?? []).filter((raffle: any) => {
    const assigned = rentalsByRaffle.get(raffle.id) ?? [];
    return (
      assigned.length === 0 ||
      assigned.some((rental) => rental.active && rental.starts_at <= now && rental.ends_at > now)
    );
  });
});

export const getRaffleDataBySlug = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ slug: z.string().trim().min(2).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let raffleQuery = (supabaseAdmin as any)
      .from("raffles")
      .select(
        "id, nombre, serie, digitos, valor_boleta, fecha_sorteo, loteria, activa, whatsapp_admin, nequi, daviplata, bre_b, nequi_qr_url, daviplata_qr_url, bre_b_qr_url, mercadopago_url, premio_mayor, premio_seco1, premio_seco2, premio_aprox_ant, premio_aprox_pos, public_skin, staged_payments, installment_amount, slug, responsable",
      )
      .eq("activa", true);
    raffleQuery = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(data.slug)
      ? raffleQuery.eq("id", data.slug)
      : raffleQuery.ilike("slug", data.slug);
    let { data: raffle } = await raffleQuery.maybeSingle();
    if (!raffle && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(data.slug)) {
      const { data: activeRaffles } = await (supabaseAdmin as any)
        .from("raffles")
        .select(
          "id, nombre, serie, digitos, valor_boleta, fecha_sorteo, loteria, activa, whatsapp_admin, nequi, daviplata, bre_b, nequi_qr_url, daviplata_qr_url, bre_b_qr_url, mercadopago_url, premio_mayor, premio_seco1, premio_seco2, premio_aprox_ant, premio_aprox_pos, public_skin, staged_payments, installment_amount, slug, responsable",
        )
        .eq("activa", true);
      const requestedSlug = normalizePublicRaffleSlug(data.slug);
      raffle = (activeRaffles ?? []).find(
        (candidate: any) =>
          !candidate.slug && normalizePublicRaffleSlug(candidate.serie) === requestedSlug,
      );
    }
    if (!raffle) return { raffle: null, tickets: [], stages: [], setupRequired: false };

    const { data: rentals } = await (supabaseAdmin as any)
      .from("raffle_rentals")
      .select("active, starts_at, ends_at")
      .eq("raffle_id", raffle.id);
    const now = new Date();
    if (
      rentals?.length &&
      !rentals.some(
        (rental: any) =>
          rental.active && new Date(rental.starts_at) <= now && new Date(rental.ends_at) > now,
      )
    ) {
      return { raffle: null, tickets: [], stages: [], setupRequired: false };
    }

    const s = getPublicClient();
    const { data: tickets, error: ticketsError } = await s.rpc("get_public_tickets", {
      _raffle_id: raffle.id,
    });
    if (ticketsError) throw new Error("No fue posible cargar el talonario.");
    const { data: stages, error: stagesError } = raffle.staged_payments
      ? await s.rpc("get_public_raffle_stages", { _raffle_id: raffle.id })
      : { data: [], error: null };
    if (stagesError) throw new Error("No fue posible cargar la programación de sorteos.");
    return {
      raffle,
      tickets: (tickets ?? []).sort((a, b) => a.numero - b.numero),
      stages: stages ?? [],
      setupRequired: false,
    };
  });
export const getPublicDrawResults = createServerFn({ method: "GET" }).handler(async () => {
  const s = getPublicClient();
  const { data: draws, error } = await s
    .from("draws")
    .select(
      "id, raffle_id, premio_mayor_num, seco1_num, seco2_num, ganadores, draw_date, draw_number, created_at",
    )
    .order("draw_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("No fue posible cargar los resultados anteriores.");

  const raffleIds = [...new Set((draws ?? []).map((draw) => draw.raffle_id))];
  const { data: raffles } = raffleIds.length
    ? await s
        .from("raffles")
        .select("id, nombre, serie, digitos, loteria, public_skin")
        .in("id", raffleIds)
    : { data: [] };
  const raffleMap = new Map((raffles ?? []).map((raffle) => [raffle.id, raffle]));
  return (draws ?? []).map((draw) => ({
    ...draw,
    ganadores: Array.isArray(draw.ganadores)
      ? draw.ganadores.map((item) => {
          const value = item && typeof item === "object" && !Array.isArray(item) ? item : {};
          return {
            premio: String(value.premio ?? value.prize ?? "Premio"),
            numero: Number(value.numero ?? value.number ?? 0),
            monto: Number(value.monto ?? value.amount ?? 0),
            acumulado: Boolean(value.acumulado ?? value.paid === false),
            vendido: Boolean(value.vendido),
          };
        })
      : [],
    raffle: raffleMap.get(draw.raffle_id) ?? null,
  }));
});

export const reservarNumero = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        raffleId: z.string().uuid(),
        numero: z.number().int().min(0).max(999),
        nombre: z.string().trim().min(2).max(80),
        telefono: z.string().trim().min(7).max(20),
        ciudad: z.string().trim().min(2).max(60),
        email: z.string().trim().email().max(120).optional().or(z.literal("")),
        medio_pago: z.enum(["nequi", "daviplata", "bre_b", "mercadopago_url", "transferencia"]),
        turnstileToken: z.string().min(10),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await verifyTurnstileToken(data.turnstileToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Validar rifa activa
    const { data: raffle } = await supabaseAdmin
      .from("raffles")
      .select("id, activa, valor_boleta, digitos")
      .eq("id", data.raffleId)
      .maybeSingle();
    if (!raffle || !raffle.activa) throw new Error("La rifa no está disponible.");

    if (data.numero >= 10 ** raffle.digitos) throw new Error("El número no pertenece a esta rifa.");
    const { data: rows, error } = await supabaseAdmin.rpc("reserve_ticket", {
      _raffle_id: data.raffleId,
      _numero: data.numero,
      _nombre: data.nombre,
      _telefono: data.telefono,
      _ciudad: data.ciudad,
      _email: data.email || "",
      _medio_pago: data.medio_pago,
    });
    if (error) {
      if (error.message.includes("ticket_unavailable"))
        throw new Error("Ese número ya no está disponible. Elige otro.");
      throw new Error("No fue posible completar la reserva.");
    }
    const updated = rows?.[0];
    if (!updated) throw new Error("Ese número ya no está disponible. Elige otro.");

    return {
      codigo: updated.codigo_verificacion,
      numero: updated.numero,
      numeroAlterno: updated.numero_alterno,
    };
  });

export const getBoletaByCodigo = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ codigo: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select(
        "id, numero, numero_alterno, estado, nombre, telefono, ciudad, email, medio_pago, valor_pagado, total_abonado, fecha_compra, codigo_verificacion, premio_ganado, raffle_id",
      )
      .eq("codigo_verificacion", data.codigo)
      .maybeSingle();
    if (ticketError) throw new Error("No fue posible consultar la boleta.");
    if (!t) return null;
    const { data: r, error: raffleError } = await supabaseAdmin
      .from("raffles")
      .select(
        "nombre, digitos, valor_boleta, fecha_sorteo, loteria, whatsapp_admin, nequi, daviplata, bre_b, nequi_qr_url, daviplata_qr_url, bre_b_qr_url, mercadopago_url, public_skin, staged_payments, installment_amount",
      )
      .eq("id", t.raffle_id)
      .maybeSingle();
    if (raffleError) throw new Error("No fue posible consultar la rifa.");
    const [{ data: payments }, { data: stages }] = await Promise.all([
      supabaseAdmin
        .from("ticket_payments")
        .select("id, amount, reference, paid_at")
        .eq("ticket_id", t.id)
        .order("paid_at"),
      supabaseAdmin
        .from("raffle_draw_stages")
        .select(
          "id, name, draw_at, minimum_paid, prize_amount, result_number, winner_ticket_id, completed_at",
        )
        .eq("raffle_id", t.raffle_id)
        .order("draw_at"),
    ]);
    return { ticket: t, raffle: r, payments: payments ?? [], stages: stages ?? [] };
  });

// ============ ADMIN ============

async function assertAdmin(ctx: {
  supabase: ReturnType<typeof createClient<Database>>;
  userId: string;
}) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: se requiere rol admin.");
}

async function getAdminAccess(ctx: {
  supabase: ReturnType<typeof createClient<Database>>;
  userId: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: role } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (role) return { role: "admin" as const, raffleIds: [] as string[], rental: null };

  const now = new Date().toISOString();
  const { data: rentals } = await (supabaseAdmin as any)
    .from("raffle_rentals")
    .select("id, raffle_id, responsable, starts_at, ends_at")
    .eq("user_id", ctx.userId)
    .eq("active", true)
    .lte("starts_at", now)
    .gt("ends_at", now);
  const activeRentals = rentals ?? [];
  if (!activeRentals.length) throw new Error("Tu alquiler no está activo o ya venció.");
  return {
    role: "organizer" as const,
    raffleIds: activeRentals.map((r: { raffle_id: string }) => r.raffle_id),
    rental: activeRentals[0],
  };
}

async function assertRaffleAccess(
  ctx: { supabase: ReturnType<typeof createClient<Database>>; userId: string },
  raffleId: string,
) {
  const access = await getAdminAccess(ctx);
  if (access.role !== "admin" && !access.raffleIds.includes(raffleId)) {
    throw new Error("No tienes acceso a esta rifa.");
  }
  return access;
}

export const adminListRaffles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await getAdminAccess(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let raffleQuery = supabaseAdmin.from("raffles").select("*");
    if (access.role !== "admin") raffleQuery = raffleQuery.in("id", access.raffleIds);
    const { data: raffles } = await raffleQuery.order("created_at", { ascending: false });
    const list = raffles ?? [];
    // Enrich with counts
    const enriched = await Promise.all(
      list.map(async (r) => {
        const { data: agg } = await supabaseAdmin
          .from("tickets")
          .select("estado")
          .eq("raffle_id", r.id);
        const counts = { disponible: 0, reservado: 0, vendido: 0, ganador: 0 };
        for (const t of agg ?? []) counts[t.estado as keyof typeof counts]++;
        return { ...r, counts, total: (agg ?? []).length };
      }),
    );
    return { raffles: enriched, access };
  });

export const adminCreateRaffle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        nombre: z.string().trim().min(2).max(120),
        serie: z.string().trim().max(40).optional().nullable(),
        digitos: z.union([z.literal(2), z.literal(3)]).default(2),
        valor_boleta: z.number().int().min(100).default(10000),
        cantidad: z.number().int().min(1).max(20).default(1),
        fecha_sorteo: z.string().nullable().optional(),
        loteria: z.string().nullable().optional(),
        premio_mayor: z.number().int().min(0).default(300000),
        premio_seco1: z.number().int().min(0).default(100000),
        premio_seco2: z.number().int().min(0).default(80000),
        premio_aprox_ant: z.number().int().min(0).default(10000),
        premio_aprox_pos: z.number().int().min(0).default(10000),
        public_skin: z.enum(PUBLIC_SKIN_IDS).default("purpura-real"),
        staged_payments: z.boolean().default(false),
        installment_amount: z.number().int().min(1).optional().nullable(),
        stages: z.array(z.unknown()).max(24).default([]),
      })
      .transform((data) => ({
        ...data,
        stages:
          data.digitos === 3 && data.staged_payments
            ? z
                .array(
                  z.object({
                    name: z.string().trim().min(2).max(80),
                    draw_at: z.string().min(10),
                    minimum_paid: z.number().int().min(1),
                    prize_amount: z.number().int().min(0),
                  }),
                )
                .parse(data.stages)
            : [],
      }))
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const created: string[] = [];
    for (let i = 0; i < data.cantidad; i++) {
      const suffix = data.cantidad > 1 ? ` · Cartón ${i + 1}` : "";
      const serie = data.serie ? (data.cantidad > 1 ? `${data.serie}-${i + 1}` : data.serie) : null;
      const { data: r, error } = await supabaseAdmin
        .from("raffles")
        .insert({
          nombre: data.nombre + suffix,
          serie,
          digitos: data.digitos,
          valor_boleta: data.valor_boleta,
          fecha_sorteo: data.fecha_sorteo || null,
          loteria: data.loteria || null,
          premio_mayor: data.premio_mayor,
          premio_seco1: data.digitos === 3 && data.staged_payments ? 0 : data.premio_seco1,
          premio_seco2: data.digitos === 3 && data.staged_payments ? 0 : data.premio_seco2,
          premio_aprox_ant: data.digitos === 3 && data.staged_payments ? 0 : data.premio_aprox_ant,
          premio_aprox_pos: data.digitos === 3 && data.staged_payments ? 0 : data.premio_aprox_pos,
          public_skin: data.public_skin,
          staged_payments: data.digitos === 3 && data.staged_payments,
          installment_amount:
            data.digitos === 3 && data.staged_payments
              ? (data.installment_amount ?? Math.ceil(data.valor_boleta / 3))
              : null,
          activa: false,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (data.digitos === 3 && data.staged_payments) {
        if (!data.fecha_sorteo || data.stages.length === 0) {
          await supabaseAdmin.from("raffles").delete().eq("id", r.id);
          throw new Error("Configura la fecha final y al menos un premio mensual.");
        }
        const finalDate = new Date(`${data.fecha_sorteo}T23:59:59`);
        if (data.stages.some((stage) => new Date(stage.draw_at) >= finalDate)) {
          await supabaseAdmin.from("raffles").delete().eq("id", r.id);
          throw new Error("Los premios mensuales deben jugar antes del premio final.");
        }
        const { error: stagesError } = await supabaseAdmin.from("raffle_draw_stages").insert(
          data.stages.map((stage) => ({
            raffle_id: r.id,
            name: stage.name,
            draw_at: stage.draw_at,
            minimum_paid: stage.minimum_paid,
            prize_amount: stage.prize_amount,
          })),
        );
        if (stagesError) {
          await supabaseAdmin.from("raffles").delete().eq("id", r.id);
          throw new Error("No fue posible crear la programación mensual.");
        }
      }
      created.push(r.id);
    }
    return { ids: created };
  });

export const adminDeleteRaffle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ raffleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Refuse if there are sold tickets
    const { count, error: countError } = await supabaseAdmin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("raffle_id", data.raffleId)
      .in("estado", ["vendido", "ganador"]);
    if (countError) throw new Error("No fue posible validar la rifa.");
    if ((count ?? 0) > 0) {
      throw new Error("No se puede eliminar: hay boletas vendidas.");
    }
    const { error: drawError } = await supabaseAdmin
      .from("draws")
      .delete()
      .eq("raffle_id", data.raffleId);
    if (drawError) throw new Error("No fue posible eliminar el sorteo.");
    const { error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .delete()
      .eq("raffle_id", data.raffleId);
    if (ticketsError) throw new Error("No fue posible eliminar las boletas.");
    const { error } = await supabaseAdmin.from("raffles").delete().eq("id", data.raffleId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({ raffleId: z.string().uuid().optional() })
      .optional()
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const access = await getAdminAccess(context);
    const requestedRaffleId =
      data?.raffleId ?? (access.role === "organizer" ? access.raffleIds[0] : undefined);
    if (requestedRaffleId) await assertRaffleAccess(context, requestedRaffleId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let raffle: Database["public"]["Tables"]["raffles"]["Row"] | null = null;
    if (requestedRaffleId) {
      const { data: r } = await supabaseAdmin
        .from("raffles")
        .select("*")
        .eq("id", requestedRaffleId)
        .maybeSingle();
      raffle = r;
    } else {
      const { data: r } = await supabaseAdmin
        .from("raffles")
        .select("*")
        .order("activa", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      raffle = r;
    }
    if (!raffle) return { raffle: null, tickets: [] };
    const { data: tickets } = await supabaseAdmin
      .from("tickets")
      .select("*")
      .eq("raffle_id", raffle.id)
      .order("numero");
    return { raffle, tickets: tickets ?? [] };
  });

export const adminUpdateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        estado: z.enum(["disponible", "reservado", "vendido", "ganador"]).optional(),
        nombre: z.string().optional().nullable(),
        telefono: z.string().optional().nullable(),
        ciudad: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        observaciones: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticketAccess } = await supabaseAdmin
      .from("tickets")
      .select("raffle_id")
      .eq("id", data.ticketId)
      .single();
    if (!ticketAccess) throw new Error("Boleta no encontrada.");
    await assertRaffleAccess(context, ticketAccess.raffle_id);
    const patch: Database["public"]["Tables"]["tickets"]["Update"] = {};
    if (data.estado !== undefined) patch.estado = data.estado;
    if (data.nombre !== undefined) patch.nombre = data.nombre;
    if (data.telefono !== undefined) patch.telefono = data.telefono;
    if (data.ciudad !== undefined) patch.ciudad = data.ciudad;
    if (data.email !== undefined) patch.email = data.email;
    if (data.observaciones !== undefined) patch.observaciones = data.observaciones;
    const { error } = await supabaseAdmin.from("tickets").update(patch).eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Registrar un pago o abono. En rifas por etapas permanece reservado
// hasta completar el valor total; los abonos habilitan sorteos intermedios.
export const adminConfirmarPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        referencia_pago: z.string().trim().min(3, "Ingresa la referencia del comprobante").max(80),
        monto_recibido: z.number().int().min(1, "Monto inválido"),
        observaciones: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin
      .from("tickets")
      .select("id, estado, valor_pagado, total_abonado, raffle_id")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!t) throw new Error("Boleta no encontrada");
    await assertRaffleAccess(context, t.raffle_id);
    if (t.estado !== "reservado") throw new Error("Solo se pueden validar boletas reservadas");
    const { data: result, error } = await context.supabase.rpc("add_ticket_payment", {
      _ticket_id: data.ticketId,
      _amount: data.monto_recibido,
      _reference: data.referencia_pago,
      _notes: data.observaciones ?? null,
    });
    if (error) {
      if (error.message.includes("payment_exceeds_balance"))
        throw new Error("El abono supera el saldo pendiente.");
      if (error.message.includes("full_payment_required"))
        throw new Error("Esta rifa requiere el pago completo.");
      throw new Error("No fue posible registrar el abono.");
    }
    return {
      ok: true,
      totalPaid: result?.[0]?.total_paid ?? t.total_abonado + data.monto_recibido,
      status: result?.[0]?.ticket_status ?? t.estado,
    };
  });

export const adminAnularTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ ticketId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticketAccess } = await supabaseAdmin
      .from("tickets")
      .select("raffle_id")
      .eq("id", data.ticketId)
      .single();
    if (!ticketAccess) throw new Error("Boleta no encontrada.");
    await assertRaffleAccess(context, ticketAccess.raffle_id);
    const { error: paymentsError } = await supabaseAdmin
      .from("ticket_payments")
      .delete()
      .eq("ticket_id", data.ticketId);
    if (paymentsError) throw new Error("No fue posible eliminar el historial de abonos.");
    const { error } = await supabaseAdmin
      .from("tickets")
      .update({
        estado: "disponible",
        nombre: null,
        telefono: null,
        ciudad: null,
        email: null,
        medio_pago: null,
        valor_pagado: null,
        fecha_compra: null,
        observaciones: null,
        premio_ganado: null,
        referencia_pago: null,
        monto_recibido: null,
        total_abonado: 0,
        numero_alterno: null,
        validado_por: null,
        validado_at: null,
      })
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateRaffle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        nombre: z.string().optional(),
        serie: z.string().nullable().optional(),
        valor_boleta: z.number().int().optional(),
        fecha_sorteo: z.string().nullable().optional(),
        loteria: z.string().nullable().optional(),
        activa: z.boolean().optional(),
        premio_mayor: z.number().int().min(0).optional(),
        premio_seco1: z.number().int().min(0).optional(),
        premio_seco2: z.number().int().min(0).optional(),
        premio_aprox_ant: z.number().int().min(0).optional(),
        premio_aprox_pos: z.number().int().min(0).optional(),
        public_skin: z.enum(PUBLIC_SKIN_IDS).optional(),
        staged_payments: z.boolean().optional(),
        installment_amount: z.number().int().min(1).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, activa, ...patch } = data;
    if (activa !== undefined) {
      const { error: activeError } = await context.supabase.rpc("set_active_raffle", {
        _raffle_id: id,
        _active: activa,
      });
      if (activeError) throw new Error("No fue posible cambiar la rifa activa.");
    }
    const { error } = await supabaseAdmin.from("raffles").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    if (patch.staged_payments === true) {
      const { error: alternateError } = await context.supabase.rpc("backfill_alternate_numbers", {
        _raffle_id: id,
      });
      if (alternateError)
        throw new Error("Se guardó la modalidad, pero no fue posible asignar números alternos.");
    }
    return { ok: true };
  });

export const organizerUpdatePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        raffleId: z.string().uuid(),
        whatsapp_admin: z.string().trim().max(30).nullable(),
        nequi: z.string().trim().max(120).nullable(),
        daviplata: z.string().trim().max(120).nullable(),
        bre_b: z.string().trim().max(160).nullable(),
        nequi_qr_url: z.string().url().nullable(),
        daviplata_qr_url: z.string().url().nullable(),
        bre_b_qr_url: z.string().url().nullable(),
        mercadopago_url: z.string().url().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const access = await getAdminAccess(context);
    if (access.role !== "organizer") {
      throw new Error("Esta configuración pertenece a la cuenta personal del arrendatario.");
    }
    await assertRaffleAccess(context, data.raffleId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { raffleId, ...settings } = data;
    const { error } = await supabaseAdmin.from("raffles").update(settings).eq("id", raffleId);
    if (error) throw new Error("No fue posible guardar los métodos de pago.");
    return { ok: true };
  });
export const adminListStages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ raffleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: stages, error } = await supabaseAdmin
      .from("raffle_draw_stages")
      .select("*")
      .eq("raffle_id", data.raffleId)
      .order("draw_at");
    if (error) throw new Error("No fue posible consultar las etapas.");
    return { stages: stages ?? [] };
  });

export const adminGetReminderCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ raffleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: settings }, { data: reminders }, { data: tickets }] = await Promise.all([
      supabaseAdmin
        .from("sponsor_reminder_settings")
        .select("*")
        .eq("raffle_id", data.raffleId)
        .maybeSingle(),
      supabaseAdmin
        .from("sponsor_reminders")
        .select("*")
        .eq("raffle_id", data.raffleId)
        .order("scheduled_for"),
      supabaseAdmin
        .from("tickets")
        .select("id, numero, nombre, telefono, total_abonado")
        .eq("raffle_id", data.raffleId),
    ]);
    const people = new Map((tickets ?? []).map((ticket) => [ticket.id, ticket]));
    return {
      settings,
      reminders: (reminders ?? []).map((reminder) => ({
        ...reminder,
        ticket: people.get(reminder.ticket_id) ?? null,
      })),
    };
  });

export const adminGetSponsorshipCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: plans, error: plansError }, { data: sponsors, error: sponsorsError }] =
      await Promise.all([
        supabaseAdmin.from("sponsorship_plans").select("*").order("created_at", {
          ascending: false,
        }),
        supabaseAdmin.from("sponsors").select("*").order("next_due_on"),
      ]);
    if (plansError || sponsorsError) throw new Error("No fue posible cargar el Plan Padrino.");
    return { plans: plans ?? [], sponsors: sponsors ?? [] };
  });

export const adminCreateSponsorshipPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(100),
        description: z.string().trim().max(500).optional(),
        monthlyAmount: z.number().int().min(1000),
        dueDay: z.number().int().min(1).max(28),
        startsOn: z.string().min(10),
        endsOn: z.string().min(10).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan, error } = await supabaseAdmin
      .from("sponsorship_plans")
      .insert({
        name: data.name,
        description: data.description || null,
        monthly_amount: data.monthlyAmount,
        due_day: data.dueDay,
        starts_on: data.startsOn,
        ends_on: data.endsOn || null,
      })
      .select("id")
      .single();
    if (error) throw new Error("No fue posible crear el plan.");
    return plan;
  });

export const adminCreateSponsor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        name: z.string().trim().min(2).max(100),
        phone: z.string().trim().min(7).max(20),
        city: z.string().trim().max(80).optional(),
        email: z.string().trim().email().optional().or(z.literal("")),
        monthlyAmount: z.number().int().min(1000),
        nextDueOn: z.string().min(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("sponsors").insert({
      plan_id: data.planId,
      name: data.name,
      phone: data.phone,
      city: data.city || null,
      email: data.email || null,
      monthly_amount: data.monthlyAmount,
      next_due_on: data.nextDueOn,
    });
    if (error) throw new Error("No fue posible registrar el padrino.");
    return { ok: true };
  });

export const adminRegisterSponsorContribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        sponsorId: z.string().uuid(),
        amount: z.number().int().min(1),
        reference: z.string().trim().max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sponsor } = await supabaseAdmin
      .from("sponsors")
      .select("next_due_on")
      .eq("id", data.sponsorId)
      .single();
    if (!sponsor) throw new Error("Padrino no encontrado.");
    const next = new Date(`${sponsor.next_due_on}T12:00:00`);
    next.setMonth(next.getMonth() + 1);
    const { error: paymentError } = await supabaseAdmin.from("sponsor_contributions").insert({
      sponsor_id: data.sponsorId,
      amount: data.amount,
      reference: data.reference || null,
    });
    if (paymentError) throw new Error("No fue posible registrar el aporte.");
    await supabaseAdmin
      .from("sponsors")
      .update({
        next_due_on: next.toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.sponsorId);
    return { ok: true };
  });

export const adminSaveReminderSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        raffleId: z.string().uuid(),
        enabled: z.boolean(),
        daysBefore: z.number().int().min(0).max(30),
        daysAfter: z.number().int().min(0).max(30),
        messageTemplate: z.string().trim().min(20).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("sponsor_reminder_settings").upsert({
      raffle_id: data.raffleId,
      enabled: data.enabled,
      days_before: data.daysBefore,
      days_after: data.daysAfter,
      message_template: data.messageTemplate,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("No fue posible guardar la programación.");
    return { ok: true };
  });

export const adminQueueSponsorReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        raffleId: z.string().uuid(),
        dueAt: z.string().datetime().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: count, error } = await context.supabase.rpc("queue_sponsor_reminders", {
      _raffle_id: data.raffleId,
      _due_at: data.dueAt ?? null,
    });
    if (error) throw new Error("No fue posible generar los recordatorios.");
    return { count: count ?? 0 };
  });

export const adminMarkReminderSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ reminderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("sponsor_reminders")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.reminderId);
    if (error) throw new Error("No fue posible actualizar el recordatorio.");
    return { ok: true };
  });

export const adminSaveStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        raffleId: z.string().uuid(),
        name: z.string().trim().min(2).max(80),
        drawAt: z.string().min(10),
        minimumPaid: z.number().int().min(1),
        prizeAmount: z.number().int().min(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const values = {
      raffle_id: data.raffleId,
      name: data.name,
      draw_at: data.drawAt,
      minimum_paid: data.minimumPaid,
      prize_amount: data.prizeAmount,
    };
    const query = data.id
      ? supabaseAdmin.from("raffle_draw_stages").update(values).eq("id", data.id)
      : supabaseAdmin.from("raffle_draw_stages").insert(values);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRegisterStageDraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ stageId: z.string().uuid(), result: z.number().int().min(0) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: result, error } = await context.supabase.rpc("register_stage_draw", {
      _stage_id: data.stageId,
      _result: data.result,
    });
    if (error) {
      if (error.message.includes("stage_not_closed"))
        throw new Error("La etapa todavía no ha llegado a su fecha y hora de cierre.");
      throw new Error("No fue posible registrar el sorteo alterno.");
    }
    return result;
  });

// Registrar sorteo
export const adminRegistrarSorteo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        raffleId: z.string().uuid(),
        premioMayor: z.number().int().min(0),
        seco1: z.number().int().min(0),
        seco2: z.number().int().min(0),
        drawDate: z.string().date(),
        drawNumber: z.string().trim().min(1).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: atomicResult, error: atomicError } = await context.supabase.rpc("register_draw", {
      _raffle_id: data.raffleId,
      _mayor: data.premioMayor,
      _seco1: data.seco1,
      _seco2: data.seco2,
      _draw_date: data.drawDate,
      _draw_number: data.drawNumber,
    });
    if (atomicError) throw new Error("No fue posible registrar el sorteo.");
    return { ganadores: atomicResult };
    /*
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const mayor = ((data.premioMayor % 100) + 100) % 100;
    const seco1 = ((data.seco1 % 100) + 100) % 100;
    const seco2 = ((data.seco2 % 100) + 100) % 100;
    const aprev = (mayor - 1 + 100) % 100;
    const apost = (mayor + 1) % 100;

    const { data: raffle } = await supabaseAdmin
      .from("raffles")
      .select("*")
      .eq("id", data.raffleId)
      .maybeSingle();
    if (!raffle) throw new Error("Rifa no encontrada");

    // Fetch tickets
    const { data: allTickets } = await supabaseAdmin
      .from("tickets")
      .select("id, numero, nombre, telefono, ciudad, estado")
      .eq("raffle_id", data.raffleId);

    type TicketRow = { id: string; numero: number; nombre: string | null; telefono: string | null; ciudad: string | null; estado: "disponible" | "reservado" | "vendido" | "ganador" };
    const byNum = new Map<number, TicketRow>();
    for (const t of (allTickets ?? []) as TicketRow[]) byNum.set(t.numero, t);

    // Aplicar orden mayor -> menor, no acumulables
    const usados = new Set<number>();
    const asignaciones: Array<{ premio: string; numero: number; monto: number }> = [];

    function asignar(premio: string, numero: number, monto: number) {
      if (usados.has(numero)) {
        asignaciones.push({ premio, numero, monto: 0 });
      } else {
        usados.add(numero);
        asignaciones.push({ premio, numero, monto });
      }
    }
    asignar("Premio Mayor", mayor, raffle.premio_mayor);
    asignar("Seco 1", seco1, raffle.premio_seco1);
    asignar("Seco 2", seco2, raffle.premio_seco2);
    asignar("Aproximación Anterior", aprev, raffle.premio_aprox_ant);
    asignar("Aproximación Posterior", apost, raffle.premio_aprox_pos);

    const ganadores = asignaciones.map((a) => {
      const t = byNum.get(a.numero);
      return {
        premio: a.premio,
        numero: a.numero,
        monto: a.monto,
        acumulado: a.monto === 0,
        nombre: t?.nombre ?? null,
        telefono: t?.telefono ?? null,
        ciudad: t?.ciudad ?? null,
        vendido: t?.estado === "vendido" || t?.estado === "ganador",
      };
    });

    // Guardar sorteo (upsert por raffle)
    await supabaseAdmin.from("draws").delete().eq("raffle_id", data.raffleId);
    const { error: dErr } = await supabaseAdmin.from("draws").insert({
      raffle_id: data.raffleId,
      premio_mayor_num: mayor,
      seco1_num: seco1,
      seco2_num: seco2,
      ganadores,
    });
    if (dErr) throw new Error(dErr.message);

    // Marcar tickets ganadores (solo los que efectivamente ganaron algo)
    // Primero limpiamos ganadores previos
    await supabaseAdmin
      .from("tickets")
      .update({ estado: "vendido", premio_ganado: null })
      .eq("raffle_id", data.raffleId)
      .eq("estado", "ganador");

    for (const g of ganadores) {
      if (g.monto > 0 && g.vendido) {
        await supabaseAdmin
          .from("tickets")
          .update({ estado: "ganador", premio_ganado: g.premio })
          .eq("raffle_id", data.raffleId)
          .eq("numero", g.numero);
      }
    }

    return { ganadores };
    */
  });

export const adminRegisterFinalStageDraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        raffleId: z.string().uuid(),
        result: z.number().int().min(0),
        drawDate: z.string().date(),
        drawNumber: z.string().trim().min(1).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: raffle } = await supabaseAdmin
      .from("raffles")
      .select("id, digitos, staged_payments, valor_boleta, premio_mayor")
      .eq("id", data.raffleId)
      .maybeSingle();
    if (!raffle?.staged_payments) throw new Error("Esta rifa no usa premio final por etapas.");
    const modulus = 10 ** raffle.digitos;
    const number = ((data.result % modulus) + modulus) % modulus;
    const { data: ticket } = await supabaseAdmin
      .from("tickets")
      .select("id, nombre, telefono, ciudad, estado, total_abonado")
      .eq("raffle_id", data.raffleId)
      .eq("numero", number)
      .maybeSingle();
    const sold =
      !!ticket &&
      ["vendido", "ganador"].includes(ticket.estado) &&
      ticket.total_abonado >= raffle.valor_boleta;
    await supabaseAdmin
      .from("tickets")
      .update({ estado: "vendido", premio_ganado: null })
      .eq("raffle_id", data.raffleId)
      .eq("estado", "ganador");
    if (sold && ticket) {
      await supabaseAdmin
        .from("tickets")
        .update({ estado: "ganador", premio_ganado: "Premio final" })
        .eq("id", ticket.id);
    }
    const winner = {
      premio: "Premio final",
      numero: number,
      monto: raffle.premio_mayor,
      acumulado: false,
      nombre: ticket?.nombre ?? null,
      telefono: ticket?.telefono ?? null,
      ciudad: ticket?.ciudad ?? null,
      vendido: sold,
    };
    const { error } = await supabaseAdmin.from("draws").insert({
      raffle_id: data.raffleId,
      premio_mayor_num: number,
      seco1_num: 0,
      seco2_num: 0,
      ganadores: [winner],
      draw_date: data.drawDate,
      draw_number: data.drawNumber,
    });
    if (error) throw new Error("No fue posible registrar el premio final.");
    return { ganadores: [winner] };
  });

export const adminGetSorteo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ raffleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: draws } = await supabaseAdmin
      .from("draws")
      .select("*")
      .eq("raffle_id", data.raffleId)
      .order("draw_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    const draw = draws?.[0];
    if (!draw) return null;
    const raw = Array.isArray(draw.ganadores) ? draw.ganadores : [];
    const ganadores = raw.map((item) => {
      const value = item && typeof item === "object" && !Array.isArray(item) ? item : {};
      return {
        premio: String(value.premio ?? value.prize ?? "Premio"),
        numero: Number(value.numero ?? value.number ?? 0),
        monto: Number(value.monto ?? value.amount ?? 0),
        acumulado: Boolean(value.acumulado ?? value.paid === false),
        nombre: typeof value.nombre === "string" ? value.nombre : null,
        telefono: typeof value.telefono === "string" ? value.telefono : null,
        ciudad: typeof value.ciudad === "string" ? value.ciudad : null,
        vendido: Boolean(value.vendido),
      };
    });
    const historial = (draws ?? []).map((item) => ({
      id: item.id,
      drawDate: item.draw_date,
      drawNumber: item.draw_number,
      premioMayor: item.premio_mayor_num,
      seco1: item.seco1_num,
      seco2: item.seco2_num,
    }));
    return { ...draw, ganadores, historial };
  });

// Otorgar rol admin al primer usuario (auto-bootstrap)
export const adminSelfBootstrap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Resolve existing admins and active organizers before first-admin bootstrap.
    try {
      const access = await getAdminAccess(context);
      return { granted: true, role: access.role, rental: access.rental };
    } catch {
      const { data: granted, error } = await context.supabase.rpc("bootstrap_first_admin");
      if (error) throw new Error("No fue posible validar los permisos de tu cuenta.");
      return {
        granted: granted === true,
        role: granted === true ? ("admin" as const) : null,
        rental: null,
      };
    }
    /*
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Si aún no hay admins, este usuario se convierte en admin.
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) === 0) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: context.userId, role: "admin" });
      return { granted: true };
    }
    // Ya hay admin(s); revisar si este usuario ya es admin
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { granted: !!existing, alreadyHasAdmin: true };
    */
  });

export const adminGetRentalCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rentals, error }, { data: raffles }, { data: usersData }] = await Promise.all([
      (supabaseAdmin as any)
        .from("raffle_rentals")
        .select(
          "id, raffle_id, user_id, responsable, prepaid_amount, starts_at, ends_at, active, notes, created_at",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("raffles").select("id, nombre, serie, slug").order("created_at", {
        ascending: false,
      }),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (error)
      throw new Error("No fue posible cargar los alquileres. Ejecuta la migración pendiente.");
    const raffleMap = new Map((raffles ?? []).map((raffle) => [raffle.id, raffle]));
    const userMap = new Map(
      (usersData?.users ?? []).map((user) => [
        user.id,
        { email: user.email ?? null, lastSignInAt: user.last_sign_in_at ?? null },
      ]),
    );
    return {
      raffles: raffles ?? [],
      rentals: (rentals ?? []).map((rental: any) => ({
        ...rental,
        raffle: raffleMap.get(rental.raffle_id) ?? null,
        account: userMap.get(rental.user_id) ?? null,
        currentlyActive:
          rental.active &&
          new Date(rental.starts_at) <= new Date() &&
          new Date(rental.ends_at) > new Date(),
      })),
    };
  });

export const adminCreateRental = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        raffleId: z.string().uuid(),
        email: z.string().trim().email(),
        password: z.string().min(8).max(72),
        responsable: z.string().trim().min(2).max(120),
        slug: z
          .string()
          .trim()
          .min(2)
          .max(80)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa letras minúsculas, números y guiones."),
        startsAt: z.string().min(10),
        endsAt: z.string().min(10),
        prepaidAmount: z.number().int().min(0),
        notes: z.string().trim().max(500).optional(),
      })
      .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
        message: "La fecha final debe ser posterior a la fecha inicial.",
        path: ["endsAt"],
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { responsable: data.responsable },
    });
    if (userError || !created.user) {
      throw new Error(
        userError?.message.includes("already")
          ? "Ya existe un usuario con ese correo."
          : "No fue posible crear el usuario.",
      );
    }
    const { error: roleError } = await (supabaseAdmin as any).from("user_roles").insert({
      user_id: created.user.id,
      role: "organizer",
    });
    const { error: rentalError } = await (supabaseAdmin as any).from("raffle_rentals").insert({
      raffle_id: data.raffleId,
      user_id: created.user.id,
      responsable: data.responsable,
      prepaid_amount: data.prepaidAmount,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      notes: data.notes || null,
    });
    if (roleError || rentalError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(
        "No fue posible asignar el alquiler. Verifica que la migración esté aplicada.",
      );
    }
    await (supabaseAdmin as any)
      .from("raffles")
      .update({ responsable: data.responsable, slug: data.slug, activa: true })
      .eq("id", data.raffleId);
    return { ok: true };
  });

export const adminSetRentalActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ rentalId: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("raffle_rentals")
      .update({ active: data.active })
      .eq("id", data.rentalId);
    if (error) throw new Error("No fue posible actualizar el alquiler.");
    return { ok: true };
  });

export const adminSetRentalPublicPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        rentalId: z.string().uuid(),
        slug: z
          .string()
          .trim()
          .min(2)
          .max(80)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rental } = await (supabaseAdmin as any)
      .from("raffle_rentals")
      .select("raffle_id")
      .eq("id", data.rentalId)
      .maybeSingle();
    if (!rental) throw new Error("Alquiler no encontrado.");
    const { error } = await (supabaseAdmin as any)
      .from("raffles")
      .update({ slug: data.slug, activa: true })
      .eq("id", rental.raffle_id);
    if (error) {
      throw new Error(
        error.code === "23505"
          ? "Esa extensión ya está siendo utilizada."
          : "No fue posible habilitar la página.",
      );
    }
    return { slug: data.slug };
  });
export const adminResetRentalPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rental } = await (supabaseAdmin as any)
      .from("raffle_rentals")
      .select("id")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!rental) throw new Error("El usuario no pertenece a un alquiler.");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error("No fue posible restablecer la contraseña.");
    return { ok: true };
  });

export const adminDeleteRentalUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("No puedes eliminar tu propia cuenta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rental } = await (supabaseAdmin as any)
      .from("raffle_rentals")
      .select("id")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!rental) throw new Error("El usuario no pertenece a un alquiler.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("No fue posible eliminar el usuario.");
    return { ok: true };
  });
