import { useState, useEffect, useRef } from "react";

const EJS_SERVICE  = "service_d1jc6tc";
const EJS_TEMPLATE = "template_thzz9vf";
const EJS_KEY      = "Ci9lVkBdfHSqzRDdK";
const STORAGE_KEY  = "leadforge_v5";

const CONTACT = {
  phone:   "+31616142098",
  email:   "bartoviusaisolutions@gmail.com",
  website: "https://bartovius-website1.vercel.app/",
};

const LIMBURG_LOCS = [
  { name:"Venlo",    lat:51.3704, lng:6.1724 },
  { name:"Roermond", lat:51.1940, lng:5.9875 },
  { name:"Sittard",  lat:51.0011, lng:5.8698 },
  { name:"Weert",    lat:51.2522, lng:5.7098 },
  { name:"Venray",   lat:51.5275, lng:5.9741 },
  { name:"Gennep",   lat:51.6985, lng:5.9736 },
  { name:"Bergen",   lat:51.5994, lng:6.0375 },
  { name:"Boxmeer",  lat:51.6464, lng:5.9481 },
];

const BIZ_TYPES = [
  { id:"restaurant",  label:"Restaurant / Café",       icon:"🍽️", query:"restaurant",          pain:"reserveringen, menu updates en klantvragen handmatig verwerken" },
  { id:"retail",      label:"Winkel / Retail",          icon:"🛍️", query:"winkel",               pain:"voorraadbeheer, klantcommunicatie en productbeschrijvingen bijhouden" },
  { id:"trade",       label:"Installateur / Aannemer", icon:"🔧", query:"installateur",         pain:"offertes opstellen, afspraken plannen en facturatie verwerken" },
  { id:"hospitality", label:"Hotel / B&B",              icon:"🏨", query:"hotel",                pain:"boekingen bijhouden, gastvragen beantwoorden en reviews verwerken" },
  { id:"accountant",  label:"Boekhouder / Adviseur",   icon:"📊", query:"administratiekantoor", pain:"rapportages opstellen, klantcommunicatie en administratie" },
  { id:"other",       label:"Overig MKB",              icon:"🏢", query:"bedrijf",              pain:"repetitieve taken, klantenservice en dagelijkse administratie" },
];

const STATUSES = [
  { id:"new",   label:"Nieuw",        cls:"bg-zinc-700 text-zinc-300" },
  { id:"sent",  label:"Benaderd",     cls:"bg-blue-500/20 text-blue-300 border border-blue-500/40" },
  { id:"reply", label:"Reactie ✓",   cls:"bg-yellow-500/20 text-yellow-300 border border-yellow-500/40" },
  { id:"won",   label:"Gewonnen 🎉", cls:"bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" },
  { id:"lost",  label:"Afgewezen",   cls:"bg-red-500/20 text-red-300 border border-red-500/40" },
];

const save = (d) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch(_){} };
const load = ()  => { try { const v = localStorage.getItem(STORAGE_KEY); return v ? JSON.parse(v) : null; } catch(_){ return null; } };

async function callClaude(prompt) {
  const r = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || d.error);
  return d.content.map(c => c.text || "").join("");
}

async function placesSearch(query, lat, lng) {
  const params = new URLSearchParams({ query, lat, lng });
  const r = await fetch("/api/places?" + params.toString());
  if (!r.ok) throw new Error("Places API fout: " + r.status);
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d;
}

let ejsReady = false;
async function loadEJS() {
  if (ejsReady) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  window.emailjs.init({ publicKey: EJS_KEY });
  ejsReady = true;
}

async function sendEmail(toEmail, subject, message) {
  await loadEJS();
  return window.emailjs.send(EJS_SERVICE, EJS_TEMPLATE, { to_email: toEmail, subject, message });
}

async function searchRealBusinesses(typeIds, count = 8) {
  const selected = BIZ_TYPES.filter(t => typeIds.includes(t.id));
  const results = [];
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    const btype = selected[i % selected.length];
    const loc   = LIMBURG_LOCS[i % LIMBURG_LOCS.length];
    try {
      const query = btype.query + " " + loc.name + " Limburg";
      const data  = await placesSearch(query, loc.lat, loc.lng);
      const places = data.results || [];
      if (places.length > 0) {
        const pick = places[Math.floor(Math.random() * Math.min(5, places.length))];
        if (seen.has(pick.place_id)) continue;
        seen.add(pick.place_id);
        results.push({
          id:        crypto.randomUUID(),
          name:      pick.name,
          address:   pick.formatted_address || loc.name,
          city:      loc.name,
          type:      btype.label,
          icon:      btype.icon,
          pain:      btype.pain,
          score:     pick.rating ? Math.min(10, Math.round(pick.rating * 2)) : Math.floor(Math.random() * 3) + 7,
          rating:    pick.rating || null,
          phone:     pick.phone || null,
          hasWebsite:!!pick.website,
          placeId:   pick.place_id,
          real:      true,
          message:   null,
          status:    "new",
          toEmail:   "",
        });
      }
    } catch(_) {}
  }
  if (results.length < 2) return generateAILeads(typeIds, count);
  return results;
}

async function generateAILeads(typeIds, count = 8) {
  const labels = BIZ_TYPES.filter(t => typeIds.includes(t.id)).map(t => t.label).join(", ");
  const txt = await callClaude(
    "Genereer " + count + " fictieve MKB leads in Limburg Nederland voor sectoren: " + labels + "." +
    " Geef ALLEEN een JSON array terug, geen uitleg, geen backticks:" +
    ' [{"name":"","type":"","icon":"","address":"","city":"","hasWebsite":true,"score":8,"pain":"","phone":null}]' +
    " Gebruik echte Limburgse plaatsnamen: Bergen, Gennep, Venray, Boxmeer, Venlo, Weert, Roermond, Sittard."
  );
  const parsed = JSON.parse(txt.replace(/```json|```/g, "").trim());
  return parsed.map(l => ({ ...l, id: crypto.randomUUID(), message: null, status: "new", placeId: null, rating: null, real: false, toEmail: "" }));
}

function exportCSV(leads) {
  const hdr = ["Naam","Type","Stad","Adres","Score","Rating","Telefoon","Status","Bericht"];
  const rows = leads.map(l => [l.name,l.type,l.city,l.address,l.score,l.rating||"",l.phone||"",STATUSES.find(s=>s.id===l.status)?.label||"Nieuw",(l.message||"").replace(/\n/g," ")]);
  const csv = [hdr,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));
  a.download = "leads_limburg.csv"; a.click();
}

function Tag({children, cls}) {
  return <span className={"text-xs px-2 py-0.5 rounded-full font-medium "+cls}>{children}</span>;
}

function Spinner({size="w-4 h-4"}) {
  return <span className={size+" border-2 border-white/20 border-t-white rounded-full animate-spin inline-block"}/>;
}

function StatusPicker({status, onChange}) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const s = STATUSES.find(x => x.id === status) || STATUSES[0];
  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className={"text-xs px-2.5 py-1 rounded-full font-semibold select-none "+s.cls}>
        {s.label} ▾
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-40 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl w-36">
          {STATUSES.map(st => (
            <button key={st.id} onClick={() => { onChange(st.id); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-xs hover:bg-zinc-700 text-zinc-200 transition">{st.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function LeadCard({lead, onGenerate, onPatch, onDelete, isGenerating, channel}) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(lead.message || "");
  const [copied, setCopied]     = useState(false);
  const [waCopied, setWaCopied] = useState(false);
  const [sending, setSending]   = useState(false);
  const [sendOk, setSendOk]     = useState(null);
  const [toEmail, setToEmail]   = useState(lead.toEmail || "");

  useEffect(() => { if (!editing) setDraft(lead.message || ""); }, [lead.message, editing]);

  const copy = () => { navigator.clipboard.writeText(lead.message || ""); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(lead.message || "");
    // Normalize phone: remove spaces, dashes, dots but keep +
    let phone = (lead.phone || "").replace(/[\s\-().]/g, "");
    // If starts with 0, replace with Dutch country code
    if (phone.startsWith("0")) phone = "31" + phone.slice(1);
    // Remove + if present
    phone = phone.replace("+", "");

    if (phone) {
      // Use api.whatsapp.com - works in browser without desktop app
      window.open("https://api.whatsapp.com/send?phone=" + phone + "&text=" + text, "_blank");
    } else {
      navigator.clipboard.writeText(lead.message || "");
      setWaCopied(true);
      setTimeout(() => setWaCopied(false), 5000);
      window.open("https://web.whatsapp.com/", "_blank");
    }
  };

  const handleSendEmail = async () => {
    if (!toEmail.trim()) return;
    setSending(true); setSendOk(null);
    try {
      const subjectMatch = (lead.message || "").match(/Onderwerp:\s*(.+)/);
      const subject = subjectMatch ? subjectMatch[1].trim() : "AI Automatisering voor " + lead.name;
      await sendEmail(toEmail.trim(), subject, lead.message || "");
      setSendOk("ok");
      onPatch(lead.id, { status: "sent", toEmail: toEmail.trim() });
    } catch(e) {
      console.error(e);
      setSendOk("err");
    }
    setSending(false);
    setTimeout(() => setSendOk(null), 3000);
  };

  const border =
    lead.status === "won"  ? "border-emerald-500/50 shadow-lg shadow-emerald-500/5" :
    lead.status === "sent" ? "border-blue-500/30" :
    "border-zinc-800 hover:border-zinc-700";

  return (
    <div className={"relative group bg-zinc-900 border rounded-2xl p-5 flex flex-col gap-3 transition-all "+border}>
      <button onClick={() => onDelete(lead.id)}
        className="absolute top-3 right-3 w-6 h-6 rounded-full bg-zinc-800 hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100 flex items-center justify-center text-base">×</button>

      <div className="flex items-start gap-3 pr-6">
        <span className="text-2xl shrink-0 mt-0.5">{lead.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-base leading-tight truncate">{lead.name}</p>
          <p className="text-zinc-500 text-xs mt-0.5 truncate">{lead.address}</p>
          {lead.phone && <p className="text-zinc-600 text-xs mt-0.5">📞 {lead.phone}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPicker status={lead.status || "new"} onChange={s => onPatch(lead.id, {status: s})}/>
        <Tag cls="bg-blue-500/15 text-blue-300 border border-blue-500/20">{lead.type}</Tag>
        {lead.real
          ? <Tag cls="bg-green-500/15 text-green-400 border border-green-500/20">✓ Echt bedrijf</Tag>
          : <Tag cls="bg-zinc-700 text-zinc-500">AI gegenereerd</Tag>}
        {lead.hasWebsite
          ? <Tag cls="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">Website ✓</Tag>
          : <Tag cls="bg-zinc-700/80 text-zinc-400">Geen website</Tag>}
        {lead.score >= 9 && <Tag cls="bg-orange-500/20 text-orange-300 border border-orange-500/30">⭐ Top lead</Tag>}
        {lead.rating && <Tag cls="bg-zinc-800 text-zinc-400">★ {lead.rating}</Tag>}
      </div>

      <p className="text-zinc-500 text-xs italic leading-relaxed">💡 {lead.pain}</p>

      {lead.message ? (
        editing ? (
          <div className="flex flex-col gap-2">
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={7}
              className="w-full bg-zinc-800 border border-orange-500/40 rounded-xl p-3 text-xs text-zinc-200 resize-y focus:outline-none leading-relaxed"/>
            <div className="flex gap-2">
              <button onClick={() => { onPatch(lead.id, {message: draft}); setEditing(false); }}
                className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold transition">Opslaan</button>
              <button onClick={() => { setDraft(lead.message || ""); setEditing(false); }}
                className="flex-1 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs transition">Annuleren</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="bg-zinc-800/60 rounded-xl p-3.5 text-xs text-zinc-300 whitespace-pre-wrap border border-zinc-700/50 leading-relaxed max-h-44 overflow-y-auto">
              {lead.message}
            </div>
            {channel === "whatsapp" ? (
              <div className="flex flex-col gap-1.5">
                <button onClick={handleWhatsApp}
                  className={"w-full py-2.5 rounded-lg text-xs font-bold transition " + (waCopied ? "bg-emerald-500 text-white" : "bg-green-600 hover:bg-green-500 text-white")}>
                  {waCopied
                    ? "✓ Gekopieerd! Plak het in WhatsApp Web"
                    : lead.phone
                    ? "💬 Open WhatsApp — direct in hun chat"
                    : "💬 Open WhatsApp Web"}
                </button>
                {lead.phone && <p className="text-xs text-emerald-500 text-center">📞 {lead.phone} — opent direct in hun chat</p>}
                {waCopied && !lead.phone && <p className="text-xs text-zinc-400 text-center">WhatsApp Web geopend — druk Ctrl+V om het bericht te plakken</p>}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <input value={toEmail} onChange={e => setToEmail(e.target.value)}
                  placeholder="E-mailadres ontvanger (bijv. info@restaurant.nl)"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition"/>
                <div className="flex gap-2">
                  <button onClick={handleSendEmail} disabled={sending || !toEmail.trim()}
                    className={"flex-1 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 " + (
                      sendOk === "ok"  ? "bg-emerald-500 text-white" :
                      sendOk === "err" ? "bg-red-500 text-white" :
                      sending          ? "bg-zinc-700 text-zinc-400" :
                      !toEmail.trim()  ? "bg-zinc-700 text-zinc-500 cursor-not-allowed" :
                      "bg-blue-600 hover:bg-blue-500 text-white")}>
                    {sending        ? <><Spinner size="w-3 h-3"/> Versturen...</> :
                     sendOk==="ok"  ? "✓ Verzonden!" :
                     sendOk==="err" ? "✗ Mislukt" :
                     "✉️ Verstuur via EmailJS"}
                  </button>
                  <button onClick={() => {
                    const subject = encodeURIComponent((lead.message||"").match(/Onderwerp:\s*(.+)/)?.[1]?.trim() || "AI Automatisering voor "+lead.name);
                    const body = encodeURIComponent(lead.message||"");
                    window.open("https://mail.google.com/mail/?view=cm&to="+encodeURIComponent(toEmail)+"&su="+subject+"&body="+body, "_blank");
                  }} disabled={!toEmail.trim()}
                    className={"px-3 py-2.5 rounded-lg text-xs font-bold transition " + (toEmail.trim() ? "bg-zinc-700 hover:bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-600 cursor-not-allowed")}>
                    📧 Open Gmail
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={copy}
                className={"flex-1 py-2 rounded-lg text-xs font-bold transition "+(copied?"bg-emerald-500 text-white":"bg-zinc-700 hover:bg-zinc-600 text-zinc-200")}>
                {copied ? "✓ Gekopieerd!" : "📋 Kopieer tekst"}
              </button>
              <button onClick={() => { setDraft(lead.message || ""); setEditing(true); }}
                className="px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs transition">✏️</button>
              <button onClick={() => onGenerate(lead)}
                className="px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs transition" title="Opnieuw genereren">🔄</button>
            </div>
          </div>
        )
      ) : (
        <button onClick={() => onGenerate(lead)} disabled={isGenerating}
          className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold text-sm transition-all">
          {isGenerating
            ? <span className="flex items-center justify-center gap-2"><Spinner/>Bericht genereren...</span>
            : "✍️ Genereer outreach bericht"}
        </button>
      )}
    </div>
  );
}

function Stats({leads}) {
  const items = [
    {label:"Leads",    v:leads.length,                                                             c:"text-white"},
    {label:"Berichten",v:leads.filter(l=>l.message).length,                                       c:"text-orange-400"},
    {label:"Benaderd", v:leads.filter(l=>["sent","reply","won"].includes(l.status)).length,        c:"text-blue-400"},
    {label:"Gewonnen", v:leads.filter(l=>l.status==="won").length,                                c:"text-emerald-400"},
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(s=>(
        <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
          <p className={"text-xl font-black "+s.c}>{s.v}</p>
          <p className="text-zinc-600 text-xs mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [screen,   setScreen]   = useState("setup");
  const [bizName,  setBizName]  = useState("Bartovius AI Solutions");
  const [location, setLocation] = useState("Limburg, Nederland");
  const [selTypes, setSelTypes] = useState([]);
  const [channel,  setChannel]  = useState("email");
  const [useReal,  setUseReal]  = useState(true);
  const [leads,    setLeads]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [genMsg,   setGenMsg]   = useState(null);
  const [genAll,   setGenAll]   = useState(false);
  const [filter,   setFilter]   = useState("all");
  const [error,    setError]    = useState("");
  const [ready,    setReady]    = useState(false);

  useEffect(() => {
    const d = load();
    if (d) {
      setBizName(d.bizName || "Bartovius AI Solutions");
      setLocation(d.location || "Limburg, Nederland");
      setSelTypes(d.selTypes || []);
      setChannel(d.channel || "email");
      setUseReal(d.useReal !== undefined ? d.useReal : true);
      if (d.leads?.length) { setLeads(d.leads); setScreen("leads"); }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    save({ bizName, location, selTypes, channel, useReal, leads });
  }, [leads, bizName, location, selTypes, channel, useReal, ready]);

  const toggleType = id => setSelTypes(p => p.includes(id) ? p.filter(t => t !== id) : [...p, id]);
  const patchLead  = (id, patch) => setLeads(p => p.map(l => l.id === id ? {...l, ...patch} : l));
  const deleteLead = id => setLeads(p => p.filter(l => l.id !== id));

  const doSearch = async () => {
    if (!bizName.trim())  { setError("Vul je bedrijfsnaam in."); return; }
    if (!selTypes.length) { setError("Kies minimaal één sector."); return; }
    setError(""); setLoading(true);
    try {
      const newLeads = useReal
        ? await searchRealBusinesses(selTypes, 8)
        : await generateAILeads(selTypes, 8);
      setLeads(p => [...p, ...newLeads]);
      setScreen("leads");
    } catch(e) {
      setError("Fout: " + e.message);
    }
    setLoading(false);
  };

  const doGenMsg = async (lead) => {
    setGenMsg(lead.id);
    const isEmail = channel === "email";
    const style   = isEmail ? "zakelijke e-mail" : "kort WhatsApp bericht";
    const instr   = isEmail
      ? "Schrijf een professionele cold email met: Onderwerp: [zakelijk en specifiek]. Alinea 1: directe opening met een concrete observatie over hun bedrijf of sector, geen complimenten. Alinea 2: één specifiek probleem dat wij oplossen met een meetbaar resultaat (tijd of geld). Alinea 3: korte call to action — voorstel voor een gesprek van 20 minuten bij hen op locatie, geen druk. Toon: zakelijk, zelfverzekerd, respectvol. Schrijf alsof je een senior consultant bent, niet een verkoper."
      : "Schrijf een professioneel WhatsApp bericht. Max 3 zinnen. Toon: direct en zakelijk, geen emoji, geen uitroeptekens. Zin 1: wie je bent en waarvandaan. Zin 2: één concreet probleem dat je oplost. Zin 3: vraag om een kort gesprek bij hen langs.";
    const prompt =
      "Je bent een senior AI automatisering consultant van " + bizName + ", gevestigd in Nieuw Bergen, Limburg." +
      " Je schrijft professionele B2B outreach voor lokale MKB bedrijven in Limburg." +
      " Doelbedrijf: " + lead.name + " (" + lead.type + ") in " + lead.city + "." +
      " Hun pijnpunt: " + lead.pain + "." +
      " Jouw contactgegevens: " + CONTACT.phone + " | " + CONTACT.email + " | " + CONTACT.website + "." +
      " STRIKTE REGELS:" +
      " 1. Schrijf in formeel maar toegankelijk Nederlands — tutoyeer niet, gebruik u." +
      " 2. Nooit: overdreven enthousiasme, buzzwords zoals 'innovatief' of 'revolutionair', of vage beloftes." +
      " 3. Altijd: één concreet meetbaar voordeel noemen (bijv. '3 tot 5 uur per week besparen')." +
      " 4. Vermeld dat je lokaal gevestigd bent in Limburg en persoonlijk langs kunt komen." +
      " 5. Eindig met een concrete, laagdrempelige vraag voor een afspraak." +
      " 6. Sluit af met je contactgegevens op aparte regels." +
      " 7. Geen placeholders. Geen [naam]. Gebruik de bedrijfsnaam direct." +
      " " + instr;
    try {
      const txt = await callClaude(prompt);
      patchLead(lead.id, { message: txt });
    } catch(e) {
      setError("Fout bij genereren: " + e.message);
    }
    setGenMsg(null);
  };

  const doGenAll = async () => {
    setGenAll(true);
    for (const l of leads.filter(l => !l.message)) await doGenMsg(l);
    setGenAll(false);
  };

  const filtered = filter === "all" ? leads : leads.filter(l => (l.status || "new") === filter);

  if (!ready) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Spinner size="w-7 h-7"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white" style={{fontFamily:"'Segoe UI',system-ui,sans-serif"}}>

      <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center font-black text-sm shadow shadow-orange-500/30">L</div>
          <span className="font-black text-base">LeadForge <span className="text-orange-400">Limburg</span></span>
        </div>
        {screen === "leads" && (
          <div className="flex gap-2 items-center flex-wrap justify-end">
            <button onClick={() => exportCSV(leads)} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition">📥 CSV</button>
            <button onClick={doGenAll} disabled={genAll || leads.every(l => l.message)}
              className="text-xs px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold transition">
              {genAll ? <span className="flex items-center gap-1"><Spinner size="w-3 h-3"/>Bezig...</span> : "⚡ Alle berichten"}
            </button>
            <button onClick={() => { setLeads([]); setScreen("setup"); }} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition">+ Nieuw</button>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {screen === "setup" && (
          <div className="flex flex-col gap-7">
            <div>
              <h1 className="text-3xl font-black leading-tight">AI Lead &<br/><span className="text-orange-400">Outreach Systeem</span></h1>
              <p className="text-zinc-500 mt-2 text-sm leading-relaxed">Vindt echte lokale bedrijven via Google Maps en schrijft persoonlijke outreach voor jou.</p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Jouw bedrijfsnaam</label>
              <input value={bizName} onChange={e => setBizName(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition text-sm"/>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Regio</label>
              <input value={location} onChange={e => setLocation(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition text-sm"/>
            </div>

            <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{useReal ? "🗺️ Google Maps modus" : "🤖 AI Lead modus"}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{useReal ? "Zoekt echte lokale bedrijven" : "Genereert realistische leads via AI"}</p>
              </div>
              <button onClick={() => setUseReal(r => !r)}
                className={"relative w-12 h-6 rounded-full transition-colors " + (useReal ? "bg-orange-500" : "bg-zinc-700")}>
                <span className={"absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all " + (useReal ? "left-7" : "left-1")}/>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Outreach kanaal</label>
              <div className="flex gap-3">
                {[{id:"email",icon:"✉️",label:"E-mail",sub:"Verstuurt via Gmail"},{id:"whatsapp",icon:"💬",label:"WhatsApp",sub:"Opent WhatsApp Web"}].map(s => (
                  <button key={s.id} onClick={() => setChannel(s.id)}
                    className={"flex-1 py-3 px-4 rounded-xl border text-left transition-all " + (channel===s.id ? "bg-orange-500/10 border-orange-500" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600")}>
                    <p className="font-semibold text-sm">{s.icon} {s.label}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{s.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Doelsectoren</label>
              <div className="grid grid-cols-2 gap-2.5">
                {BIZ_TYPES.map(t => (
                  <button key={t.id} onClick={() => toggleType(t.id)}
                    className={"flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all " + (selTypes.includes(t.id) ? "bg-orange-500/10 border-orange-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600")}>
                    <span className="text-xl">{t.icon}</span>
                    <span className="text-sm font-medium leading-tight">{t.label}</span>
                    {selTypes.includes(t.id) && <span className="ml-auto text-orange-400 font-bold text-xs">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

            <button onClick={doSearch} disabled={loading}
              className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black text-base transition-all shadow-lg shadow-orange-500/20">
              {loading
                ? <span className="flex items-center justify-center gap-2"><Spinner/>{useReal ? "Zoeken op Google Maps..." : "AI leads genereren..."}</span>
                : (useReal ? "🗺️ Zoek Echte Bedrijven" : "🚀 Genereer AI Leads")}
            </button>
          </div>
        )}

        {screen === "leads" && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-2xl font-black">{leads.length} leads <span className="text-orange-400">• {location}</span></h2>
              <p className="text-zinc-600 text-sm mt-1">{channel==="email" ? "✉️ E-mail" : "💬 WhatsApp"} outreach • {bizName}</p>
            </div>

            <Stats leads={leads}/>

            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setFilter("all")}
                className={"text-xs px-3 py-1.5 rounded-lg font-medium transition " + (filter==="all" ? "bg-zinc-600 text-white" : "bg-zinc-900 text-zinc-500 hover:bg-zinc-800")}>
                Alle ({leads.length})
              </button>
              {STATUSES.map(s => {
                const n = leads.filter(l => (l.status||"new") === s.id).length;
                if (!n && filter !== s.id) return null;
                return (
                  <button key={s.id} onClick={() => setFilter(s.id)}
                    className={"text-xs px-3 py-1.5 rounded-lg font-medium transition " + (filter===s.id ? "bg-zinc-600 text-white" : "bg-zinc-900 text-zinc-500 hover:bg-zinc-800")}>
                    {s.label} ({n})
                  </button>
                );
              })}
            </div>

            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

            <div className="flex flex-col gap-4">
              {filtered.map(lead => (
                <LeadCard key={lead.id} lead={lead}
                  onGenerate={doGenMsg}
                  onPatch={patchLead}
                  onDelete={deleteLead}
                  isGenerating={genMsg === lead.id}
                  channel={channel}/>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12 text-zinc-700">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-sm">Geen leads voor deze filter.</p>
                </div>
              )}
            </div>

            <button onClick={doSearch} disabled={loading}
              className="w-full py-3 rounded-xl border border-zinc-800 hover:border-orange-500/40 text-zinc-600 hover:text-orange-400 text-sm font-semibold transition">
              {loading
                ? <span className="flex items-center justify-center gap-2"><Spinner size="w-3 h-3"/>Laden...</span>
                : (useReal ? "🗺️ Zoek 8 meer echte bedrijven" : "+ Genereer 8 meer AI leads")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
