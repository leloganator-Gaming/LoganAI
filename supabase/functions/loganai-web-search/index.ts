const allowedOrigin = "https://leloganator-gaming.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const requests = new Map<string, number[]>();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
function clean(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ").trim();
}
function decodeUrl(value: string) {
  try {
    const url = new URL(value, "https://www.bing.com");
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.href;
  } catch { return ""; }
}
function isSafePublicUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (!host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return false;
    return true;
  } catch { return false; }
}
function isRestrictedQuery(query: string) {
  return /\b(gun|firearm|ammunition|weapon|explosive|bomb|knife|switchblade|taser|pepper spray|how to make a weapon|drug|cocaine|heroin|meth|fentanyl|marijuana|cannabis|vape|nicotine|alcohol|porn|pornography|gambling|sports betting|suicide|self[- ]harm|cutting myself|dangerous challenge|choking game|stunt challenge|arme|munitions|explosif|bombe|couteau|drogue|cocaïne|héroïne|cannabis|vapotage|alcool|pornographie|suicide|automutilation|jeu dangereux)\b/i.test(query);
}
async function readLimited(response: Response, maxBytes = 220_000) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = value.subarray(0, maxBytes - total);
    chunks.push(chunk);
    total += chunk.length;
    if (chunk.length !== value.length) break;
  }
  try { await reader.cancel(); } catch { /* ignore */ }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}
function summarize(text: string, query: string) {
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length >= 45 && s.length <= 420);
  const terms = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]{4,}/g) || [];
  const ranked = sentences.map((sentence, index) => {
    const normalized = sentence.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const hits = terms.filter((term) => normalized.includes(term)).length;
    return { sentence, index, score: hits / Math.max(1, terms.length) + Math.min(sentence.length, 240) / 2400 };
  }).filter((item) => item.score > 0.08).sort((a, b) => b.score - a.score).slice(0, 3).sort((a, b) => a.index - b.index);
  return ranked.map((item) => item.sentence).join(" ").slice(0, 850);
}
async function fetchPage(url: string, query: string) {
  if (!isSafePublicUrl(url)) return null;
  try {
    let current = url;
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(current, {
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LoganAI/1.0)", "Accept": "text/html, text/plain;q=0.9" },
        signal: AbortSignal.timeout(6_000),
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) return null;
        const next = new URL(location, current).href;
        if (!isSafePublicUrl(next)) return null;
        current = next;
        continue;
      }
      break;
    }
    if (!response?.ok) return null;
    const type = response.headers.get("content-type") || "";
    if (!/text\/(html|plain)|application\/(xhtml\+xml|xml)/i.test(type)) return null;
    const raw = await readLimited(response);
    const title = clean(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const withoutNoise = raw
      .replace(/<(script|style|noscript|svg|nav|footer|header|aside)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(main|article)\b[^>]*>/gi, " ")
      .replace(/<\/(main|article)>/gi, " ");
    const text = clean(withoutNoise).slice(0, 35_000);
    const summary = summarize(text, query);
    if (!summary) return null;
    return { pageTitle: title.slice(0, 180), summary, extracted: true };
  } catch {
    return null;
  }
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
  recent.push(now);
  requests.set(ip, recent);
  try {
    const body = await req.json();
    const query = typeof body?.query === "string" ? body.query.trim().slice(0, 300) : "";
    if (query.length < 3) return json({ error: "La recherche doit contenir au moins 3 caractères." }, 400);
    if (isRestrictedQuery(query)) return json({ error: "Cette recherche n'est pas disponible dans LoganAI." }, 403);

    const response = await fetch("https://www.bing.com/search?format=rss&q=" + encodeURIComponent(query), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LoganAI/1.0)", "Accept": "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return json({ error: "Le moteur de recherche est momentanément indisponible." }, 502);
    const xml = (await response.text()).slice(0, 1_500_000);
    const results: Array<{ title: string; url: string; snippet: string }> = [];
    for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
      const item = match[1];
      const title = clean(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
      const url = decodeUrl(clean(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || ""));
      const snippet = clean(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "");
      if (!title || !url || !isSafePublicUrl(url) || new URL(url).hostname.endsWith("bing.com")) continue;
      results.push({ title: title.slice(0, 180), url, snippet: snippet.slice(0, 420) });
      if (results.length >= 5) break;
    }
    if (!results.length) return json({ error: "Le moteur de recherche n'a fourni aucun résultat exploitable." }, 502);

    const pages = await Promise.all(results.slice(0, 3).map((item) => fetchPage(item.url, query)));
    const enriched = results.map((item, index) => ({
      ...item,
      pageTitle: pages[index]?.pageTitle || item.title,
      summary: pages[index]?.summary || item.snippet,
      contentExtracted: Boolean(pages[index]?.extracted),
    }));
    return json({
      query,
      results: enriched,
      summary: enriched.map((item, index) => (index + 1) + ". " + item.pageTitle + " : " + item.summary).join("\n\n").slice(0, 2_800),
      provider: "Bing",
      searchedAt: new Date().toISOString(),
    });
  } catch {
    return json({ error: "Impossible d'effectuer la recherche pour le moment." }, 502);
  }
});
