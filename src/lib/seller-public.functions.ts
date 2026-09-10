/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const sellerSlugSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,80}$/),
});

export const getPublicSellerPage = createServerFn({ method: "GET" })
  .validator((value: unknown) => sellerSlugSchema.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: responsible, error: responsibleError } = await (supabaseAdmin as any)
      .from("raffle_responsibles")
      .select("id, display_name, username, phone, slug, active, public_page_enabled")
      .or(`slug.eq.${data.slug},username.eq.${data.slug}`)
      .eq("active", true)
      .eq("public_page_enabled", true)
      .maybeSingle();

    if (responsibleError || !responsible) throw new Error("Página no disponible.");

    const { data: bonos, error: bonosError } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select(
        "id, serial, verification_code, status, raffle_id, raffle_bono_numbers(option_number, numero), raffles(id, nombre, slug, valor_boleta, fecha_sorteo, loteria, bono_title, bono_subtitle, bono_prize_name, bono_prize_description, bono_prize_dimensions, bono_prize_image_url, bono_side_image_url, bono_logo_url, bono_number_color, bono_accent_color, bono_footer_text)",
      )
      .eq("current_responsible_id", responsible.id)
      .order("serial");

    if (bonosError) throw new Error(bonosError.message);

    return { responsible, bonos: bonos ?? [] };
  });

const publicReservationSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,80}$/),
  bonoId: z.string().uuid(),
  buyer_name: z.string().trim().min(2).max(120),
  buyer_phone: z.string().trim().min(7).max(30),
  buyer_city: z.string().trim().max(100).optional().default(""),
  buyer_notes: z.string().trim().max(500).optional().default(""),
});

export const reservePublicSellerBono = createServerFn({ method: "POST" })
  .validator((value: unknown) => publicReservationSchema.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: responsible, error: responsibleError } = await (supabaseAdmin as any)
      .from("raffle_responsibles")
      .select("id, display_name, phone")
      .or(`slug.eq.${data.slug},username.eq.${data.slug}`)
      .eq("active", true)
      .eq("public_page_enabled", true)
      .maybeSingle();
    if (responsibleError || !responsible) throw new Error("Responsable no disponible.");

    const { data: bono, error: bonoError } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select("id, raffle_id, serial, status, current_responsible_id, raffle_bono_numbers(option_number, numero)")
      .eq("id", data.bonoId)
      .eq("current_responsible_id", responsible.id)
      .maybeSingle();
    if (bonoError || !bono) throw new Error("Bono no encontrado.");
    if (bono.status !== "asignado") throw new Error("Este bono ya no está disponible.");

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await (supabaseAdmin as any)
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
      .eq("current_responsible_id", responsible.id)
      .select("id")
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (!updated) throw new Error("Este bono acaba de ser reservado por otra persona.");

    await (supabaseAdmin as any).from("raffle_bono_events").insert({
      raffle_id: bono.raffle_id,
      bono_id: bono.id,
      responsible_id: responsible.id,
      event_type: "reserva_publica",
      from_status: "asignado",
      to_status: "reservado",
      metadata: {
        buyer_name: data.buyer_name,
        buyer_phone: data.buyer_phone,
        source: "seller_public_page",
      },
    });

    return {
      ok: true,
      bono: {
        id: bono.id,
        serial: bono.serial,
        numbers: [...(bono.raffle_bono_numbers ?? [])]
          .sort((a: any, b: any) => a.option_number - b.option_number)
          .map((n: any) => n.numero),
      },
      responsible: {
        display_name: responsible.display_name,
        phone: responsible.phone,
      },
    };
  });
