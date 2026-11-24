(() => {
  let base = [], readStore = null, writeStore = null, onApprove = null, initialized = false;
  const $ = (s) => document.querySelector(s);
  const generateButton = $("#generateExamples");
  const exportButton = $("#exportExamples");
  const variants = [
    (q) => "Peux-tu m'expliquer " + q.replace(/[?.!]+$/, "") + " ?",
    (q) => "J'aimerais comprendre : " + q.replace(/^[\\s¿]+/, "").replace(/[?.!]+$/, "") + ".",
    (q) => "Que faut-il savoir sur " + q.replace(/^(qu'est-ce que|c'est quoi|définis|explique)\\s+/i, "").replace(/[?.!]+$/, "") + " ?",
    (q) => "Donne-moi une explication simple : " + q.replace(/[?.!]+$/, "") + ".",
    (q) => "Peux-tu répondre à cette question : " + q.replace(/[?.!]+$/, "") + " ?"
  ];
  const norm = (s) => s.toLocaleLowerCase("fr").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  function state() {
    const data = readStore();
    data.learning = Array.isArray(data.learning) ? data.learning : [];
    return data;
  }
  function status(message) {
    const node = $("#learningStatus");
    if (node) node.textContent = message;
  }
  function render() {
    const root = $("#learningList");
    if (!root || !initialized) return;
    root.replaceChildren();
    const data = state();
    const pending = data.learning.filter(x => x.status === "pending");
    const approved = data.learning.filter(x => x.status === "approved");
    status(pending.length + " exemple(s) à vérifier · " + approved.length + " validé(s) sur cet appareil.");
    for (const item of pending) {
      const card = document.createElement("article"); card.className = "learning-item";
      const q = document.createElement("p"); q.textContent = "Utilisateur : " + item.question;
      const a = document.createElement("p"); a.textContent = "LoganAI : " + item.answer;
      const note = document.createElement("small"); note.textContent = "Reformulation générée depuis une réponse existante · vérifiez son exactitude";
      const approve = document.createElement("button"); approve.className = "approve"; approve.textContent = "Valider";
      approve.addEventListener("click", () => {
        const current = state(); const found = current.learning.find(x => x.id === item.id);
        if (!found) return;
        found.status = "approved"; writeStore(current);
        onApprove?.([found]); render();
      });
      const discard = document.createElement("button"); discard.className = "discard"; discard.textContent = "Écarter";
      discard.addEventListener("click", () => {
        const current = state(); current.learning = current.learning.filter(x => x.id !== item.id);
        writeStore(current); render();
      });
      card.append(q, a, note, document.createElement("br"), approve, discard); root.append(card);
    }
    if (!pending.length) {
      const empty = document.createElement("p");
      empty.textContent = "Aucun exemple en attente. Générez une nouvelle série pour commencer.";
      root.append(empty);
    }
  }
  function generate() {
    if (!initialized) {
      status("La base de connaissances n'est pas encore prête. Rechargez la page dans quelques instants.");
      return;
    }
    try {
      const data = state();
      const known = new Set([...base.map(x => norm(x.question)), ...data.learning.map(x => norm(x.question))]);
      const candidates = base.filter(x => x.question && x.answer && x.answer.trim().length > 35);
      if (!candidates.length) {
        status("Aucune réponse source exploitable n'a été chargée. Vérifiez que knowledge.txt est accessible.");
        return;
      }
      let created = 0;
      for (let attempt = 0; attempt < candidates.length * 8 && created < 10; attempt++) {
        const source = candidates[Math.floor(Math.random() * candidates.length)];
        const make = variants[Math.floor(Math.random() * variants.length)];
        const question = make(source.question);
        const key = norm(question);
        if (key.length < 12 || known.has(key) || !source.answer.trim()) continue;
        known.add(key);
        data.learning.push({
          id: "gen-" + Date.now().toString(36) + "-" + created + "-" + Math.random().toString(36).slice(2,7),
          question, answer: source.answer, status: "pending", source: source.question,
          createdAt: new Date().toISOString()
        });
        created++;
      }
      writeStore(data); render();
      status(created
        ? created + " dialogue(s) généré(s). Vérifiez chaque exemple avant validation."
        : "Aucun nouvel exemple : les reformulations possibles existent déjà. Ajoutez des connaissances variées puis réessayez.");
    } catch (error) {
      console.error("Erreur d'auto-apprentissage :", error);
      status("Échec de la génération : " + (error?.message || "erreur inconnue") + ". Vérifiez le stockage du navigateur.");
    }
  }
  function exportData() {
    if (!initialized) { status("La base n'est pas encore prête."); return; }
    try {
      const data = state().learning.filter(x => x.status === "approved")
        .map(x => "Utilisateur : " + x.question + "\\nLoganAI : " + x.answer).join("\\n\\n");
      if (!data) { status("Aucun dialogue validé à exporter."); return; }
      const blob = new Blob([data + "\\n"], {type: "text/plain;charset=utf-8"});
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = "loganai-dialogues-valides.txt"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status("Export prêt : loganai-dialogues-valides.txt");
    } catch (error) {
      status("Échec de l'export : " + (error?.message || "erreur inconnue"));
    }
  }
  generateButton?.addEventListener("click", generate);
  exportButton?.addEventListener("click", exportData);
  window.LoganSelfLearning = {
    init(pairs, read, write, approved) {
      if (initialized) return;
      base = Array.isArray(pairs) ? pairs : [];
      readStore = read; writeStore = write; onApprove = approved; initialized = true;
      const savedApproved = state().learning.filter(x => x.status === "approved");
      if (savedApproved.length) onApprove?.(savedApproved);
      render();
    }
  };
  if (!generateButton || !exportButton) console.error("Interface d'auto-apprentissage incomplète.");
})();