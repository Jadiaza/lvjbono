import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function getPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("El servicio no está configurado temporalmente.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
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
      "id, nombre, serie, digitos, valor_boleta, fecha_sorteo, loteria, activa, whatsapp_admin, nequi, daviplata, bre_b, premio_mayor, premio_seco1, premio_seco2, premio_aprox_ant, premio_aprox_pos",
    )
    .eq("activa", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (raffleError) throw new Error("No fue posible cargar la rifa.");
  if (!raffle) return { raffle: null, tickets: [], setupRequired: false };

  const { data: tickets, error: ticketsError } = await s.rpc("get_public_tickets", {
    _raffle_id: raffle.id,
  });
  if (ticketsError) {
    if (ticketsError.code === "PGRST202") {
      console.error("[getRaffleData] public ticket RPC is not installed");
      return { raffle, tickets: [], setupRequired: true };
    }
    throw new Error("No fue posible cargar el talonario.");
  }

  return {
    raffle,
    tickets: (tickets ?? []).sort((a, b) => a.numero - b.numero),
    setupRequired: false,
  };
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
        medio_pago: z.enum(["nequi", "daviplata", "bre_b", "transferencia"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
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

    return { codigo: updated.codigo_verificacion, numero: updated.numero };
  });

export const getBoletaByCodigo = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ codigo: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select(
        "numero, estado, nombre, telefono, ciudad, email, medio_pago, valor_pagado, fecha_compra, codigo_verificacion, premio_ganado, raffle_id",
      )
      .eq("codigo_verificacion", data.codigo)
      .maybeSingle();
    if (ticketError) throw new Error("No fue posible consultar la boleta.");
    if (!t) return null;
    const { data: r, error: raffleError } = await supabaseAdmin
      .from("raffles")
      .select("nombre, digitos, fecha_sorteo, loteria, whatsapp_admin, nequi, daviplata, bre_b")
      .eq("id", t.raffle_id)
      .maybeSingle();
    if (raffleError) throw new Error("No fue posible consultar la rifa.");
    return { ticket: t, raffle: r };
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

export const adminListRaffles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: raffles } = await supabaseAdmin
      .from("raffles")
      .select("*")
      .order("created_at", { ascending: false });
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
    return { raffles: enriched };
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
      })
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
          premio_seco1: data.premio_seco1,
          premio_seco2: data.premio_seco2,
          premio_aprox_ant: data.premio_aprox_ant,
          premio_aprox_pos: data.premio_aprox_pos,
          activa: false,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
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
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let raffle: Database["public"]["Tables"]["raffles"]["Row"] | null = null;
    if (data?.raffleId) {
      const { data: r } = await supabaseAdmin
        .from("raffles")
        .select("*")
        .eq("id", data.raffleId)
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
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

// Validar y confirmar pago (reservado -> vendido)
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
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin
      .from("tickets")
      .select("id, estado, valor_pagado, raffle_id")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!t) throw new Error("Boleta no encontrada");
    if (t.estado !== "reservado") throw new Error("Solo se pueden validar boletas reservadas");
    const esperado = t.valor_pagado ?? 0;
    if (esperado > 0 && data.monto_recibido < esperado) {
      throw new Error(
        `El monto recibido ($${data.monto_recibido.toLocaleString("es-CO")}) es menor al valor de la boleta ($${esperado.toLocaleString("es-CO")}).`,
      );
    }
    const { error } = await supabaseAdmin
      .from("tickets")
      .update({
        estado: "vendido",
        referencia_pago: data.referencia_pago,
        monto_recibido: data.monto_recibido,
        observaciones: data.observaciones ?? null,
        validado_por: context.userId,
        validado_at: new Date().toISOString(),
      })
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAnularTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ ticketId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
        whatsapp_admin: z.string().nullable().optional(),
        nequi: z.string().nullable().optional(),
        daviplata: z.string().nullable().optional(),
        bre_b: z.string().nullable().optional(),
        premio_mayor: z.number().int().min(0).optional(),
        premio_seco1: z.number().int().min(0).optional(),
        premio_seco2: z.number().int().min(0).optional(),
        premio_aprox_ant: z.number().int().min(0).optional(),
        premio_aprox_pos: z.number().int().min(0).optional(),
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
    return { ok: true };
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

export const adminGetSorteo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ raffleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: draw } = await supabaseAdmin
      .from("draws")
      .select("*")
      .eq("raffle_id", data.raffleId)
      .maybeSingle();
    return draw;
  });

// Otorgar rol admin al primer usuario (auto-bootstrap)
export const adminSelfBootstrap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: granted, error } = await context.supabase.rpc("bootstrap_first_admin");
    if (error) throw new Error("No fue posible validar permisos administrativos.");
    return { granted: granted === true, alreadyHasAdmin: granted !== true };
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
