const allowedOrigin = "https://leloganator-gaming.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const requests = new Map<string, number[]>();
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function clean(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}
function decodeUrl(value: string) {
  try {
    const url = new URL(value, "https://duckduckgo.com");
    if (url.hostname.endsWith("duckduckgo.com") && url.pathname === "/l/") {
      const target = url.searchParams.get("uddg");
      if (target) return target;
    }
    return url.href;
  } catch { return ""; }
}
function isRestrictedQuery(query: string) {
  return /\b(gun|firearm|ammunition|weapon|explosive|bomb|knife|switchblade|taser|pepper spray|how to make a weapon|drug|cocaine|heroin|meth|fentanyl|marijuana|cannabis|vape|nicotine|alcohol|porn|pornography|gambling|sports betting|suicide|self[- ]harm|cutting myself|dangerous challenge|choking game|stunt challenge)\b/i.test(query);
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && origin !== allowedOrigin) return new Response("Forbidden", { status: 403 });
    return new Response("ok", { headers: corsHeaders });
  }
  if (origin && origin !== allowedOrigin) return json({ error: "Origine non autorisée." }, 403);
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const recent = (requests.get(ip) || []).filter((stamp) => now - stamp < 60_000);
  if (recent.length >= 8) return json({ error: "Limite de recherche atteinte. Réessayez dans une minute." }, 429);
  recent.push(now); requests.set(ip, recent);
  try {
    const body = await req.json();
    const query = typeof body?.query === "string" ? body.query.trim().slice(0, 300) : "";
    if (query.length < 3) return json({ error: "La recherche doit contenir au moins 3 caractères." }, 400);
    if (isRestrictedQuery(query)) return json({ error: "Cette recherche n'est pas disponible dans LoganAI." }, 403);
    const response = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LoganAI/1.0; +https://leloganator-gaming.github.io/LoganAI/)", "Accept": "text/html" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return json({ error: "Le moteur de recherche est momentanément indisponible." }, 502);
    const html = (await response.text()).slice(0, 1_500_000);
    const results: Array<{ title: string; url: string; snippet: string }> = [];
    const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
    for (let i = 0; i < anchors.length; i++) {
      const attrs = anchors[i][1];
      const classes = attrs.match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
      if (!classes.split(/\s+/).includes("result__a")) continue;
      const href = attrs.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
      const url = decodeUrl(href);
      if (!url || !/^https?:\/\//i.test(url) || new URL(url).hostname.endsWith("duckduckgo.com")) continue;
      const nextAnchor = anchors.slice(i + 1).find((item) => (item[1].match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2] || "").split(/\s+/).includes("result__a"));
      const sectionEnd = nextAnchor ? html.indexOf(nextAnchor[0], anchors[i].index! + anchors[i][0].length) : html.length;
      const section = html.slice(anchors[i].index! + anchors[i][0].length, sectionEnd);
      const snippetMatch = section.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
      const title = clean(anchors[i][2]);
      if (!title) continue;
      results.push({ title: title.slice(0, 180), url, snippet: clean(snippetMatch?.[1] || "").slice(0, 420) });
      if (results.length >= 5) break;
    }
    if (!results.length) return json({ error: "Le moteur de recherche n'a fourni aucun résultat exploitable." }, 502);
    return json({ query, results, provider: "DuckDuckGo", searchedAt: new Date().toISOString() });
  } catch {
    return json({ error: "Impossible d'effectuer la recherche pour le moment." }, 502);
  }
});