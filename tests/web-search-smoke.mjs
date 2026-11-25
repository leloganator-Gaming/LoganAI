const endpoint = "https://bphfjhmmfwsnjnbnjkjl.supabase.co/functions/v1/loganai-web-search";
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Origin": "https://leloganator-gaming.github.io" },
  body: JSON.stringify({ query: "Qu'est-ce que l'intelligence artificielle ?" }),
  signal: AbortSignal.timeout(15000)
});
if (!response.ok) throw new Error(`Web search HTTP ${response.status}: ${await response.text()}`);
const data = await response.json();
if (!Array.isArray(data.results) || data.results.length === 0) {
  throw new Error("Le moteur a répondu, mais aucun résultat exploitable n'a été extrait.");
}
for (const result of data.results) {
  if (!result.title || !/^https?:\/\//.test(result.url)) throw new Error("Résultat mal formé.");
}
console.log(`Recherche Web OK : ${data.results.length} résultat(s), fournisseur ${data.provider}.`);
console.log(data.results.map((r) => `- ${r.title} — ${r.url}`).join("\n"));
