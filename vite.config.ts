// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const lovableConfig = defineConfig({
  // Lovable overrides this only inside its own sandbox; Vercel/CI uses this preset.
  nitro: { preset: "vercel" },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this.
    server: { entry: "server" },
  },
});

export default async function config(env: Parameters<typeof lovableConfig>[0]) {
  const resolved = await lovableConfig(env);

  // Lovable 2.7.7 still installs the legacy plugin unconditionally. Vite 8
  // resolves tsconfig paths natively, so keep the wrapper and replace only
  // that plugin until Lovable publishes native support.
  resolved.plugins = resolved.plugins?.filter(
    (plugin) =>
      !plugin ||
      Array.isArray(plugin) ||
      typeof plugin !== "object" ||
      !("name" in plugin) ||
      plugin.name !== "vite-tsconfig-paths",
  );
  resolved.resolve = {
    ...resolved.resolve,
    tsconfigPaths: true,
  };

  return resolved;
}
