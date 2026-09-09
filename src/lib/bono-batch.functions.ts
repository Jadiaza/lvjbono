/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AuthContext = { supabase: any; userId: string };

async function getResponsible(context: AuthContext) {
  const { data, error } = await context.supabase
    .from("raffle_responsibles")
    .select("id, display_name, username, phone, active")
    .eq("auth_user_id", context.userId)
    .eq("active", true)
    .maybeSingle();
  if (error || !data) throw new Error("Tu cuenta de responsable no está activa.");
  return data as any;
}

export const responsibleGetOfferBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const responsible = await getResponsible(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bonos, error } = await (supabaseAdmin as any)
      .from("raffle_bonos")
      .select(
        "id, serial, status, verification_code, current_batch_id, raffle_id, buyer_name, buyer_phone, buyer_city, buyer_notes, amount_paid, sale_value, raffle_bono_numbers(option_number, numero), raffle_bono_batches(id, code, name), raffles(id, nombre, valor_boleta, fecha_sorteo, loteria, bono_title, bono_subtitle, bono_prize_name, bono_prize_description, bono_prize_dimensions, bono_prize_image_url, bono_side_image_url, bono_logo_url, bono_number_color, bono_accent_color, bono_footer_text, bono_show_qr, bono_show_platform_branding)",
      )
      .eq("current_responsible_id", responsible.id)
      .not("current_batch_id", "is", null)
      .order("serial");
    if (error) throw new Error(error.message);

    const grouped = new Map<string, any>();
    for (const bono of bonos ?? []) {
      const batch = bono.raffle_bono_batches;
      const raffle = bono.raffles;
      if (!batch || !raffle) continue;
      const current = grouped.get(batch.id) ?? {
        id: batch.id,
        code: batch.code,
        name: batch.name,
        raffle,
        bonos: [],
      };
      current.bonos.push(bono);
      grouped.set(batch.id, current);
    }

    return {
      responsible,
      batches: [...grouped.values()].sort((a, b) => String(a.code).localeCompare(String(b.code))),
    };
  });
