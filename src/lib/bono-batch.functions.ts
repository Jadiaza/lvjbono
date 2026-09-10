/* eslint-disable @typescript-eslint/no-explicit-any */
import { Buffer } from "node:buffer";
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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

async function imageToDataUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
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

    const assetCache = new Map<string, Promise<string | null>>();
    const inlineAsset = (url: string | null | undefined) => {
      if (!url) return Promise.resolve(null);
      if (!assetCache.has(url)) assetCache.set(url, imageToDataUrl(url));
      return assetCache.get(url)!;
    };

    const raffleCache = new Map<string, any>();
    for (const bono of bonos ?? []) {
      const raffle = bono.raffles;
      if (!raffle?.id || raffleCache.has(raffle.id)) continue;
      const [prizeDataUrl, sideDataUrl, logoDataUrl] = await Promise.all([
        inlineAsset(raffle.bono_prize_image_url),
        inlineAsset(raffle.bono_side_image_url),
        inlineAsset(raffle.bono_logo_url),
      ]);
      raffleCache.set(raffle.id, {
        ...raffle,
        bono_prize_image_data_url: prizeDataUrl,
        bono_side_image_data_url: sideDataUrl,
        bono_logo_data_url: logoDataUrl,
      });
    }

    const grouped = new Map<string, any>();
    for (const bono of bonos ?? []) {
      const batch = bono.raffle_bono_batches;
      const raffle = bono.raffles;
      if (!batch || !raffle) continue;
      const enrichedRaffle = raffleCache.get(raffle.id) ?? raffle;
      const current = grouped.get(batch.id) ?? {
        id: batch.id,
        code: batch.code,
        name: batch.name,
        raffle: enrichedRaffle,
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
