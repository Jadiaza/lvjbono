/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slugSchema = z.object({ slug: z.string().trim().min(2).max(100) });

export const getPublicCampaignKind = createServerFn({ method: "GET" })
  .validator((value: unknown) => slugSchema.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = (supabaseAdmin as any)
      .from("raffles")
      .select(
        "id, raffle_mode, digitos, bono_numbers_per_ticket, bono_total, nombre, slug, serie, activa, valor_boleta, fecha_sorteo, loteria, bono_title, bono_subtitle, bono_prize_name, bono_prize_description, bono_prize_dimensions, bono_prize_value, bono_prize_image_url, bono_side_image_url, bono_logo_url, bono_number_color, bono_accent_color, bono_footer_text",
      )
      .eq("activa", true);
    query = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(data.slug)
      ? query.eq("id", data.slug)
      : query.ilike("slug", data.slug);
    const { data: raffle, error } = await query.maybeSingle();
    if (error || !raffle) return { mode: "standard" as const, raffle: null, sellers: [] };
    if (!["dual_bono", "material_2d"].includes(raffle.raffle_mode)) {
      return { mode: "standard" as const, raffle: null, sellers: [] };
    }

    const [{ data: batches, error: batchesError }, { data: bonos, error: bonosError }] =
      await Promise.all([
        (supabaseAdmin as any)
          .from("raffle_bono_batches")
          .select(
            "responsible_id, raffle_responsibles(id, display_name, slug, phone, active, public_page_enabled)",
          )
          .eq("raffle_id", raffle.id)
          .not("responsible_id", "is", null),
        (supabaseAdmin as any)
          .from("raffle_bonos")
          .select("serial, status, raffle_bono_numbers(numero)")
          .eq("raffle_id", raffle.id)
          .order("serial"),
      ]);
    if (batchesError || bonosError) throw new Error("No fue posible consultar los bonos públicos.");

    const sellers = new Map<string, any>();
    for (const batch of batches ?? []) {
      const responsible = batch.raffle_responsibles;
      if (!responsible?.active || !responsible?.public_page_enabled) continue;
      sellers.set(responsible.id, {
        id: responsible.id,
        display_name: responsible.display_name,
        slug: responsible.slug,
        phone: responsible.phone,
      });
    }

    return {
      mode: raffle.raffle_mode as "dual_bono" | "material_2d",
      raffle,
      sellers: [...sellers.values()],
      bonos: (bonos ?? []).map((bono: any) => ({
        serial: bono.serial,
        status: bono.status,
        numbers: (bono.raffle_bono_numbers ?? []).map((item: any) => item.numero),
      })),
    };
  });
