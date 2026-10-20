(function () {
  const CFG = window.BTN_CONFIG || {};
  const INTENTS = [
    { k: "eat", l: "ΦΑΕ", s: "Κουζίνες, καφενεία, φούρνοι" },
    { k: "shop", l: "ΑΓΟΡΑΣΕ", s: "Παντοπωλεία, εργαστήρια" },
    { k: "visit", l: "ΠΗΓΑΙΝΕ", s: "Χώροι, εκδηλώσεις" },
    { k: "help", l: "ΒΟΗΘΗΣΕ", s: "Χρόνος, δεξιότητες, υλικά" }
  ];
  const LABEL_TO_KEY = { "ΦΑΕ": "eat", "ΑΓΟΡΑΣΕ": "shop", "ΠΗΓΑΙΝΕ": "visit", "ΒΟΗΘΗΣΕ": "help" };
  const VERB = { eat: "φάω", shop: "ψωνίσω", visit: "επισκεφθώ έναν χώρο", help: "βοηθήσω" };
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const split = (s) => String(s || "").split(/[;\n]/).map((x) => x.trim()).filter(Boolean);
  const yes = (s) => /^(ναι|yes|true|1|x)$/i.test(String(s || "").trim());
  const color = (k) => getComputedStyle(document.documentElement).getPropertyValue("--" + k).trim();

  const state = { intent: "", area: "", trait: "" };
  let DATA = [];
  let map, layer;

  function normalize(r) {
    const cats = String(r.intents || "").split(/[,;]/).map((x) => LABEL_TO_KEY[x.trim().toUpperCase()] || null).filter(Boolean);
    const lat = parseFloat(String(r.lat || "").replace(",", "."));
    const lng = parseFloat(String(r.lng || "").replace(",", "."));
    const vis = /limited/i.test(r.visibility) ? "limited" : "public";
    const traits = split(r.traits);
    const legal = String(r.legal_form || "").trim();
    if (legal && !traits.some((t) => legal.toLowerCase().startsWith(t.toLowerCase()))) traits.unshift(legal);
    return {
      name: String(r.name || "").trim(), area: String(r.area || "").trim(), address: r.address || "",
      ll: isFinite(lat) && isFinite(lng) ? [lat, lng] : null, cats: cats.length ? cats : ["visit"],
      legal, verified: yes(r.legal_verified), traits,
      self: r.self_description || "", desc: r.description || "", how: r.how_it_works || "",
      hours: r.hours || "", link: String(r.website || "").trim(), events: yes(r.hosts_events),
      support: split(r.how_to_support), needs: split(r.current_needs), vis,
      confirmed: String(r.last_confirmed || "").trim()
    };
  }

  function load() {
    const url = CFG.SHEET_CSV_URL || "example.csv";
    if (!CFG.SHEET_CSV_URL) notice("Δοκιμαστική έκδοση: τα εγχειρήματα είναι φανταστικά παραδείγματα μέχρι να συνδεθεί το Google Sheet.");
    Papa.parse(url, {
      download: true, header: true, skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        DATA = res.data
          .filter((r) => String(r.consent || "").trim().toUpperCase() === String(CFG.CONSENT_VALUE || "ΝΑΙ").toUpperCase())
          .filter((r) => !/private/i.test(r.visibility || ""))
          .map(normalize).filter((d) => d.name);
        DATA.forEach((d, i) => (d.id = i));
        setup();
      },
      error: () => { $("#list").innerHTML = `<div class="empty">Δεν φορτώθηκαν τα δεδομένα. Δοκίμασε ξανά σε λίγο.</div>`; }
    });
  }

  function notice(t) { $("#noticeText").textContent = t; $("#notice").hidden = false; }

  function setup() {
    $("#intents").innerHTML = INTENTS.map((i) => `<button class="intent" data-k="${i.k}" aria-pressed="false" style="--c:var(--${i.k})"><span class="dot" style="background:var(--${i.k})"></span><b>${i.l}</b><small>${i.s}</small></button>`).join("");
    $("#intents").onclick = (e) => { const b = e.target.closest(".intent"); if (!b) return; state.intent = state.intent === b.dataset.k ? "" : b.dataset.k; render(); };
    const areas = [...new Set(DATA.map((d) => d.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, "el"));
    $("#area").innerHTML = `<option value="">Όλη η Αθήνα</option>` + areas.map((a) => `<option>${esc(a)}</option>`).join("");
    $("#area").onchange = (e) => { state.area = e.target.value; render(); };
    const counts = {};
    DATA.forEach((d) => d.traits.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
    const traits = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 12);
    $("#traits").innerHTML = traits.map((t) => `<button class="chip" data-t="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join("");
    $("#traits").onclick = (e) => { const b = e.target.closest(".chip"); if (!b) return; state.trait = state.trait === b.dataset.t ? "" : b.dataset.t; render(); };
    if (CFG.CONTACT_EMAIL) $("#corrections").innerHTML += ` Γράψτε στο <span style="user-select:all">${esc(CFG.CONTACT_EMAIL)}</span>.`;

    map = L.map("leaflet", { scrollWheelZoom: false }).setView(CFG.MAP_CENTER || [37.982, 23.733], CFG.MAP_ZOOM || 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    layer = L.layerGroup().addTo(map);

    $("#list").onclick = (e) => { const c = e.target.closest(".card"); if (c) open(+c.dataset.id); };
    $("#scrim").onclick = close;
    $("#sheet").onclick = (e) => { if (e.target.id === "closeSheet") close(); };
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    render();
  }

  const filtered = () => DATA.filter((d) => (!state.intent || d.cats.includes(state.intent)) && (!state.area || d.area === state.area) && (!state.trait || d.traits.includes(state.trait)));
  const catTags = (d) => `<div class="cats">${d.cats.map((k) => `<span class="cat" style="--c:var(--${k})">${INTENTS.find((i) => i.k === k).l}</span>`).join("")}</div>`;
  const traitTags = (d) => `<div class="traits">${d.traits.map((t) => `<span class="trait ${d.verified && d.legal.toLowerCase().startsWith(t.toLowerCase()) ? "v" : ""}">${esc(t)}</span>`).join("")}</div>`;
  const fmtDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? `${m[3]}/${m[2]}/${m[1]}` : esc(s); };
  const stale = (s) => { const t = Date.parse(s); return isFinite(t) && (Date.now() - t) / 2.63e9 > (CFG.STALE_MONTHS || 6); };
  const linkHtml = (u) => { if (!u) return ""; const href = /^https?:\/\//.test(u) ? u : /^@/.test(u) ? "" : "https://" + u; return href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, ""))}</a>` : esc(u); };

  function card(d) {
    if (d.vis === "limited") return `<button class="card" data-id="${d.id}"><h3>${esc(d.name)}</h3><div class="meta">${esc(d.area)}</div>${catTags(d)}<div class="limited">Περιορισμένο προφίλ κατόπιν επιλογής της ομάδας.</div></button>`;
    return `<button class="card" data-id="${d.id}"><h3>${esc(d.name)}</h3>
      <div class="meta">${esc(d.area)}${d.self ? " · " + esc(d.self) : ""}</div>${catTags(d)}${traitTags(d)}
      ${d.support.length ? `<div class="support"><b>Πώς μπορείς να στηρίξεις:</b> ${esc(d.support[0])}${d.needs.length ? ` · <b>${d.needs.length} ${d.needs.length > 1 ? "τρέχουσες ανάγκες" : "τρέχουσα ανάγκη"}</b>` : ""}</div>` : ""}
      ${d.confirmed ? `<div class="confirmed">Τελευταία επιβεβαίωση: ${fmtDate(d.confirmed)}${stale(d.confirmed) ? " · χρειάζεται επανέλεγχο" : ""}</div>` : ""}</button>`;
  }

  function render() {
    document.querySelectorAll(".intent").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === state.intent));
    document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c.dataset.t === state.trait));
    $("#crumb").innerHTML = [state.intent ? `Θέλω να <b>${VERB[state.intent]}</b>` : "<b>Όλα</b>", `<b>${esc(state.area || "Αθήνα")}</b>`, `<b>${esc(state.trait || "κάθε τύπος")}</b>`].join(" → ");
    const rows = filtered();
    $("#list").innerHTML = `<div class="count">${rows.length} εγχειρήματα</div>` + (rows.length ? rows.map(card).join("") : `<div class="empty">${DATA.length ? "Κανένα εγχείρημα με αυτόν τον συνδυασμό. Δοκίμασε άλλη περιοχή ή βγάλε ένα φίλτρο." : "Ο χάρτης γεμίζει σιγά σιγά, καθώς οι ομάδες επιλέγουν να συμμετέχουν."}</div>`);
    layer.clearLayers();
    const pts = [];
    rows.forEach((d) => {
      if (!d.ll) return;
      const k = state.intent && d.cats.includes(state.intent) ? state.intent : d.cats[0];
      let m;
      if (d.vis === "limited") m = L.circle(d.ll, { radius: 350, color: color(k), weight: 1.5, dashArray: "4 4", fillOpacity: 0.08 });
      else m = L.marker(d.ll, { icon: L.divIcon({ className: "", html: `<div class="pin" style="background:var(--${k})"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] }), title: d.name });
      m.on("click", () => open(d.id)); m.addTo(layer); pts.push(d.ll);
    });
    if (pts.length > 1) map.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
    else if (pts.length === 1) map.setView(pts[0], 15);
  }

  function open(id) {
    const d = DATA[id]; if (!d) return;
    let h = `<button class="close" id="closeSheet">Κλείσιμο</button><h2 id="sheetTitle">${esc(d.name)}</h2><div class="meta">${esc(d.area)}${d.link ? " · " + linkHtml(d.link) : ""}</div><div style="margin-top:10px">${catTags(d)}</div>`;
    if (d.vis === "limited") h += `<h4>Ορατότητα</h4><p>Περιορισμένο προφίλ. Η ομάδα επέλεξε να εμφανίζονται μόνο όνομα, περιοχή και link.</p>`;
    else {
      if (d.self) h += `<h4>Πώς αυτοπροσδιορίζεται</h4><p>${esc(d.self)}</p>`;
      if (d.desc) h += `<h4>Τι κάνει</h4><p>${esc(d.desc)}</p>`;
      if (d.how) h += `<h4>Πώς λειτουργεί</h4><p>${esc(d.how)}</p>`;
      if (d.traits.length) h += `<h4>Χαρακτηριστικά που δηλώνει</h4>${traitTags(d)}`;
      if (d.legal) h += `<p class="meta" style="margin-top:6px">Νομική μορφή: ${esc(d.legal)} ${d.verified ? "(επαληθευμένη)" : "(δεν έχει επαληθευτεί)"}</p>`;
      if (d.address) h += `<h4>Διεύθυνση</h4><p>${esc(d.address)}</p>`;
      if (d.hours) h += `<h4>Ωράριο</h4><p>${esc(d.hours)}</p>`;
      h += `<h4>Δράσεις</h4><p>${d.events ? "Διοργανώνει δράσεις και εκδηλώσεις" : "Δεν διοργανώνει δράσεις"}</p>`;
      if (d.support.length) h += `<h4>Πώς μπορείς να στηρίξεις</h4><ul>${d.support.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`;
      if (d.needs.length) h += `<h4>Τρέχουσες ανάγκες</h4><div style="display:flex;flex-direction:column;gap:6px">${d.needs.map((n) => `<div class="need">${esc(n)}</div>`).join("")}</div>`;
    }
    if (d.confirmed) h += `<h4>Αξιοπιστία</h4><p class="meta">Τελευταία επιβεβαίωση: ${fmtDate(d.confirmed)}.</p>`;
    $("#sheet").innerHTML = h; $("#sheet").hidden = false; $("#scrim").hidden = false; $("#closeSheet").focus();
    document.querySelectorAll(".card").forEach((c) => c.classList.toggle("hl", +c.dataset.id === id));
  }
  function close() { $("#sheet").hidden = true; $("#scrim").hidden = true; }

  load();
})();
