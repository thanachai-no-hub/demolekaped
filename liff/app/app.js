// IPED · เว็บแอป (แจ้งเตือน · To Do · คลัง · ตั้งค่า) · ไม่มี build
// สัญญา API: docs/app-contract.md · ของจริงเรียกผ่าน Duck.api (../shared/app.js)
// ?mock=1 = ไม่โหลด LIFF ไม่ต่อเน็ต ใช้ข้อมูลปลอมในหน่วยความจำ (สร้าง/แก้/ลบได้จริงในแท็บนี้) · ?mock=1&empty=1 = เริ่มจากข้อมูลว่าง
(function () {
  "use strict";
  const D = window.Duck;
  const { $, $$, esc } = D;
  const qs = new URLSearchParams(location.search);
  const MOCK = qs.get("mock") === "1";

  // ===== สถานะของหน้า =====
  const st = {
    zone: "Asia/Bangkok", me: { name: "", title: "", pic: null }, settings: null,
    today: { date: null, range: "day", filter: "all", data: null },
    rpTab: "inbox", inbox: null, todoFilter: "all", repeatTab: "repeat", groupSel: null,
    lib: { view: "list", q: "" }, cache: new Map(), reload: null, route: "", chat: [],
  };
  let api = D.api;

  // ===== เวลา (แสดงตามโซนจากตั้งค่า · ค่าเริ่มต้น Asia/Bangkok) =====
  const DOW_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  const MON_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const MON = D.MONTHS;
  let fmtCache = null;
  function parts(iso) {
    if (!fmtCache || fmtCache.z !== st.zone) fmtCache = { z: st.zone, f: new Intl.DateTimeFormat("en-CA", { timeZone: st.zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) };
    const p = Object.fromEntries(fmtCache.f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
    return { ymd: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
  }
  const todayYmd = () => parts(new Date().toISOString()).ymd;
  const addDays = D.addDays;
  const ymdDow = (ymd) => new Date(ymd + "T00:00:00Z").getUTCDay();
  const ymdParts = (ymd) => { const [y, m, d] = ymd.split("-").map(Number); return { y, m: m - 1, d }; };
  // วัน+เวลาในโซนผู้ใช้ → ISO UTC
  function toIso(ymd, hm) {
    const guess = Date.parse(`${ymd}T${hm}:00Z`);
    const p = parts(new Date(guess).toISOString());
    const off = Date.parse(`${p.ymd}T${p.hm}:00Z`) - guess;
    return new Date(guess - off).toISOString();
  }
  function shortDate(ymd) { const { d, m } = ymdParts(ymd); return `${DOW[ymdDow(ymd)]}. ${d} ${MON[m]}`; }
  function dayLabel(ymd) {
    const t = todayYmd();
    if (ymd === t) return "วันนี้";
    if (ymd === addDays(t, 1)) return "พรุ่งนี้";
    if (ymd === addDays(t, -1)) return "เมื่อวาน";
    return shortDate(ymd);
  }
  function whenText(iso) { if (!iso) return ""; const p = parts(iso); return `${dayLabel(p.ymd)} ${p.hm}`; }
  function thaiDate(iso) { if (!iso) return ""; const p = parts(iso), { y, m, d } = ymdParts(p.ymd); return `${d} ${MON[m]} ${y + 543}`; }
  function greetLocal() { const h = +parts(new Date().toISOString()).hm.slice(0, 2); return h < 11 ? "สวัสดีตอนเช้า" : h < 16 ? "สวัสดีตอนบ่าย" : h < 19 ? "สวัสดีตอนเย็น" : "สวัสดีตอนค่ำ"; }
  function bytes(n) { n = +n || 0; if (n < 1024) return n + " B"; if (n < 1048576) return (n / 1024).toFixed(0) + " KB"; if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB"; return (n / 1073741824).toFixed(1) + " GB"; }

  // ===== ไอคอน =====
  const ICON = {
    reminder: '<path d="M6 16v-5a6 6 0 0112 0v5l2 2H4z"/><path d="M10 21h4"/>',
    meeting: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    task: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 12l2 2 4-4"/>',
    todo: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 12l3 3 5-6"/>',
    note: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7"/>',
    link: '<path d="M10 14a4 4 0 006 0l3-3a4 4 0 00-6-6l-1 1M14 10a4 4 0 00-6 0l-3 3a4 4 0 006 6l1-1"/>',
    photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    repeat: '<path d="M4 9h13l-3-3M20 15H7l3 3"/>',
    group: '<circle cx="9" cy="9" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="8" r="2.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    dots: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    inbox: '<path d="M4 13l2-8h12l2 8v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>',
    left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    disk: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
    out: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ICON.todo}</svg>`;
  const SRC = { reminder: "เตือน", meeting: "ประชุม", task: "งานบริษัท", todo: "To Do", note: "โน้ต", link: "ลิงก์", photo: "รูป", file: "ไฟล์" };
  const IMP = ["ปกติ", "สำคัญ", "ห้ามพลาด"];
  const img = (n) => `img/duck-${n}.svg`;
  const main = $("#main");

  function toast(t) { D.toast(t); }
  function errText(e) { return e && e.message ? e.message : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง"; }
  function empty(pic, title, text, extra = "", cls = "") {
    return `<div class="empty ${cls}"><img src="${img(pic)}" alt="" width="132" height="132"><b>${title}</b>${text ? `<p>${text}</p>` : ""}${extra}</div>`;
  }
  const newBtn = (label = "ตั้งเตือน") => `<button class="btn primary" type="button" data-act="create">${svg("plus")} ${label} <kbd>N</kbd></button>`;

  // ===== แถวรายการ =====
  function row(it, o = {}) {
    st.cache.set(it.id, it);
    const p = it.at ? parts(it.at) : null;
    const canCheck = it.editable && (it.source === "reminder" || it.source === "todo");
    const lead = canCheck
      ? `<button class="chk" type="button" role="checkbox" aria-checked="${!!it.done}" aria-label="ทำเสร็จแล้ว: ${esc(it.title)}" data-chk="${esc(it.id)}"><i>✓</i></button>`
      : `<span class="ico-src" title="${esc(SRC[it.source] || "")}">${svg(it.source)}</span>`;
    const tm = o.time ? `<div class="tm">${it.all_day ? "ทั้งวัน" : p ? p.hm : "–"}</div><span class="bar"></span>` : "";
    const meta = [];
    if (o.date && p) meta.push(`<span>${svg("clock")}${esc(it.all_day ? dayLabel(p.ymd) : `${dayLabel(p.ymd)} ${p.hm}`)}</span>`);
    if (it.repeat) meta.push(`<span>${svg("repeat")}${esc(it.repeat)}</span>`);
    if (it.group) meta.push(`<span>${svg("group")}${esc(it.group.name)}</span>`);
    if (it.from) meta.push(`<span>${svg("user")}จาก ${esc(it.from)}</span>`);
    if (it.source === "meeting" || it.source === "task") meta.push(`<span class="tag src">${SRC[it.source]}</span>`);
    if (it.importance > 0) meta.push(`<span class="tag imp${it.importance}">${IMP[it.importance]}</span>`);
    if (it.url && it.source === "link") meta.push(`<a class="lk" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">${esc(it.url.replace(/^https?:\/\//, "").slice(0, 48))}</a>`);
    if (it.size && (it.source === "file" || it.source === "photo")) meta.push(`<span>${bytes(it.size)}</span>`);
    const more = it.editable ? `<button class="ib more" type="button" data-edit="${esc(it.id)}" aria-label="แก้ไข ${esc(it.title)}">${svg("dots")}</button>` : "";
    return `<article class="it imp${it.importance || 0}${it.done ? " done" : ""}" data-id="${esc(it.id)}">${tm}${lead}<div class="bd"><div class="ttl">${esc(it.title)}</div>${meta.length ? `<div class="meta">${meta.join("")}</div>` : ""}${it.body && o.body ? `<div class="meta">${esc(it.body.slice(0, 140))}</div>` : ""}</div>${o.right || ""}${more}</article>`;
  }
  const loading = () => `<div class="empty sm" aria-busy="true"><img src="../assets/lekaped-mascot.svg" alt="" class="bob" width="96" height="96"><p>กำลังโหลด…</p></div>`;
  const failBox = (e) => `<div class="err" role="alert">${esc(errText(e))} <button class="btn" type="button" data-act="retry" style="min-height:36px;margin-left:8px">ลองใหม่</button></div>`;

  // ===== แผงขวา: Inbox / เกิดขึ้นวันนี้ =====
  function rpShell() {
    return `<aside class="rp" aria-label="Memo และเรื่องของวันนี้">
      <div class="rp-tabs" role="tablist">
        <button role="tab" type="button" data-rp="inbox" aria-selected="${st.rpTab === "inbox"}">${svg("inbox").replace("<svg", '<svg width="16" height="16"')} Memo <span class="n" id="nInbox">·</span></button>
        <button role="tab" type="button" data-rp="events" aria-selected="${st.rpTab === "events"}">${svg("meeting").replace("<svg", '<svg width="16" height="16"')} เกิดขึ้นวันนี้ <span class="n" id="nEv">·</span></button>
      </div>
      <label class="quick" id="quickL" ${st.rpTab === "inbox" ? "" : "hidden"}><span aria-hidden="true">＋</span><span class="sr">จดเข้า Memo</span><input id="quick" placeholder="จดไว้ก่อน แล้วกด Enter (Memo ยังไม่มีเวลา)" enterkeyhint="done" autocomplete="off" maxlength="200"></label>
      <div id="rpBody" role="tabpanel">${loading()}</div>
    </aside>`;
  }
  async function loadRp() {
    if (!$("#rpBody")) return;
    try { st.inbox = await api("app/inbox"); drawRp(); }
    catch (e) { $("#rpBody").innerHTML = failBox(e); }
  }
  function drawRp() {
    const r = st.inbox, body = $("#rpBody"); if (!r || !body) return;
    const inbox = r.inbox || [], ev = r.today_events || [];
    $("#nInbox").textContent = inbox.length; $("#nEv").textContent = ev.length;
    for (const b of $$("[data-rp]")) b.setAttribute("aria-selected", String(b.dataset.rp === st.rpTab));
    $("#quickL").hidden = st.rpTab !== "inbox";
    if (st.rpTab === "inbox") {
      body.innerHTML = inbox.length ? `<div class="list">${inbox.map((i) => row(i)).join("")}</div>`
        : empty("laptop", "ไม่มีเรื่องค้าง", "เรื่องที่ยังไม่มีวันเวลา ทั้งที่พิมพ์ตรงนี้และที่ฝาก IPED ในแชต จะมารอตรงนี้", newBtn("เพิ่มเรื่อง"), "sm");
    } else {
      body.innerHTML = ev.length ? `<div class="list">${ev.map((i) => row(i, { time: true })).join("")}</div>`
        : empty("reading", "วันนี้ไม่มีประชุมหรืองานถึงกำหนด", "ประชุมและงานบริษัทที่ถึงกำหนดวันนี้จะขึ้นตรงนี้", "", "sm");
    }
  }

  // ===== หน้า: วันนี้ =====
  function bigTitle(t) {
    const { y, m, d } = ymdParts(t.date);
    if (t.range === "month") return `${MON_FULL[m]}<small>${y + 543}</small>`;
    if (t.range === "week") { const s = weekStart(t.date), e = addDays(s, 6), a = ymdParts(s), b = ymdParts(e); return `สัปดาห์นี้<small>${a.d} ${MON[a.m]} – ${b.d} ${MON[b.m]} ${b.y + 543}</small>`; }
    return `${t.date === todayYmd() ? "วัน" : ""}${DOW_FULL[ymdDow(t.date)]}<small>${d} ${MON_FULL[m]} ${y + 543}</small>`;
  }
  const weekStart = (ymd) => addDays(ymd, -((ymdDow(ymd) + 6) % 7));
  function stripHtml(t) {
    const s = weekStart(t.date), now = todayYmd();
    const days = Array.from({ length: 7 }, (_, i) => addDays(s, i));
    return `<div class="strip" role="group" aria-label="เลือกวัน">
      <button class="ib" type="button" data-shift="-7" aria-label="สัปดาห์ก่อน">${svg("left")}</button>
      <div class="days">${days.map((d) => `<button type="button" class="d${d === now ? " today" : ""}" data-day="${d}" aria-pressed="${d === t.date}" aria-label="${esc(shortDate(d))}"><small>${DOW[ymdDow(d)]}</small><b>${+d.slice(8)}</b></button>`).join("")}</div>
      <button class="ib" type="button" data-shift="7" aria-label="สัปดาห์ถัดไป">${svg("right")}</button>
    </div>`;
  }
  function pageToday() {
    const t = st.today; if (!t.date) t.date = todayYmd();
    const isToday = t.date === todayYmd();
    main.innerHTML = `
      <section class="hero today-h"><div class="hero-row">
        <div><p class="kick" id="greet">${esc(t.data?.greeting || `${greetLocal()} ${st.me.name || ""}`)}</p><h1>${bigTitle(t)}</h1>
          ${isToday ? "" : `<button class="btn" type="button" data-day="${todayYmd()}" style="margin-top:8px;min-height:36px">กลับไปวันนี้</button>`}</div>
        <div class="ctrl">
          <div class="seg" role="group" aria-label="ช่วงเวลา">${[["day", "วัน"], ["week", "สัปดาห์"], ["month", "เดือน"]].map(([v, l]) => `<button type="button" data-range="${v}" aria-pressed="${t.range === v}">${l}</button>`).join("")}</div>
          ${stripHtml(t)}
        </div></div></section>
      <div class="chips" id="chips" role="group" aria-label="กรองรายการ"></div>
      <div class="cols"><section class="col" id="tl" aria-label="ไทม์ไลน์">${loading()}</section>${rpShell()}</div>`;
    st.reload = loadToday;
    loadToday(); loadRp();
  }
  async function loadToday() {
    const t = st.today;
    try {
      t.data = await api(`app/today?date=${t.date}&range=${t.range}`);
      if (t.data.greeting && $("#greet")) $("#greet").textContent = t.data.greeting;
      drawToday();
    } catch (e) { if ($("#tl")) $("#tl").innerHTML = failBox(e); }
  }
  const FILTERS = [["all", "ทั้งหมด"], ["mine", "ของฉัน"], ["to_me", "ถึงฉัน"], ["group", "ในกลุ่ม"], ["important", "สำคัญขึ้นไป"]];
  const pass = (f, i) => f === "all" || (f === "important" ? i.importance >= 1 : i.scope === f);
  function drawToday() {
    const t = st.today, r = t.data; if (!r || !$("#tl")) return;
    const c = r.counts || {};
    $("#chips").innerHTML = FILTERS.map(([k, l]) => `<button type="button" data-filter="${k}" aria-pressed="${t.filter === k}">${l} <span class="n">${c[k] ?? 0}</span></button>`).join("");
    const days = (r.days || []).map((d) => ({ date: d.date, items: (d.items || []).filter((i) => pass(t.filter, i)) }));
    const total = days.reduce((a, d) => a + d.items.length, 0);
    if (!total) {
      const isDay = t.range === "day";
      $("#tl").innerHTML = t.filter !== "all"
        ? empty("bell", "ไม่มีรายการในหมวดนี้", "ลองกด “ทั้งหมด” เพื่อดูทุกเรื่อง")
        : empty("bell", isDay ? (t.date === todayYmd() ? "วันนี้ว่างทั้งวัน" : `${dayLabel(t.date)}ยังว่าง`) : t.range === "week" ? "สัปดาห์นี้ยังว่าง" : "เดือนนี้ยังว่าง",
          "บอก IPED ในแชต LINE หรือกด N เพื่อตั้งเตือนได้เลย", newBtn());
      return;
    }
    $("#tl").innerHTML = days.filter((d) => d.items.length || t.range === "day").map((d) =>
      `<h2 class="sec-h">${esc(dayLabel(d.date))}${d.date !== todayYmd() && dayLabel(d.date) !== shortDate(d.date) ? ` · ${esc(shortDate(d.date))}` : ""} <span class="n">${d.items.length}</span></h2>
       <div class="list">${d.items.map((i) => row(i, { time: true })).join("")}</div>`).join("");
  }

  // ===== หน้า: To Do =====
  const TODO_F = [["all", "ทั้งหมด"], ["timed", "มีเวลา"], ["untimed", "Memo (ยังไม่มีเวลา)"], ["done", "เสร็จแล้ว"]];
  function pageTodo() {
    main.innerHTML = `
      <section class="hero"><div class="hero-row"><div><p class="kick">เรื่องที่ต้องทำ</p><h1>To Do</h1><p class="sub">ติ๊กเมื่อทำเสร็จ IPED จะเลิกตามให้</p></div>${newBtn("เพิ่ม To Do")}</div></section>
      <div class="cols"><section class="col"><div class="toolbar"><div class="seg" role="group" aria-label="กรอง To Do" id="todoF"></div></div><div id="todoL">${loading()}</div></section>${rpShell()}</div>`;
    st.reload = loadTodo; loadTodo(); loadRp();
  }
  async function loadTodo() {
    try {
      const r = await api(`app/todo?filter=${st.todoFilter}`);
      const c = r.counts || {};
      $("#todoF").innerHTML = TODO_F.map(([k, l]) => `<button type="button" data-todo="${k}" aria-pressed="${st.todoFilter === k}">${l} <span class="n" style="opacity:.6">${c[k] ?? 0}</span></button>`).join("");
      const items = r.items || [];
      $("#todoL").innerHTML = items.length ? `<div class="list">${items.map((i) => row(i, { date: true })).join("")}</div>`
        : st.todoFilter === "done" ? empty("reading", "ยังไม่มีเรื่องที่ทำเสร็จ", "ติ๊กช่องหน้ารายการเมื่อทำเสร็จ แล้วจะย้ายมาอยู่ตรงนี้")
        : empty("laptop", "ไม่มี To Do ค้าง", "เพิ่มเรื่องที่ต้องทำ หรือพิมพ์ “ต้องทำ …” ในแชต LINE", newBtn("เพิ่ม To Do"));
    } catch (e) { $("#todoL").innerHTML = failBox(e); }
  }

  // ===== หน้า: เตือนซ้ำ / ที่ตั้งไว้ =====
  const REP_T = [["once", "เตือนครั้งเดียว"], ["repeat", "เตือนประจำ"], ["untimed", "Memo (ยังไม่มีเวลา)"]];
  const repKind = (i) => (!i.at && !i.repeat ? "untimed" : i.repeat ? "repeat" : "once");
  function pageRepeat() {
    main.innerHTML = `
      <section class="hero"><div class="hero-row"><div><p class="kick">ที่ตั้งไว้</p><h1>เตือนซ้ำ</h1><p class="sub">ทุกเรื่องที่ IPED รับปากว่าจะเตือนคุณ</p></div>${newBtn()}</div></section>
      <div class="page"><div class="toolbar"><div class="seg" role="tablist" aria-label="ประเภทการเตือน" id="repT"></div></div><div id="repL">${loading()}</div><div class="quota" id="repQ"></div></div>`;
    st.reload = loadRepeat; loadRepeat();
  }
  async function loadRepeat() {
    try {
      const r = await api("app/repeat"), c = r.counts || {};
      $("#repT").innerHTML = REP_T.map(([k, l]) => `<button type="button" role="tab" data-rep="${k}" aria-selected="${st.repeatTab === k}">${l} <span style="opacity:.6">${c[k] ?? 0}</span></button>`).join("");
      const items = (r.items || []).filter((i) => repKind(i) === st.repeatTab);
      $("#repL").innerHTML = items.length ? `<div class="list">${items.map((i) => row(i, { right: i.at ? `<div class="next">${st.repeatTab === "repeat" ? "ครั้งถัดไป" : "เตือน"}<b>${esc(whenText(i.at))}</b></div>` : "" })).join("")}</div>`
        : empty("bell", st.repeatTab === "repeat" ? "ยังไม่มีเตือนซ้ำ" : st.repeatTab === "once" ? "ยังไม่มีเตือนครั้งเดียว" : "ทุกเรื่องมีเวลาแล้ว",
          st.repeatTab === "repeat" ? "ลองพิมพ์ “ทุกวันที่ 25 เตือนจ่ายค่าเช่า” ในแชต หรือกด N" : "กด N เพื่อตั้งเตือนใหม่", st.repeatTab === "untimed" ? "" : newBtn());
      const q = r.quota || { used: 0, max: 0 }, pct = q.max ? Math.round((q.used / q.max) * 100) : 0;
      $("#repQ").innerHTML = q.max ? `ใช้เตือนซ้ำไป ${q.used} จาก ${q.max} รายการ<div class="pb ${pct >= 100 ? "full" : pct >= 80 ? "warn" : ""}" role="progressbar" aria-valuenow="${q.used}" aria-valuemin="0" aria-valuemax="${q.max}" aria-label="โควตาเตือนซ้ำ"><i style="width:${Math.min(100, Math.max(2, pct))}%"></i></div>` : "";
    } catch (e) { $("#repL").innerHTML = failBox(e); }
  }

  // ===== หน้า: กลุ่ม =====
  function pageGroups() {
    main.innerHTML = `
      <section class="hero"><p class="kick">กลุ่ม LINE ที่มี IPED อยู่ด้วย</p><h1>กลุ่ม</h1><p class="sub" id="grpSub">กำลังโหลด…</p></section>
      <div class="cols"><section class="col" id="grpL">${loading()}</section>${rpShell()}</div>`;
    st.reload = loadGroups; loadGroups(); loadRp();
  }
  async function loadGroups() {
    try {
      const r = await api("app/groups"), groups = r.groups || [], items = r.items || [];
      if (st.groupSel && !groups.some((g) => g.id === st.groupSel)) st.groupSel = null;
      const open = items.filter((i) => !i.done);
      $("#grpSub").textContent = groups.length ? `อยู่ใน ${groups.length} กลุ่ม · มี ${open.length} เรื่องค้างในกลุ่ม` : "IPED ยังไม่ได้อยู่ในกลุ่มไหน";
      if (!groups.length) {
        $("#grpL").innerHTML = empty("chat", "IPED ยังไม่ได้อยู่ในกลุ่มไหนเลย", "ชวน IPED เข้ากลุ่มงาน แล้วสั่งเตือนให้ทั้งทีมได้ในแชตเดียว",
          `<ol><li>เปิดกลุ่ม LINE ที่อยากให้ IPED ช่วย</li><li>แตะเมนู ≡ มุมขวาบน › เชิญ › ค้นหา “IPED”</li><li>ในกลุ่ม พิมพ์ “@IPED พรุ่งนี้ 10 โมง เตือนประชุม” ได้เลย</li></ol>`);
        return;
      }
      const sel = st.groupSel, list = items.filter((i) => !sel || i.group?.id === sel);
      const gname = groups.find((g) => g.id === sel)?.name;
      $("#grpL").innerHTML = `<div class="groups" role="group" aria-label="เลือกกลุ่ม">${groups.map((g) => `
        <button type="button" class="gcard" data-group="${esc(g.id)}" aria-pressed="${sel === g.id}">
          <span class="gp">${g.picture ? `<img src="${esc(g.picture)}" alt="">` : esc(D.initial(g.name))}</span>
          <span class="gt"><b>${esc(g.name)}</b><small>${g.members ?? "?"} คน · IPED อยู่ตั้งแต่ ${esc(thaiDate(g.joined_at))}</small></span>
          <span class="cnt"><b>${g.counts?.today ?? 0}</b>วันนี้</span>
        </button>`).join("")}</div>
        <h2 class="sec-h">${sel ? esc(gname) : "ทุกกลุ่ม"} <span class="n">${list.length}</span>${sel ? `<button class="btn" type="button" data-group="" style="min-height:32px;margin-left:auto">ดูทุกกลุ่ม</button>` : ""}</h2>
        ${list.length ? `<div class="list">${list.map((i) => row(i, { date: true })).join("")}</div>` : empty("bell", "กลุ่มนี้ยังไม่มีเรื่องให้เตือน", "พิมพ์ “@IPED …” ในกลุ่มเพื่อตั้งเตือนให้ทุกคน", "", "sm")}`;
    } catch (e) { $("#grpL").innerHTML = failBox(e); }
  }

  // ===== หน้า: คลัง =====
  const LIB_T = [["all", "ทั้งหมด"], ["note", "โน้ต"], ["link", "ลิงก์"], ["photo", "รูป"], ["file", "ไฟล์"]];
  const LIB_EMPTY = { all: "ยังไม่มีอะไรในคลัง", note: "ยังไม่มีโน้ต", link: "ยังไม่มีลิงก์", photo: "ยังไม่มีรูป", file: "ยังไม่มีไฟล์" };
  function pageLibrary(type) {
    if (!LIB_T.some(([k]) => k === type)) type = "all";
    st.lib.type = type;
    try { st.lib.view = localStorage.getItem("iped.libview") || st.lib.view; } catch {}
    main.innerHTML = `
      <section class="hero"><div class="hero-row"><div><p class="kick">ทุกอย่างที่ฝาก IPED ไว้</p><h1>คลัง</h1><p class="sub" id="libSub">กำลังโหลด…</p></div>
        <label class="lib-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><span class="sr">ค้นหาในคลัง</span><input class="inp" id="libQ" type="search" placeholder="ค้นชื่อ หรือสิ่งที่จำได้ เช่น ใบเสนอราคา" value="${esc(st.lib.q)}" autocomplete="off"></label></div></section>
      <div class="page" style="max-width:1100px">
        <div class="toolbar">
          <div class="seg" role="tablist" aria-label="ประเภท" id="libT"></div><span class="grow"></span>
          <span class="storage" id="libS"></span>
          <div class="seg" role="group" aria-label="มุมมอง"><button type="button" data-view="list" aria-pressed="${st.lib.view === "list"}" aria-label="แบบรายการ" style="padding:0 10px">${svg("list").replace("<svg", '<svg width="18" height="18"')}</button><button type="button" data-view="grid" aria-pressed="${st.lib.view === "grid"}" aria-label="แบบตาราง" style="padding:0 10px">${svg("grid").replace("<svg", '<svg width="18" height="18"')}</button></div>
        </div>
        <div class="drop" id="drop">${svg("upload").replace("<svg", '<svg width="18" height="18" style="vertical-align:-3px"')} ลากไฟล์หรือรูปมาวางตรงนี้ เพื่อฝากไว้ในคลัง · <button type="button" data-act="pick">เลือกไฟล์</button><div class="prog" id="upProg" aria-live="polite"></div></div>
        <div id="libL">${loading()}</div>
      </div>`;
    st.reload = loadLibrary; loadLibrary();
  }
  let libSeq = 0;
  async function loadLibrary() {
    const my = ++libSeq, L = st.lib;
    try {
      const r = await api(`app/library?type=${L.type}&q=${encodeURIComponent(L.q)}`);
      if (my !== libSeq || !$("#libL")) return;
      const c = r.counts || {};
      $("#libSub").textContent = `${c.all ?? 0} รายการ`;
      $("#libT").innerHTML = LIB_T.map(([k, l]) => `<button type="button" role="tab" data-lib="${k}" aria-selected="${L.type === k}">${l} <span style="opacity:.6">${c[k] ?? 0}</span></button>`).join("");
      const s = r.storage || { used: 0, max: 0 }, pct = s.max ? Math.round((s.used / s.max) * 100) : 0;
      $("#libS").innerHTML = s.max ? `<span>${bytes(s.used)} / ${bytes(s.max)}</span><span class="pb" role="progressbar" aria-label="พื้นที่ที่ใช้" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(2, pct)}%"></i></span>` : "";
      const items = r.items || [];
      for (const i of items) st.cache.set(i.id, i);
      if (!items.length) {
        $("#libL").innerHTML = L.q ? empty("reading", `ไม่เจอ “${esc(L.q)}”`, "ลองคำอื่น หรือดูในแท็บทั้งหมด") : empty("reading", LIB_EMPTY[L.type], "ลากไฟล์มาวางด้านบน หรือส่งรูป ลิงก์ โน้ต ให้ IPED ในแชต แล้วจะเก็บไว้ที่นี่");
        return;
      }
      $("#libL").innerHTML = L.view === "grid" ? `<div class="lib-grid">${items.map(tile).join("")}</div>` : `<div class="list">${items.map(libRow).join("")}</div>`;
    } catch (e) { if (my === libSeq && $("#libL")) $("#libL").innerHTML = failBox(e); }
  }
  const delBtn = (i) => i.editable ? `<button class="ib" type="button" data-del="${esc(i.id)}" aria-label="ลบ ${esc(i.title)}">${svg("trash")}</button>` : "";
  function libRow(i) {
    const thumb = i.thumb ? `<span class="ico-src" style="overflow:hidden;padding:0"><img src="${esc(i.thumb)}" alt="" style="width:100%;height:100%;object-fit:cover"></span>` : `<span class="ico-src">${svg(i.source)}</span>`;
    const title = i.url && i.source !== "note" ? `<a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">${esc(i.title)}</a>` : esc(i.title);
    const meta = [SRC[i.source]];
    if (i.size) meta.push(bytes(i.size));
    if (i.source === "link" && i.url) meta.push(esc(i.url.replace(/^https?:\/\//, "").slice(0, 60)));
    return `<article class="it" data-id="${esc(i.id)}">${thumb}<div class="bd"><div class="ttl">${title}</div><div class="meta"><span>${meta.join(" · ")}</span></div>${i.body ? `<div class="meta">${esc(i.body.slice(0, 160))}</div>` : ""}</div>${delBtn(i)}</article>`;
  }
  function tile(i) {
    const pv = i.thumb ? `<img src="${esc(i.thumb)}" alt="" loading="lazy">` : i.source === "note" && i.body ? `<span class="nt">${esc(i.body)}</span>` : svg(i.source);
    const inner = `<div class="pv">${pv}</div><div class="tb"><b>${esc(i.title)}</b><small>${SRC[i.source]}${i.size ? " · " + bytes(i.size) : ""}</small></div>`;
    return `<article class="tile" data-id="${esc(i.id)}">${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:contents">${inner}</a>` : inner}${delBtn(i).replace('class="ib"', 'class="del"')}</article>`;
  }
  const MAX_UP = 10 * 1024 * 1024;
  async function upload(files) {
    const prog = $("#upProg");
    for (const f of files) {
      if (f.size > MAX_UP) { toast(`“${f.name}” ใหญ่เกิน 10 MB`); continue; }
      if (prog) prog.textContent = `กำลังอัปโหลด ${f.name}…`;
      try {
        const data = await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1] || ""); fr.onerror = () => no(new Error("อ่านไฟล์ไม่ได้")); fr.readAsDataURL(f); });
        await api("app/library/upload", { name: f.name, mime: f.type || "application/octet-stream", data_base64: data });
        toast(`เก็บ “${f.name}” เข้าคลังแล้ว`);
      } catch (e) { toast(errText(e)); }
    }
    if (prog) prog.textContent = "";
    if (st.route.startsWith("library")) loadLibrary(); else location.hash = "#library/all";
  }

  // ===== หน้า: ตั้งค่า =====
  const TEASE = ["สุภาพ", "เป็นกันเอง", "ขี้เล่น", "กวนสุด"];
  const TEASE_SAMPLE = [
    "รับทราบครับ พรุ่งนี้ 09:00 จะเตือนให้โทรหาลูกค้านะครับ",
    "โอเคเลย พรุ่งนี้ 9 โมงเดี๋ยวสะกิดให้โทรหาลูกค้านะ",
    "จดแล้ว! พรุ่งนี้ 9 โมงเจอกัน อย่าเพิ่งเผลองีบนะ ลูกค้ารออยู่",
    "รับคำสั่งครับบอส พรุ่งนี้ 9 โมงจะมาเคาะโต๊ะให้โทรหาลูกค้า ถ้าไม่โทรเป็ดงอนจริงนะ",
  ];
  const ZONES = [["Asia/Bangkok", "กรุงเทพฯ (GMT+7)"], ["Asia/Ho_Chi_Minh", "โฮจิมินห์ (GMT+7)"], ["Asia/Yangon", "ย่างกุ้ง (GMT+6:30)"], ["Asia/Singapore", "สิงคโปร์ (GMT+8)"], ["Asia/Tokyo", "โตเกียว (GMT+9)"], ["Asia/Kolkata", "อินเดีย (GMT+5:30)"], ["Europe/London", "ลอนดอน"], ["America/Los_Angeles", "ลอสแอนเจลิส"], ["Australia/Sydney", "ซิดนีย์"]];
  function usageCard(icon, label, u, unit, isBytes) {
    u = u || { used: 0, max: 0 };
    const pct = u.max ? Math.round((u.used / u.max) * 100) : 0, left = Math.max(0, (u.max || 0) - (u.used || 0));
    const v = isBytes ? `${bytes(u.used)}<small> / ${bytes(u.max)}</small>` : `${u.used}<small> / ${u.max}</small>`;
    return `<div class="uc"><div class="h"><i>${svg(icon)}</i>${label}</div><div class="v">${v}</div><div class="l">เหลือ ${isBytes ? bytes(left) : left + " " + unit}</div>
      <div class="pb ${pct >= 100 ? "full" : pct >= 80 ? "warn" : ""}" role="progressbar" aria-label="${label}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.min(100, Math.max(2, pct))}%"></i></div></div>`;
  }
  function pageSettings() {
    main.innerHTML = `<section class="hero"><p class="kick">IPED</p><h1>ตั้งค่า</h1><p class="sub">ใช้ร่วมกับ IPED ใน LINE เปลี่ยนที่นี่ ในแชตก็เปลี่ยนตาม</p></section><div class="page" id="setP" style="max-width:1100px">${loading()}</div>`;
    st.reload = loadSettings; loadSettings();
  }
  async function loadSettings() {
    try { applySettings(await api("app/settings")); drawSettings(); }
    catch (e) { $("#setP").innerHTML = failBox(e); }
  }
  function applySettings(s) {
    st.settings = s;
    if (s.tz?.zone) { st.zone = s.tz.zone; fmtCache = null; }
    if (s.me) { st.me = { ...st.me, ...s.me, pic: s.me.pic || st.me.pic }; drawMe(); }
  }
  function drawSettings() {
    const s = st.settings, el = $("#setP"); if (!el || !s) return;
    const u = s.usage || {}, bot = s.bot || { nickname: "IPED", tease: 1 }, tz = s.tz || { mode: "auto", zone: "Asia/Bangkok" };
    const theme = document.documentElement.dataset.theme || "dark";
    el.innerHTML = `
      <div class="set-grid">
        <div class="card prof"><div class="pav">${st.me.pic ? `<img src="${esc(st.me.pic)}" alt="" referrerpolicy="no-referrer">` : ""}</div>
          <div class="pt"><b>${esc(st.me.name || "ผู้ใช้ IPED")}</b>${st.me.title ? `<small>${esc(st.me.title)}</small>` : ""}<small>สมาชิกตั้งแต่ ${esc(thaiDate(s.member_since))}</small><span class="role">ผู้ช่วยประจำตัวในบริษัท</span></div></div>
        <div><div class="sec-t" style="margin-top:0">การใช้งาน</div><div class="usage">
          ${usageCard("reminder", "เตือนครั้งเดียว", u.reminders_once, "ครั้ง")}
          ${usageCard("repeat", "เตือนซ้ำ", u.reminders_repeat, "รายการ")}
          ${usageCard("disk", "พื้นที่ไฟล์", u.storage, "", true)}</div></div>
      </div>
      <div class="set-grid" style="margin-top:6px">
        <div>
          <div class="sec-t">ปรับแต่ง IPED</div>
          <div class="card">
            <div class="field"><label for="nick">ชื่อเล่นของเลขา <span class="saved" id="nickOk">บันทึกแล้ว</span></label><input class="inp" id="nick" maxlength="20" value="${esc(bot.nickname || "")}" placeholder="IPED"><p class="hint">ใช้เรียกในกลุ่มได้ เช่น “@${esc(bot.nickname || "IPED")} เตือนประชุม”</p></div>
            <span class="lbl" id="teaseL">ระดับความกวน <span class="saved" id="teaseOk">บันทึกแล้ว</span></span>
            <div class="persona"><img src="../assets/lekaped-mascot.svg" alt="" width="72" height="72"><div class="bub bot" id="sample" aria-live="polite">${esc(bot.sample || TEASE_SAMPLE[bot.tease ?? 1])}</div></div>
            <div class="slider"><input type="range" id="tease" min="0" max="3" step="1" value="${bot.tease ?? 1}" aria-labelledby="teaseL" aria-valuetext="${TEASE[bot.tease ?? 1]}">
              <div class="ticks">${TEASE.map((t, i) => `<button type="button" data-tease="${i}" aria-pressed="${(bot.tease ?? 1) === i}">${t}</button>`).join("")}</div></div>
            <p class="hint">ทุกระดับสุภาพพอสำหรับที่ทำงาน แค่ขี้เล่นมากขึ้น</p>
          </div>
          <div class="sec-t">ปฏิทิน</div>
          <div class="card cal"><span class="gi" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="3" fill="#fff" stroke="#4e6a86" stroke-width="1.6"/><path d="M3 9h18" stroke="#4e6a86" stroke-width="1.6"/><rect x="3" y="4" width="18" height="5" rx="2" fill="#4e6a86"/><text x="12" y="18.5" font-size="8" font-weight="700" text-anchor="middle" fill="#4e6a86" font-family="system-ui">31</text></svg></span>
            <div class="ct"><b>Google Calendar</b><small>${s.calendar?.connected ? "เชื่อมแล้ว" : "ดึงนัดจากปฏิทินมาเตือนใน LINE"}</small></div>
            <button class="btn" type="button" data-act="soon">เชื่อมต่อ</button></div>
        </div>
        <div>
          <div class="sec-t">เวลาและหน้าตา</div>
          <div class="card">
            <div class="field"><span class="lbl" id="tzL">โซนเวลา <span class="saved" id="tzOk">บันทึกแล้ว</span></span>
              <div class="seg full" role="group" aria-labelledby="tzL"><button type="button" data-tz="auto" aria-pressed="${tz.mode === "auto"}">อัตโนมัติ</button><button type="button" data-tz="manual" aria-pressed="${tz.mode === "manual"}">เลือกเอง</button></div>
              <p class="hint" id="tzHint">${tz.mode === "auto" ? `ตามเครื่องที่ใช้ตอนนี้ (${esc(tz.zone)})` : ""}</p>
              <select class="inp" id="tzZone" aria-label="เลือกโซนเวลา" ${tz.mode === "manual" ? "" : "hidden"} style="margin-top:8px">${ZONES.some(([z]) => z === tz.zone) ? "" : `<option value="${esc(tz.zone)}">${esc(tz.zone)}</option>`}${ZONES.map(([z, l]) => `<option value="${z}" ${z === tz.zone ? "selected" : ""}>${l}</option>`).join("")}</select></div>
            <div class="field" style="margin:0"><span class="lbl" id="thL">ธีม</span>
              <div class="seg full" role="group" aria-labelledby="thL">${[["dark", "มืด"], ["light", "สว่าง"], ["auto", "ตามเครื่อง"]].map(([v, l]) => `<button type="button" data-theme-set="${v}" aria-pressed="${theme === v}">${l}</button>`).join("")}</div>
              <p class="hint">ธีมจำไว้ในเบราว์เซอร์เครื่องนี้</p></div>
          </div>
          <div class="sec-t">บัญชี</div>
          <div class="card rows">
            <div><span class="rt">เชื่อมกับ LINE<small>เข้าใช้ด้วยบัญชี LINE ของคุณ</small></span><span class="tag" style="background:var(--sage-bg);color:var(--sage)">เชื่อมแล้ว</span></div>
            <a href="#integrations" style="display:flex;align-items:center;gap:12px;min-height:56px;text-decoration:none;border-bottom:1px solid var(--line)"><span class="rt">แอปที่เชื่อมต่อ<small>ปฏิทินและบริการอื่น</small></span>${svg("right").replace("<svg", '<svg width="18" height="18"')}</a>
            <button type="button" data-act="wipe"><span class="rt"><span class="danger">ลบข้อมูลทั้งหมดของฉัน</span><small>แจ้งเตือน To Do คลัง ความจำ และสไตล์การคุย · งานบริษัทไม่ถูกลบ</small></span>${svg("trash").replace("<svg", '<svg width="18" height="18" style="color:var(--bad)"')}</button>
          </div>
        </div>
      </div>`;
  }
  let nickT;
  async function saveSettings(body, okId) {
    try {
      applySettings(await api("app/settings", body));
      const ok = $(okId); if (ok) { ok.classList.add("on"); setTimeout(() => ok.classList.remove("on"), 1500); }
      return true;
    } catch (e) { toast(errText(e)); return false; }
  }
  function setTease(v, save = true) {
    v = Math.max(0, Math.min(3, +v));
    $("#tease").value = v; $("#tease").setAttribute("aria-valuetext", TEASE[v]);
    for (const b of $$("[data-tease]")) b.setAttribute("aria-pressed", String(+b.dataset.tease === v));
    $("#sample").textContent = TEASE_SAMPLE[v];
    if (save) saveSettings({ tease: v }, "#teaseOk").then((ok) => { if (ok && st.settings?.bot?.sample && $("#sample")) $("#sample").textContent = st.settings.bot.sample; });
  }

  // ===== หน้า: เชื่อมต่อแอป =====
  function pageIntegrations() {
    st.reload = null;
    main.innerHTML = `<section class="hero"><p class="kick">ให้ IPED รู้มากขึ้น</p><h1>เชื่อมต่อแอป</h1><p class="sub">เชื่อมบริการที่ใช้อยู่ แล้ว IPED จะเตือนให้ครบในที่เดียว</p></section>
      <div class="page"><div class="int-grid">
        <div class="card int"><div class="cal"><span class="gi" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="3" fill="#fff" stroke="#4e6a86" stroke-width="1.6"/><rect x="3" y="4" width="18" height="5" rx="2" fill="#4e6a86"/><text x="12" y="18.5" font-size="8" font-weight="700" text-anchor="middle" fill="#4e6a86" font-family="system-ui">31</text></svg></span><div class="ct"><b>Google Calendar</b><small>ดึงนัดหมายมาเตือนก่อนเวลา และสร้างนัดจากแชต</small></div></div>
          <button class="btn" type="button" disabled>เร็วๆ นี้</button></div>
        <div class="card int"><div class="cal"><span class="gi" aria-hidden="true" style="background:#56704f"><svg viewBox="0 0 24 24" style="stroke:#fff;fill:none"><path d="M5 11c0-4 3-6.5 7-6.5s7 2.5 7 6.5-3 6.5-7 6.5c-.8 0-1.6-.1-2.3-.3L6 19l.8-3C5.7 14.8 5 13 5 11z"/></svg></span><div class="ct"><b>LINE</b><small>คุยกับ IPED ในแชตส่วนตัวและกลุ่มงาน</small></div></div>
          <span class="tag" style="align-self:flex-start;background:var(--sage-bg);color:var(--sage)">เชื่อมแล้ว</span></div>
      </div></div>`;
  }

  // ===== ตัวนำทาง (hash) =====
  const ROUTES = { today: pageToday, todo: pageTodo, repeat: pageRepeat, groups: pageGroups, settings: pageSettings, integrations: pageIntegrations };
  function route() {
    const h = (location.hash || "#today").slice(1);
    const [name, arg] = h.split("/");
    st.route = h;
    document.body.classList.remove("drawer");
    for (const a of $$("[data-r]")) {
      const r = a.dataset.r, on = r === h || (r === "library" && name === "library") || (r === name && !arg);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    }
    st.cache.clear();
    if (name === "library") pageLibrary(arg || "all");
    else (ROUTES[name] || pageToday)();
    const titles = { today: "วันนี้", todo: "To Do", repeat: "เตือนซ้ำ", groups: "กลุ่ม", library: "คลัง", settings: "ตั้งค่า", integrations: "เชื่อมต่อแอป" };
    document.title = `${titles[name] || "วันนี้"} · IPED`;
    window.scrollTo(0, 0);
  }
  function refresh() { st.reload?.(); loadRp(); }

  // ===== ผู้ใช้ในแถบข้าง =====
  function drawMe() {
    $("#meName").textContent = st.me.name || "IPED";
    $("#meSub").innerHTML = esc(st.me.title || "เลขาของคุณใน LINE") + (MOCK ? ' <span class="tag" style="background:var(--amber-bg);color:var(--amber)">MOCK</span>' : "");
    $("#meAv").innerHTML = st.me.pic ? `<img src="${esc(st.me.pic)}" alt="" referrerpolicy="no-referrer">` : "";
  }

  // ===== หน้าต่าง: สร้างใหม่ =====
  const dlgC = $("#dlgCreate");
  let crKind = "todo", crImp = 0;
  function segSet(box, v) { for (const b of box.children) b.setAttribute("aria-pressed", String(b.dataset.v === String(v))); }
  function openCreate(preset = {}) {
    $("#crForm").reset(); $("#crMsg").innerHTML = "";
    $("#crMore").open = !!preset.more;
    crKind = preset.kind || "todo"; crImp = 0; segSet($("#crKind"), crKind); segSet($("#crImp"), 0); kindFields();
    openDlg(dlgC); setTimeout(() => $("#crText").focus(), 30);
  }
  function kindFields() {
    $("#crUrlF").hidden = crKind !== "link"; $("#crBodyF").hidden = crKind === "todo"; $("#crTimeF").hidden = crKind !== "todo";
  }
  $("#crKind").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; crKind = b.dataset.v; segSet($("#crKind"), crKind); kindFields(); };
  $("#crImp").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; crImp = +b.dataset.v; segSet($("#crImp"), crImp); };
  $("#crForm").onsubmit = async (e) => {
    e.preventDefault();
    const text = $("#crText").value.trim(), title = $("#crTitle").value.trim();
    let body;
    if ($("#crMore").open && title) {
      body = { title, importance: crImp };
      if (crKind === "todo") {
        const d = $("#crDate").value, t = $("#crTime").value;
        if (d || t) body.at = toIso(d || todayYmd(), t || "09:00");
        const rep = $("#crRepeat").value;
        if (rep) body.repeat = t ? `${rep} ${t}` : rep;
        if (!body.at && !body.repeat) body.kind = "todo";   // ไม่มีเวลา = To Do เข้า Inbox · มีเวลา = เตือน (ไม่ส่ง kind)
      } else {
        body.kind = crKind;
        const b = $("#crBody").value.trim(); if (b) body.body = b;
        if (crKind === "link") {
          const u = $("#crUrl").value.trim();
          if (!/^https?:\/\/\S+/.test(u)) { $("#crMsg").innerHTML = `<div class="err" role="alert">ใส่ลิงก์ที่ขึ้นต้นด้วย https://</div>`; $("#crUrl").focus(); return; }
          body.url = u;
        }
      }
    } else if (text) body = { text };
    else { $("#crMsg").innerHTML = `<div class="err" role="alert">พิมพ์สิ่งที่อยากให้ IPED จำก่อน</div>`; $("#crText").focus(); return; }
    await D.busy($("#crGo"), async () => {
      try { const r = await api("app/items", body); closeDlg(dlgC); toast(r.said || "บันทึกแล้ว"); refresh(); }
      catch (er) { $("#crMsg").innerHTML = `<div class="err" role="alert">${esc(errText(er))}</div>`; }
    }, "กำลังบันทึก…");
  };
  $("#crText").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("#crForm").requestSubmit(); } });

  // ===== หน้าต่าง: แก้ไขรายการ =====
  const dlgI = $("#dlgItem");
  let cur = null, itImp = 0, delArmed = false;
  function openItem(it) {
    cur = it; delArmed = false;
    $("#itDel").textContent = "ลบ";
    $("#itT").textContent = `แก้ไข${SRC[it.source] ? " " + SRC[it.source] : ""}`;
    $("#itMeta").textContent = [it.repeat && `เตือนซ้ำ ${it.repeat}`, it.group && `กลุ่ม ${it.group.name}`].filter(Boolean).join(" · ");
    $("#itTitle").value = it.title;
    const timed = it.source === "reminder" || it.source === "todo";
    $("#itTimeF").hidden = !timed; $("#itImpF").hidden = !timed;
    const p = it.at ? parts(it.at) : null;
    $("#itDate").value = p ? p.ymd : ""; $("#itTime").value = p ? p.hm : "";
    itImp = it.importance || 0; segSet($("#itImp"), itImp);
    $("#itMsg").innerHTML = "";
    openDlg(dlgI);
  }
  $("#itImp").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; itImp = +b.dataset.v; segSet($("#itImp"), itImp); };
  $("#itForm").onsubmit = async (e) => {
    e.preventDefault();
    const title = $("#itTitle").value.trim();
    if (!title) { $("#itMsg").innerHTML = `<div class="err" role="alert">ชื่อเรื่องว่างไม่ได้</div>`; return; }
    const body = { id: cur.id, source: cur.source, title };
    if (!$("#itTimeF").hidden) {
      const d = $("#itDate").value, t = $("#itTime").value;
      body.at = d || t ? toIso(d || todayYmd(), t || "09:00") : null;
      body.importance = itImp;
    }
    await D.busy($("#itGo"), async () => {
      try { await api("app/items/update", body); closeDlg(dlgI); toast("บันทึกแล้ว"); refresh(); }
      catch (er) { $("#itMsg").innerHTML = `<div class="err" role="alert">${esc(errText(er))}</div>`; }
    }, "กำลังบันทึก…");
  };
  $("#itDel").onclick = async () => {
    if (!delArmed) { delArmed = true; $("#itDel").textContent = "กดอีกครั้งเพื่อลบ"; return; }
    await D.busy($("#itDel"), () => removeItem(cur).then((ok) => ok && closeDlg(dlgI)), "กำลังลบ…");
  };
  async function removeItem(it) {
    try { await api("app/items/delete", { id: it.id, source: it.source }); toast(`ลบ “${it.title}” แล้ว`); refresh(); return true; }
    catch (e) { toast(errText(e)); return false; }
  }
  async function toggleDone(it, btn) {
    const done = !it.done;
    btn.setAttribute("aria-checked", String(done)); btn.closest(".it")?.classList.toggle("done", done);
    try { await api("app/items/update", { id: it.id, source: it.source, done }); it.done = done; toast(done ? `เสร็จแล้ว: ${it.title}` : "ย้ายกลับไปยังไม่เสร็จ"); setTimeout(refresh, 350); }
    catch (e) { btn.setAttribute("aria-checked", String(!done)); btn.closest(".it")?.classList.toggle("done", !done); toast(errText(e)); }
  }

  // ===== หน้าต่าง: ค้นหา =====
  const dlgS = $("#dlgSearch");
  let seT, sePool = null;
  async function openSearch() {
    $("#seQ").value = ""; $("#seRes").innerHTML = `<p class="none">พิมพ์เพื่อค้นหาเตือน To Do และของในคลัง</p>`;
    openDlg(dlgS); setTimeout(() => $("#seQ").focus(), 30);
    sePool = Promise.all([api("app/repeat").catch(() => ({ items: [] })), api("app/todo?filter=all").catch(() => ({ items: [] }))])
      .then(([a, b]) => { const m = new Map(); for (const i of [...(a.items || []), ...(b.items || [])]) m.set(i.id, i); return [...m.values()]; });
  }
  $("#seQ").oninput = () => {
    clearTimeout(seT);
    seT = setTimeout(async () => {
      const q = $("#seQ").value.trim(), box = $("#seRes");
      if (!q) { box.innerHTML = `<p class="none">พิมพ์เพื่อค้นหาเตือน To Do และของในคลัง</p>`; return; }
      const ql = q.toLowerCase();
      const [pool, lib] = await Promise.all([sePool, api(`app/library?type=all&q=${encodeURIComponent(q)}`).catch(() => ({ items: [] }))]);
      if ($("#seQ").value.trim() !== q) return;
      const rem = pool.filter((i) => (i.title + " " + (i.body || "")).toLowerCase().includes(ql)).slice(0, 8);
      const li = (lib.items || []).slice(0, 8);
      box.innerHTML = !rem.length && !li.length ? `<p class="none">ไม่เจอ “${esc(q)}”</p>`
        : (rem.length ? `<div class="se-h">แจ้งเตือนและ To Do</div><div class="list">${rem.map((i) => row(i, { date: true })).join("")}</div>` : "")
        + (li.length ? `<div class="se-h">คลัง</div><div class="list">${li.map((i) => { st.cache.set(i.id, i); return libRow(i); }).join("")}</div>` : "");
    }, 200);
  };

  // ===== หน้าต่าง: ลบข้อมูล =====
  const dlgW = $("#dlgWipe");
  $("#wpIn").oninput = () => { $("#wpGo").disabled = $("#wpIn").value.trim() !== "ลบ"; };
  $("#wpForm").onsubmit = async (e) => {
    e.preventDefault();
    if ($("#wpIn").value.trim() !== "ลบ") return;
    await D.busy($("#wpGo"), async () => {
      try {
        const r = await api("app/account/delete-data", { confirm: "ลบ" });
        const n = Object.values(r.deleted || {}).reduce((a, v) => a + (+v || 0), 0);
        closeDlg(dlgW); toast(n ? `ลบข้อมูลของคุณแล้ว ${n} รายการ` : "ลบข้อมูลของคุณแล้ว"); refresh();
      } catch (er) { $("#wpMsg").innerHTML = `<div class="err" role="alert">${esc(errText(er))}</div>`; }
    }, "กำลังลบ…");
  };

  // ===== dialog ทั่วไป =====
  function openDlg(d) { if (!d.open) d.showModal(); }
  function closeDlg(d) { if (d.open) d.close(); }
  for (const d of $$("dialog")) d.addEventListener("click", (e) => { if (e.target === d) d.close(); });   // แตะพื้นหลัง = ปิด

  // ===== แชต =====
  const chat = $("#chat");
  function toggleChat(force) {
    const on = force ?? chat.hidden;
    chat.hidden = !on;
    if (on) { drawChat(); $("#chatText").focus(); }
    else $(".chat-fab").focus();
  }
  const SUGG = ["วันนี้มีอะไรบ้าง", "พรุ่งนี้ 9 โมง โทรหาลูกค้า", "ทุกวันที่ 25 เตือนจ่ายค่าเช่า"];
  function drawChat() {
    const log = $("#chatLog");
    if (!st.chat.length) {
      log.innerHTML = `<div class="chat-hello"><img src="../assets/lekaped-mascot.svg" alt="">สวัสดีครับ พิมพ์สั่ง ${esc(st.settings?.bot?.nickname || "IPED")} ได้เหมือนในแชต LINE<div class="chat-sugg">${SUGG.map((s) => `<button type="button" data-sugg="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>`;
      return;
    }
    log.innerHTML = st.chat.map((m) => m.who === "me" ? `<div class="bub me">${esc(m.text)}</div>`
      : m.kind === "card" ? `<div class="bub card"><div class="ch"><img src="../assets/lekaped-mark.svg" alt="">IPED · การ์ด</div><div class="cb">${esc(m.text)}</div></div>`
      : `<div class="bub bot${m.typing ? " typing" : ""}">${esc(m.text)}</div>`).join("");
    log.scrollTop = log.scrollHeight;
  }
  function toBubbles(msgs) {
    return (msgs || []).map((m) => {
      if (m.type === "text") return { who: "bot", text: m.text };
      if (m.type === "flex" || m.type === "template") return { who: "bot", kind: "card", text: m.altText || "การ์ด" };
      if (m.type === "image") return { who: "bot", text: "[รูปภาพ]" };
      if (m.type === "sticker") return { who: "bot", text: "[สติกเกอร์]" };
      return { who: "bot", text: m.altText || m.text || "[ข้อความ]" };
    });
  }
  async function sendChat(text) {
    text = text.trim(); if (!text) return;
    st.chat.push({ who: "me", text });
    const typing = { who: "bot", text: "กำลังพิมพ์…", typing: true };
    st.chat.push(typing); drawChat();
    try {
      const r = await api("app/chat", { text });
      st.chat.splice(st.chat.indexOf(typing), 1, ...toBubbles(r.messages));
      refresh();
    } catch (e) { st.chat.splice(st.chat.indexOf(typing), 1, { who: "bot", text: "ส่งไม่สำเร็จ: " + errText(e) }); }
    drawChat();
  }
  $("#chatForm").onsubmit = (e) => { e.preventDefault(); const t = $("#chatText").value; $("#chatText").value = ""; sendChat(t); };

  // ===== คลิกทั้งหน้า (delegation) =====
  document.addEventListener("click", (e) => {
    const t = e.target;
    const act = t.closest("[data-act]")?.dataset.act;
    if (act) {
      if (act === "create") openCreate();
      else if (act === "search") openSearch();
      else if (act === "keys") openDlg($("#dlgKeys"));
      else if (act === "chat") toggleChat();
      else if (act === "chat-close") toggleChat(false);
      else if (act === "drawer") document.body.classList.toggle("drawer");
      else if (act === "soon") toast("เชื่อม Google Calendar เร็วๆ นี้");
      else if (act === "wipe") { $("#wpForm").reset(); $("#wpGo").disabled = true; $("#wpMsg").innerHTML = ""; openDlg(dlgW); setTimeout(() => $("#wpIn").focus(), 30); }
      else if (act === "pick") $("#upFile").click();
      else if (act === "retry") refresh();
      return;
    }
    if (t.closest("[data-dlg-close]")) { closeDlg(t.closest("dialog")); return; }
    if (t.closest("[data-drawer-close]")) { document.body.classList.remove("drawer"); return; }
    let b;
    if ((b = t.closest("[data-chk]"))) { const it = st.cache.get(b.dataset.chk); if (it) toggleDone(it, b); return; }
    if ((b = t.closest("[data-edit]"))) { const it = st.cache.get(b.dataset.edit); if (it) { closeDlg(dlgS); openItem(it); } return; }
    if ((b = t.closest("[data-del]"))) {
      e.preventDefault();
      const it = st.cache.get(b.dataset.del); if (!it) return;
      if (b.dataset.armed) { b.disabled = true; removeItem(it); }
      else { b.dataset.armed = "1"; b.style.color = "var(--bad)"; b.setAttribute("aria-label", "กดอีกครั้งเพื่อยืนยันการลบ"); toast("กดถังขยะอีกครั้งเพื่อยืนยันการลบ"); setTimeout(() => { delete b.dataset.armed; b.style.color = ""; }, 3000); }
      return;
    }
    if ((b = t.closest("[data-rp]"))) { st.rpTab = b.dataset.rp; drawRp(); return; }
    if ((b = t.closest("[data-range]"))) { st.today.range = b.dataset.range; st.today.data = null; pageToday(); return; }
    if ((b = t.closest("[data-day]"))) { st.today.date = b.dataset.day; pageToday(); return; }
    if ((b = t.closest("[data-shift]"))) { st.today.date = addDays(st.today.date, +b.dataset.shift); pageToday(); return; }
    if ((b = t.closest("[data-filter]"))) { st.today.filter = b.dataset.filter; drawToday(); return; }
    if ((b = t.closest("[data-todo]"))) { st.todoFilter = b.dataset.todo; loadTodo(); return; }
    if ((b = t.closest("[data-rep]"))) { st.repeatTab = b.dataset.rep; loadRepeat(); return; }
    if ((b = t.closest("[data-group]"))) { st.groupSel = b.dataset.group || null; loadGroups(); return; }
    if ((b = t.closest("[data-lib]"))) { location.hash = "#library/" + b.dataset.lib; return; }
    if ((b = t.closest("[data-view]"))) { st.lib.view = b.dataset.view; try { localStorage.setItem("iped.libview", st.lib.view); } catch {} for (const x of $$("[data-view]")) x.setAttribute("aria-pressed", String(x === b)); loadLibrary(); return; }
    if ((b = t.closest("[data-tease]"))) { setTease(b.dataset.tease); return; }
    if ((b = t.closest("[data-tz]"))) {
      const mode = b.dataset.tz;
      for (const x of $$("[data-tz]")) x.setAttribute("aria-pressed", String(x === b));
      $("#tzZone").hidden = mode !== "manual";
      const zone = mode === "auto" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Bangkok" : $("#tzZone").value;
      $("#tzHint").textContent = mode === "auto" ? `ตามเครื่องที่ใช้ตอนนี้ (${zone})` : "";
      saveSettings({ tz_mode: mode, tz_zone: zone }, "#tzOk");
      return;
    }
    if ((b = t.closest("[data-theme-set]"))) {
      const v = b.dataset.themeSet; document.documentElement.dataset.theme = v;
      try { localStorage.setItem("iped.theme", v); } catch {}
      for (const x of $$("[data-theme-set]")) x.setAttribute("aria-pressed", String(x === b));
      return;
    }
    if ((b = t.closest("[data-sugg]"))) { sendChat(b.dataset.sugg); return; }
    if (t.closest("#dlgSearch .se-res a")) closeDlg(dlgS);
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "tease") setTease(e.target.value, false);
    if (e.target.id === "nick") { clearTimeout(nickT); const v = e.target.value.trim(); nickT = setTimeout(() => v && saveSettings({ bot_nickname: v }, "#nickOk"), 700); }
    if (e.target.id === "libQ") { clearTimeout(nickT); nickT = setTimeout(() => { st.lib.q = e.target.value.trim(); loadLibrary(); }, 250); }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "tease") setTease(e.target.value);
    if (e.target.id === "tzZone") saveSettings({ tz_mode: "manual", tz_zone: e.target.value }, "#tzOk");
    if (e.target.id === "upFile") { const f = [...e.target.files]; e.target.value = ""; if (f.length) upload(f); }
  });
  document.addEventListener("keydown", async (e) => {
    if (e.target.id === "quick" && e.key === "Enter" && !e.isComposing) {
      const inp = e.target, title = inp.value.trim(); if (!title) return;
      inp.disabled = true;
      try { const r = await api("app/items", { title, kind: "todo" }); inp.value = ""; toast(r.said || "จดเข้า Memo แล้ว"); st.rpTab = "inbox"; await loadRp(); st.reload === loadTodo && loadTodo(); }
      catch (er) { toast(errText(er)); }
      inp.disabled = false; $("#quick")?.focus();
    }
  });
  // ลากไฟล์มาวาง (ทั้งหน้าคลัง)
  let dragN = 0;
  document.addEventListener("dragenter", (e) => { if (!$("#drop") || !e.dataTransfer?.types?.includes("Files")) return; e.preventDefault(); dragN++; $("#drop").classList.add("over"); });
  document.addEventListener("dragover", (e) => { if ($("#drop") && e.dataTransfer?.types?.includes("Files")) e.preventDefault(); });
  document.addEventListener("dragleave", () => { if (!$("#drop")) return; if (--dragN <= 0) { dragN = 0; $("#drop").classList.remove("over"); } });
  document.addEventListener("drop", (e) => {
    if (!$("#drop")) return;
    e.preventDefault(); dragN = 0; $("#drop").classList.remove("over");
    const f = [...(e.dataTransfer?.files || [])]; if (f.length) upload(f);
  });

  // ===== คีย์ลัด =====
  let gAt = 0;
  document.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === "k" || e.key === "K")) { e.preventDefault(); $$("dialog[open]").forEach(closeDlg); openSearch(); return; }
    if (mod && (e.key === "j" || e.key === "J")) { e.preventDefault(); toggleChat(); return; }
    if (e.key === "Escape") {
      if (document.body.classList.contains("drawer")) { document.body.classList.remove("drawer"); return; }
      if (!chat.hidden && !$("dialog[open]")) { toggleChat(false); return; }
    }
    const tg = e.target, typing = tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName);
    if (typing || mod || e.altKey || $("dialog[open]")) return;
    const k = e.key.toLowerCase();
    if (gAt && Date.now() - gAt < 1200) {
      gAt = 0;
      const to = { t: "#today", g: "#groups", d: "#todo", l: "#library/all", r: "#repeat", s: "#settings" }[k];
      if (to) { e.preventDefault(); location.hash = to; }
      return;
    }
    if (k === "g") { gAt = Date.now(); return; }
    if (k === "n") { e.preventDefault(); openCreate(); return; }
    if (e.key === "?") { e.preventDefault(); openDlg($("#dlgKeys")); }
  });

  // ===== ข้อมูลปลอม (?mock=1) · ทำตาม docs/app-contract.md ทุก endpoint =====
  function makeMock() {
    const EMPTY = qs.get("empty") === "1";
    const T = todayYmd();
    const at = (off, hm) => toIso(addDays(T, off), hm);
    const nextDow = (d) => { let x = T; for (let i = 0; i < 7; i++) { if (ymdDow(x) === d && x !== T) return x; x = addDays(x, 1); } return x; };
    const nextDom = (dom) => { const { y, m, d } = ymdParts(T); const mm = d < dom ? m : m + 1; const dt = new Date(Date.UTC(y, mm, dom)); return dt.toISOString().slice(0, 10); };
    const G = [
      { id: "g1", name: "ทีมขายภาคกลาง", picture: null, members: 12, joined_at: at(-120, "10:00") },
      { id: "g2", name: "รีโนเวตสาขา 3", picture: null, members: 7, joined_at: at(-21, "14:00") },
    ];
    const ph = (a, b) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" fill="${a}"/><circle cx="118" cy="34" r="14" fill="#f3f2ef" opacity=".7"/><path d="M0 120L52 58l34 40 22-22 52 44z" fill="${b}"/></svg>`);
    let seq = 1;
    const I = (o) => ({ id: "m" + seq++, body: null, at: null, all_day: false, repeat: null, importance: 0, scope: "mine", group: null, from: null, done: false, url: null, size: null, mime: null, thumb: null, editable: true, ...o });
    const g = (i) => ({ id: G[i].id, name: G[i].name });
    let items = EMPTY ? [] : [
      I({ source: "meeting", title: "สแตนด์อัปทีมขาย", at: at(0, "09:30"), scope: "group", group: g(0), editable: false }),
      I({ source: "reminder", title: "ส่งรายงานยอดขายประจำสัปดาห์", at: at(0, "10:00"), importance: 1 }),
      I({ source: "reminder", title: "โทรนัดคุณสมชาย เรื่องใบเสนอราคา", at: at(0, "14:30") }),
      I({ source: "meeting", title: "ประชุมลูกค้า บริษัท ไทยรุ่งเรือง", at: at(0, "15:00"), editable: false }),
      I({ source: "task", title: "ตรวจแบบร้านสาขา 3 ให้เสร็จ", at: at(0, "17:00"), importance: 2, scope: "to_me", from: "คุณวิภา (หัวหน้าฝ่าย)", editable: false }),
      I({ source: "reminder", title: "กินยาก่อนนอน", at: at(0, "21:00"), repeat: "ทุกวัน 21:00" }),
      I({ source: "reminder", title: "ส่งเอกสารเบิกค่าเดินทาง", at: at(0, "08:30"), done: true }),
      I({ source: "reminder", title: "เตรียมสไลด์ประชุมผู้บริหาร", at: at(1, "09:00"), importance: 2 }),
      I({ source: "todo", title: "ส่งรูปหน้างานให้ผู้รับเหมา", at: at(1, "11:00"), scope: "group", group: g(1) }),
      I({ source: "reminder", title: "ส่งยอดสต็อกเข้ากลุ่ม", at: toIso(nextDow(5), "16:00"), repeat: "ทุกวันศุกร์ 16:00", scope: "group", group: g(0) }),
      I({ source: "reminder", title: "ต่อประกันรถ", at: at(5, "10:00") }),
      I({ source: "reminder", title: "จ่ายค่าเช่าออฟฟิศ", at: toIso(nextDom(25), "09:00"), repeat: "ทุกวันที่ 25 เวลา 09:00", importance: 1 }),
      I({ source: "reminder", title: "นัดตรวจสุขภาพประจำปี", at: null }),
      I({ source: "task", title: "สรุปงบการตลาด Q1", at: at(3, "17:00"), scope: "to_me", from: "คุณธนา (ผู้จัดการ)", editable: false }),
      I({ source: "todo", title: "ซื้อหมึกพิมพ์ให้ฝ่ายบัญชี" }),
      I({ source: "todo", title: "อ่านสัญญาเช่าฉบับใหม่" }),
      I({ source: "todo", title: "สรุปไอเดียแคมเปญปีใหม่", importance: 1 }),
      I({ source: "todo", title: "อัปเดตรายชื่อลูกค้าใน CRM", done: true }),
      I({ source: "note", title: "ไอเดียโปรโมชันเดือนธันวาคม", body: "ซื้อครบ 2,000 ลด 10% · แถมถุงผ้าโลโก้ใหม่ · โพสต์ทุกวันศุกร์" }),
      I({ source: "note", title: "ของที่ต้องเตรียมก่อนเปิดสาขา", body: "ป้ายหน้าร้าน, เครื่อง POS 2 เครื่อง, ชุดยูนิฟอร์ม 8 ชุด, ประกันอัคคีภัย" }),
      I({ source: "link", title: "เว็บไซต์บริษัท", url: "https://infini-ia.com" }),
      I({ source: "link", title: "ตารางราคาวัสดุ 2569", url: "https://docs.google.com/spreadsheets/d/example" }),
      I({ source: "photo", title: "หน้างานสาขา 3.jpg", mime: "image/jpeg", size: 842000, thumb: ph("#615751", "#3a352e"), url: ph("#615751", "#3a352e") }),
      I({ source: "photo", title: "ใบเสร็จค่าน้ำมัน.jpg", mime: "image/jpeg", size: 356000, thumb: ph("#b5aea6", "#8c8277"), url: ph("#b5aea6", "#8c8277") }),
      I({ source: "file", title: "ใบเสนอราคา_Q4.pdf", mime: "application/pdf", size: 1240000 }),
      I({ source: "file", title: "สรุปยอดขายตุลาคม.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 98000 }),
    ];
    const groups = EMPTY ? [] : G;
    const S = {
      me: { name: "นภา ใจดี", title: "เจ้าหน้าที่ฝ่ายขาย" }, member_since: at(-250, "09:00"),
      bot: { nickname: "IPED", tease: 1 }, calendar: { connected: false }, tz: { mode: "auto", zone: "Asia/Bangkok" },
    };
    const LIB = ["note", "link", "photo", "file"];
    const ymdOf = (i) => (i.at ? parts(i.at).ymd : null);
    const clone = (x) => JSON.parse(JSON.stringify(x));
    const settings = () => {
      const rem = items.filter((i) => i.source === "reminder" && !i.done);
      const used = items.filter((i) => i.size).reduce((a, i) => a + i.size, 0);
      return { me: S.me, member_since: S.member_since,
        usage: { reminders_once: { used: rem.filter((i) => !i.repeat).length, max: 200 }, reminders_repeat: { used: rem.filter((i) => i.repeat).length, max: 40 }, storage: { used, max: 1073741824 } },
        bot: { ...S.bot, sample: TEASE_SAMPLE[S.bot.tease] }, calendar: S.calendar, tz: S.tz };
    };
    function parse(text) {
      let t = text, day = null, hm = null, repeat = null;
      if (/พรุ่งนี้/.test(t)) day = 1; else if (/มะรืน/.test(t)) day = 2; else if (/วันนี้|คืนนี้/.test(t)) day = 0;
      const m1 = t.match(/(\d{1,2})[:.](\d{2})/), m2 = t.match(/(บ่าย\s*)?(\d{1,2})\s*โมง(เย็น)?/), m3 = /เที่ยง/.test(t);
      if (m1) hm = `${String(+m1[1]).padStart(2, "0")}:${m1[2]}`;
      else if (m2) { let h = +m2[2]; if ((m2[1] || m2[3]) && h < 12) h += 12; if (!m2[1] && !m2[3] && h < 7) h += 12; hm = `${String(h).padStart(2, "0")}:00`; }
      else if (m3) hm = "12:00";
      const rp = t.match(/ทุก(วันที่\s*\d{1,2}|วันจันทร์|วันอังคาร|วันพุธ|วันพฤหัส(?:บดี)?|วันศุกร์|วันเสาร์|วันอาทิตย์|วันทำงาน|วัน|สัปดาห์|เดือน)/);
      if (rp) repeat = rp[0] + (hm ? " " + hm : "");
      const title = t.replace(/พรุ่งนี้|มะรืน(นี้)?|วันนี้|คืนนี้|(บ่าย\s*)?\d{1,2}\s*โมง(เย็น|เช้า)?|\d{1,2}[:.]\d{2}|น\.|เที่ยง|ทุก(วันที่\s*\d{1,2}|วัน\S*|สัปดาห์|เดือน)|เตือน(ให้)?|ด้วย(นะ)?/g, " ").replace(/\s+/g, " ").trim() || text;
      if (day === null && (hm || repeat)) day = 0;
      return { title, at: day !== null ? toIso(addDays(T, day), hm || "09:00") : null, repeat };
    }
    function create(b) {
      let it;
      if (b.text) {
        const p = parse(b.text);
        it = I({ source: p.at || p.repeat ? "reminder" : "todo", title: p.title, at: p.at, repeat: p.repeat });
      } else {
        if (!b.title) throw Object.assign(new Error("ต้องมีชื่อเรื่อง"), { status: 400 });
        const kind = b.kind || (b.at || b.repeat ? "reminder" : "todo");
        it = I({ source: kind, title: b.title, at: b.at || null, repeat: b.repeat || null, importance: b.importance || 0, body: b.body || null, url: b.url || null,
          scope: b.group_id ? "group" : "mine", group: b.group_id ? groups.find((x) => x.id === b.group_id) && { id: b.group_id, name: groups.find((x) => x.id === b.group_id).name } : null });
      }
      items.push(it);
      const said = LIB.includes(it.source) ? `เก็บ “${it.title}” เข้าคลังแล้ว` : it.at ? `จดแล้ว จะเตือน “${it.title}” ${whenText(it.at)}${it.repeat ? ` (${it.repeat})` : ""}` : `เก็บ “${it.title}” เข้า Inbox แล้ว`;
      return { item: it, said };
    }
    const find = (b) => { const it = items.find((i) => i.id === b.id && i.source === b.source); if (!it) throw Object.assign(new Error("ไม่พบรายการนี้"), { status: 404 }); return it; };
    const byAt = (a, b) => (a.at || "9").localeCompare(b.at || "9");
    function handle(path, b) {
      const [p, q0] = path.split("?"), q = new URLSearchParams(q0 || "");
      switch (p) {
        case "app/today": {
          const date = q.get("date") || T, range = q.get("range") || "day";
          let from = date, n = 1;
          if (range === "week") { from = weekStart(date); n = 7; }
          if (range === "month") { from = date.slice(0, 8) + "01"; const { y, m } = ymdParts(date); n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
          const days = Array.from({ length: n }, (_, i) => addDays(from, i)).map((d) => ({ date: d, items: items.filter((i) => ["reminder", "meeting", "task", "todo"].includes(i.source) && ymdOf(i) === d).sort(byAt) }));
          const all = days.flatMap((d) => d.items);
          const h = +parts(new Date().toISOString()).hm.slice(0, 2);
          return { greeting: `${h < 11 ? "สวัสดีตอนเช้า" : h < 16 ? "สวัสดีตอนบ่าย" : h < 19 ? "สวัสดีตอนเย็น" : "สวัสดีตอนค่ำ"} คุณ${S.me.name.split(" ")[0]}`, date, range, days,
            counts: { all: all.length, mine: all.filter((i) => i.scope === "mine").length, to_me: all.filter((i) => i.scope === "to_me").length, group: all.filter((i) => i.scope === "group").length, important: all.filter((i) => i.importance >= 1).length } };
        }
        case "app/inbox":
          return { inbox: items.filter((i) => i.source === "todo" && !i.at && !i.done), today_events: items.filter((i) => (i.source === "meeting" || i.source === "task") && ymdOf(i) === T).sort(byAt) };
        case "app/todo": {
          const td = items.filter((i) => i.source === "todo"), open = td.filter((i) => !i.done);
          const f = q.get("filter") || "all";
          const sets = { all: open, timed: open.filter((i) => i.at), untimed: open.filter((i) => !i.at), done: td.filter((i) => i.done) };
          return { items: (sets[f] || open).sort(byAt), counts: Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.length])) };
        }
        case "app/repeat": {
          const r = items.filter((i) => i.source === "reminder" && !i.done).sort(byAt);
          return { items: r, counts: { once: r.filter((i) => i.at && !i.repeat).length, repeat: r.filter((i) => i.repeat).length, untimed: r.filter((i) => !i.at && !i.repeat).length }, quota: { used: r.filter((i) => i.repeat).length, max: 40 } };
        }
        case "app/items": return create(b);
        case "app/items/update": {
          const it = find(b);
          if (!it.editable) throw Object.assign(new Error("แก้รายการนี้ไม่ได้"), { status: 403 });
          for (const k of ["title", "at", "importance", "done"]) if (k in b) it[k] = b[k];
          return { item: it };
        }
        case "app/items/delete": { const it = find(b); items = items.filter((x) => x !== it); return { ok: true }; }
        case "app/groups":
          return { groups: groups.map((x) => { const gi = items.filter((i) => i.group?.id === x.id); return { ...x, counts: { today: gi.filter((i) => ymdOf(i) === T).length, open: gi.filter((i) => !i.done).length } }; }),
            items: items.filter((i) => i.group).sort(byAt) };
        case "app/library": {
          const type = q.get("type") || "all", s = (q.get("q") || "").toLowerCase();
          const lib = items.filter((i) => LIB.includes(i.source) && (!s || (i.title + " " + (i.body || "") + " " + (i.url || "")).toLowerCase().includes(s)));
          const counts = { all: lib.length }; for (const k of LIB) counts[k] = lib.filter((i) => i.source === k).length;
          return { items: lib.filter((i) => type === "all" || i.source === type).reverse(), counts, storage: settings().usage.storage };
        }
        case "app/library/upload": {
          const size = Math.floor((b.data_base64 || "").length * 3 / 4);
          if (size > 10 * 1024 * 1024) throw Object.assign(new Error("ไฟล์ใหญ่เกิน 10 MB"), { status: 413 });
          const isImg = /^image\//.test(b.mime), url = `data:${b.mime};base64,${b.data_base64}`;
          const it = I({ source: isImg ? "photo" : "file", title: b.name, mime: b.mime, size, url: size < 4e6 ? url : null, thumb: isImg && size < 4e6 ? url : null });
          items.push(it); return { item: it };
        }
        case "app/settings":
          if (b) {
            if (b.bot_nickname != null) S.bot.nickname = String(b.bot_nickname).slice(0, 20);
            if (b.tease != null) S.bot.tease = Math.max(0, Math.min(3, +b.tease));
            if (b.tz_mode) S.tz.mode = b.tz_mode;
            if (b.tz_zone) S.tz.zone = b.tz_zone;
          }
          return settings();
        case "app/account/delete-data": {
          if (b?.confirm !== "ลบ") throw Object.assign(new Error("ต้องพิมพ์คำว่า ลบ เพื่อยืนยัน"), { status: 400 });
          const gone = items.filter((i) => i.editable), deleted = {};
          for (const i of gone) deleted[i.source] = (deleted[i.source] || 0) + 1;
          items = items.filter((i) => !i.editable); S.bot = { nickname: "IPED", tease: 1 };
          return { ok: true, deleted };
        }
        case "app/chat": {
          const t = String(b?.text || "");
          if (/วันนี้มีอะไร|สรุป/.test(t)) {
            const d = handle(`app/today?date=${T}&range=day`).days[0].items.filter((i) => !i.done);
            return { messages: [{ type: "text", text: `วันนี้มี ${d.length} เรื่องครับ เรื่องแรก ${d[0] ? `${parts(d[0].at).hm} ${d[0].title}` : "-"}` }, { type: "flex", altText: `สรุปวันนี้ · ${d.length} เรื่อง`, contents: {} }] };
          }
          if (/เตือน|นัด|โมง|\d[:.]\d\d|ทุกวัน|ต้องทำ/.test(t)) return { messages: [{ type: "text", text: create({ text: t.replace(/^ต้องทำ\s*/, "") }).said }] };
          return { messages: [{ type: "text", text: `${S.bot.nickname} รับทราบครับ ถ้าอยากให้เตือน ลองพิมพ์ “พรุ่งนี้ 9 โมง โทรหาลูกค้า”` }] };
        }
      }
      throw Object.assign(new Error("ไม่มี endpoint นี้: " + p), { status: 404 });
    }
    return async (path, body) => {
      await new Promise((r) => setTimeout(r, 120 + Math.random() * 120));
      return clone(handle(path, body === undefined ? null : clone(body)));
    };
  }

  // ===== เริ่ม =====
  function loadLiff() {
    if (D.DEV_USER || window.liff) return Promise.resolve();
    return new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js"; s.onload = ok; s.onerror = () => no(new Error("โหลด LINE SDK ไม่สำเร็จ")); document.head.appendChild(s); });
  }
  async function start() {
    try {
      if (MOCK) {
        api = makeMock();
        $("#meSub").innerHTML = 'ข้อมูลตัวอย่าง <span class="tag" style="background:var(--amber-bg);color:var(--amber)">MOCK</span>';
      } else {
        await loadLiff();
        const me = await D.boot({ needMember: true });
        st.me = { name: me?.me?.real || me?.me?.name || D.S.profile?.displayName || "", title: me?.me?.dev ? "Dev · สิทธิ์เท่า CEO" : (me?.me?.title || ""), pic: D.S.profile?.pictureUrl || null };
        drawMe();
      }
      try { applySettings(await api("app/settings")); } catch {}
      drawMe();
      window.addEventListener("hashchange", route);
      route();
    } catch (e) { D.fail(e); }
  }
  start();
})();
