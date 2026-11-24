(() => {
  const KEY = "loganai.browser.v1";
  let base = [], readStore = null, writeStore = null, onApprove = null;
  const $ = (s) => document.querySelector(s);
  const variants = [
    (q) => "Peux-tu m'expliquer " + q.replace(/[?.!]+$/, "") + " ?",
    (q) => "J'aimerais comprendre : " + q.replace(/^[\s¿]+/, "").replace(/[?.!]+$/, "") + ".",
    (q) => "Que faut-il savoir sur " + q.replace(/^(qu'est-ce que|c'est quoi|définis|explique)\s+/i, "").replace(/[?.!]+$/, "") + " ?",
    (q) => "Donne-moi une explication simple : " + q.replace(/[?.!]+$/, "") + ".",
    (q) => "Peux-tu répondre à cette question : " + q.replace(/[?.!]+$/, "") + " ?"
  ];
  const norm = (s) => s.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  function state() {
    const data = readStore();
    data.learning = Array.isArray(data.learning) ? data.learning : [];
    return data;
  }
  function render() {
    const root = $("#learningList");
    if (!root) return;
    root.replaceChildren();
    const data = state();
    const pending = data.learning.filter(x => x.status === "pending");
    const approved = data.learning.filter(x => x.status === "approved");
    $("#learningStatus").textContent = pending.length + " exemple(s) à vérifier · " + approved.length + " validé(s) sur cet appareil.";
    for (const item of pending) {
      const card = document.createElement("article"); card.className = "learning-item";
      const q = document.createElement("p"); q.textContent = "Utilisateur : " + item.question;
      const a = document.createElement("p"); a.textContent = "LoganAI : " + item.answer;
      const note = document.createElement("small"); note.textContent = "Reformulation générée depuis une réponse existante · contrôle automatique anti-doublon réussi";
      const approve = document.createElement("button"); approve.className = "approve"; approve.textContent = "Valider";
      approve.addEventListener("click", () => {
        const current = state(); const found = current.learning.find(x => x.id === item.id);
        if (!found) return; found.status = "approved"; writeStore(current);
        onApprove?.([found]); render();
      });
      const discard = document.createElement("button"); discard.className = "discard"; discard.textContent = "Écarter";
      discard.addEventListener("click", () => {
        const current = state(); current.learning = current.learning.filter(x => x.id !== item.id); writeStore(current); render();
      });
      card.append(q, a, note, document.createElement("br"), approve, discard); root.append(card);
    }
    if (!pending.length) {
      const empty = document.createElement("p"); empty.textContent = "Aucun exemple en attente. Générez une nouvelle série pour commencer."; root.append(empty);
    }
  }
  function generate() {
    const data = state();
    const known = new Set([...base.map(x => norm(x.question)), ...data.learning.map(x => norm(x.question))]);
    const candidates = base.filter(x => x.question && x.answer && x.answer.length > 35);
    let created = 0;
    for (let attempt = 0; attempt < candidates.length * 3 && created < 10; attempt++) {
      const source = candidates[Math.floor(Math.random() * candidates.length)];
      const make = variants[Math.floor(Math.random() * variants.length)];
      const question = make(source.question);
      const key = norm(question);
      if (key.length < 12 || known.has(key) || !source.answer.trim()) continue;
      known.add(key);
      data.learning.push({id: "gen-" + Date.now().toString(36) + "-" + created + "-" + Math.random().toString(36).slice(2,7), question, answer: source.answer, status: "pending", source: source.question, createdAt: new Date().toISOString()});
      created++;
    }
    writeStore(data); render();
    $("#learningStatus").textContent = created + " dialogue(s) généré(s). Vérifiez chaque exemple avant validation.";
  }
  function exportData() {
    const data = state().learning.filter(x => x.status === "approved").map(x => "Utilisateur : " + x.question + "\nLoganAI : " + x.answer).join("\n\n");
    if (!data) { $("#learningStatus").textContent = "Aucun dialogue validé à exporter."; return; }
    const blob = new Blob([data + "\n"], {type: "text/plain;charset=utf-8"});
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = "loganai-dialogues-valides.txt"; link.click(); URL.revokeObjectURL(url);
  }
  window.LoganSelfLearning = { init(pairs, read, write, approved) {
    base = pairs; readStore = read; writeStore = write; onApprove = approved;
    $("#generateExamples")?.addEventListener("click", generate);
    $("#exportExamples")?.addEventListener("click", exportData);
    render();
  }};
})();