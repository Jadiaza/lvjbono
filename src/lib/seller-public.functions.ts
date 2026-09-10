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

    return {
      responsible,
      bonos: bonos ?? [],
    };
  });
