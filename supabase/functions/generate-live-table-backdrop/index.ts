import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

const MODEL = "@cf/black-forest-labs/flux-1-schnell";
const BUCKET = "live-table";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function sanitizePaths(value: unknown, prefix: string) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter(path => typeof path === "string" && path.startsWith(prefix) && !path.includes(".."))
    .slice(0, 12))];
}

function buildPrompt(userPrompt: string, style: string) {
  const aestra = [
    "Widescreen environmental backdrop for the fantasy world Aestra.",
    "Painterly anime-fantasy environment art, ecological science-fantasy, ancient weathered relic technology, crystal energy, brass and stone machinery, lush natural detail, mysterious ruins, melancholy beauty, enormous sense of scale.",
    "Cinematic background composition for an in-person tabletop RPG display, landscape only, no foreground character portrait, no readable text, no captions, no logos, no UI, no borders.",
    "Keep the extreme lower edge relatively calm so a party HUD can sit over the image. Strong depth, atmospheric perspective, natural lighting, detailed clouds and terrain."
  ];
  const storybook = [
    "Classic hand-painted Japanese fantasy-animation background feeling.",
    "Soft watercolor and gouache textures, delicate ink-like detail, whimsical but believable architecture, warm natural light, expressive clouds, gentle color transitions, richly observed plants and weather.",
    "Beautiful and inviting at first glance with subtle danger beneath the surface; avoid glossy 3D rendering and photorealism."
  ];
  const parts = [...aestra];
  if (style === "storybook") parts.push(...storybook);
  parts.push("Scene request: " + userPrompt);
  return parts.join("\n").slice(0, 1980);
}

async function runFlux(accountId: string, apiToken: string, prompt: string, seed: number, steps: number) {
  const endpoint = "https://api.cloudflare.com/client/v4/accounts/" + accountId + "/ai/run/" + MODEL;
  const requestBody = {
    prompt,
    seed,
    steps,
    width: 1536,
    height: 864
  };

  let response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  // Older model deployments may not expose explicit dimensions. Retry without
  // them rather than failing the whole Live Table generator.
  if (!response.ok && response.status === 400) {
    const firstError = await response.text();
    if (/width|height|dimension/i.test(firstError)) {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt, seed, steps })
      });
    } else {
      throw new Error("Cloudflare image generation failed: " + firstError.slice(0, 500));
    }
  }

  const raw = await response.text();
  let data: any = null;
  try { data = JSON.parse(raw); } catch (_) {}

  if (!response.ok) {
    const message = data?.errors?.[0]?.message || data?.error || raw || "Cloudflare image generation failed.";
    throw new Error(String(message).slice(0, 700));
  }

  const image = data?.result?.image || data?.image;
  if (!image || typeof image !== "string") {
    throw new Error("Cloudflare returned no image data.");
  }
  return decodeBase64(image);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Sign in required." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");

    if (!accountId || !apiToken) {
      return json({
        error: "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN need to be added to Supabase Edge Function secrets.",
        code: "CLOUDFLARE_CREDENTIALS_MISSING"
      }, 503);
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const token = authHeader.slice(7);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid session." }, 401);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("is_gm")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || profile?.is_gm !== true) return json({ error: "GM access required." }, 403);

    const body = await req.json();
    const action = body?.action === "save" ? "save" : "generate";
    const campaignId = String(body?.campaignId || "").trim();
    const name = String(body?.name || "Generated Scene").trim().slice(0, 80);
    const subtitle = String(body?.subtitle || "").trim().slice(0, 120);
    const userPrompt = String(body?.prompt || "").trim().slice(0, 1100);
    const quality = ["low", "medium", "high"].includes(body?.quality) ? body.quality : "medium";
    const style = body?.style === "aestra" ? "aestra" : "storybook";

    if (!campaignId) return json({ error: "Campaign is required." }, 400);
    const previewPrefix = campaignId + "/ai/previews/";

    if (action === "save") {
      const selectedPath = String(body?.selectedPath || "");
      const previewPaths = sanitizePaths(body?.previewPaths, previewPrefix);
      if (!selectedPath.startsWith(previewPrefix) || selectedPath.includes("..") || !previewPaths.includes(selectedPath)) {
        return json({ error: "That generated preview is not valid for this campaign." }, 400);
      }

      const download = await admin.storage.from(BUCKET).download(selectedPath);
      if (download.error || !download.data) return json({ error: download.error?.message || "Could not load the selected preview." }, 500);

      const finalPath = campaignId + "/ai/" + crypto.randomUUID() + ".jpg";
      const bytes = new Uint8Array(await download.data.arrayBuffer());
      const upload = await admin.storage.from(BUCKET).upload(finalPath, bytes, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false
      });
      if (upload.error) return json({ error: upload.error.message }, 500);

      const publicUrl = admin.storage.from(BUCKET).getPublicUrl(finalPath).data.publicUrl;
      const { data: asset, error: assetError } = await admin
        .from("live_table_assets")
        .insert({
          campaign_id: campaignId,
          kind: "scene",
          name,
          subtitle,
          image_url: publicUrl,
          storage_path: finalPath,
          metadata: {
            generated: true,
            generator: "cloudflare-workers-ai",
            model: MODEL,
            quality,
            style,
            prompt: userPrompt,
            generation_id: String(body?.generationId || "").slice(0, 100)
          },
          created_by: userData.user.id
        })
        .select()
        .single();

      if (assetError) {
        await admin.storage.from(BUCKET).remove([finalPath]);
        return json({ error: assetError.message }, 500);
      }

      if (previewPaths.length) {
        const cleanup = await admin.storage.from(BUCKET).remove(previewPaths);
        if (cleanup.error) console.warn("Preview cleanup failed", cleanup.error.message);
      }

      return json({ asset });
    }

    if (!userPrompt) return json({ error: "Scene name and prompt are required." }, 400);

    const cleanupPaths = sanitizePaths(body?.cleanupPaths, previewPrefix);
    if (cleanupPaths.length) {
      const cleanup = await admin.storage.from(BUCKET).remove(cleanupPaths);
      if (cleanup.error) console.warn("Previous preview cleanup failed", cleanup.error.message);
    }

    const variations = Math.max(2, Math.min(4, Number(body?.variations) || 4));
    const steps = quality === "high" ? 8 : quality === "low" ? 4 : 6;
    const prompt = buildPrompt(userPrompt, style);
    const generationId = crypto.randomUUID();

    const attempts = await Promise.allSettled(
      Array.from({ length: variations }, async (_, index) => {
        const seed = crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647;
        const bytes = await runFlux(accountId, apiToken, prompt, seed, steps);
        const path = previewPrefix + generationId + "/" + (index + 1) + ".jpg";
        const upload = await admin.storage.from(BUCKET).upload(path, bytes, {
          contentType: "image/jpeg",
          cacheControl: "900",
          upsert: false
        });
        if (upload.error) throw new Error(upload.error.message);
        const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        return { path, url, seed };
      })
    );

    const previews = attempts
      .filter((result): result is PromiseFulfilledResult<{path:string;url:string;seed:number}> => result.status === "fulfilled")
      .map(result => result.value);

    const failures = attempts.filter(result => result.status === "rejected");
    failures.forEach(result => console.warn("Backdrop variation failed", (result as PromiseRejectedResult).reason));

    if (!previews.length) {
      const first = failures[0] as PromiseRejectedResult | undefined;
      const message = first?.reason instanceof Error ? first.reason.message : "All image variations failed.";
      return json({ error: message }, 502);
    }

    return json({
      generationId,
      previews,
      failed: failures.length,
      expandedPrompt: prompt
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected generation error." }, 500);
  }
});
