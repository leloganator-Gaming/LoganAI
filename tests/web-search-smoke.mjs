const endpoint = "https://bphfjhmmfwsnjnbnjkjl.supabase.co/functions/v1/loganai-web-search";
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Origin": "https://leloganator-gaming.github.io" },
  body: JSON.stringify({ query: "intelligence artificielle définition" }),
  signal: AbortSignal.timeout(15000)
});
if (!response.ok) throw new Error(`Web search HTTP ${response.status}: ${await response.text()}`);
const data = await response.json();
if (!Array.isArray(data.results) || data.results.length === 0) {
  throw new Error("Le moteur a répondu, mais aucun résultat exploitable n'a été extrait.");
}
if (!data.results.some((item) => /intelligence.*artificielle|artificielle.*intelligence/i.test(`${item.title} ${item.snippet}`))) {
  throw new Error("Aucun résultat ne correspond clairement au sujet « intelligence artificielle ».");
}
if (typeof data.summary !== "string" || data.summary.length < 80) {
  throw new Error("La synthèse des pages Web est absente ou trop courte.");
}
if (!data.results.some((item) => item.contentExtracted && item.summary?.length > 80)) {
  throw new Error("Aucune page source n'a pu être récupérée et analysée.");
}
for (const result of data.results) {
  if (!result.title || !/^https?:\/\//.test(result.url)) throw new Error("Résultat mal formé.");
}
console.log(`Recherche Web OK : ${data.results.length} résultat(s), fournisseur ${data.provider}.`);
console.log(data.results.map((r) => `- ${r.title} — ${r.url}`).join("\n"));
