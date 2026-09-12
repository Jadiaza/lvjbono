import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const resetSchema = z.object({
  responsibleId: z.string().uuid(),
  password: z.string().min(8).max(128),
  accessToken: z.string().min(20),
});

export const adminResetResponsiblePasswordWithToken = createServerFn({ method: "POST" })
  .validator((value: unknown) => resetSchema.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !authData.user) {
      throw new Error("Tu sesión de administrador venció. Vuelve a iniciar sesión.");
    }

    const { data: adminRole, error: roleError } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) throw new Error(roleError.message);
    if (!adminRole) throw new Error("Se requiere acceso de administrador.");

    const { data: responsible, error: responsibleError } = await (supabaseAdmin as any)
      .from("raffle_responsibles")
      .select("id, auth_user_id, username, display_name")
      .eq("id", data.responsibleId)
      .maybeSingle();

    if (responsibleError) throw new Error(responsibleError.message);
    if (!responsible?.auth_user_id) throw new Error("El responsable no tiene una cuenta vinculada.");

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      responsible.auth_user_id,
      { password: data.password },
    );
    if (updateError) throw new Error(updateError.message);

    const { error: profileError } = await (supabaseAdmin as any)
      .from("raffle_responsibles")
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq("id", responsible.id);
    if (profileError) throw new Error(profileError.message);

    return {
      ok: true,
      responsible: {
        id: responsible.id,
        username: responsible.username,
        display_name: responsible.display_name,
      },
    };
  });
