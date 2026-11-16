// เลขาเป็ด · สคริปต์ร่วมของหน้า LIFF (ไม่มี build) · ใช้ผ่าน window.Duck
// ทุกหน้าอยู่ใต้ LIFF app เดียว: https://liff.line.me/<LIFF_ID>/<page>/  (Endpoint URL = .../liff/)
// ทดสอบในเครื่อง: python3 -m http.server 8766 (ในโฟลเดอร์ liff) แล้วเปิด http://localhost:8766/<page>/?dev=<LINE userId>
//   (ข้าม LIFF และส่ง header x-dev-line-user ไปที่ API ในเครื่อง · ใช้ได้เมื่อเปิดจาก localhost และ API ตั้ง CAL_DEV=1 เท่านั้น)
(function () {
  const LIFF_ID = "2012641821-Ehk4gcXO";
  const API_URL = "https://rysgdortwddldmjhtfnw.supabase.co/functions/v1/app-api/";
  const DEV_API_URL = "http://127.0.0.1:54321/functions/v1/app-api/"; // supabase functions serve

  const qs = new URLSearchParams(location.search);
  const LOCAL = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const DEV_USER = LOCAL ? qs.get("dev") : null;
  const API = DEV_USER ? DEV_API_URL : API_URL;
  const S = { token: null, me: null, profile: null };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ลิงก์ไปหน้าอื่น (คง ?dev= ไว้ตอนทดสอบในเครื่อง)
  function link(rel, params = {}) {
    const u = new URL(rel, location.href);
    for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
    if (DEV_USER) u.searchParams.set("dev", DEV_USER);
    return u.pathname + u.search;
  }
  function fixLinks(root = document) { if (DEV_USER) for (const a of $$("a[data-page]", root)) a.href = link(a.getAttribute("href")); }

  // ===== เวลาไทย (ไม่พึ่ง timezone ของเครื่อง) =====
  const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const DOWS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const pad = (n) => String(n).padStart(2, "0");
  const bkkNow = () => new Date(Date.now() + 7 * 3600e3); // ฟิลด์ UTC = นาฬิกาไทย
  const todayStr = () => bkkNow().toISOString().slice(0, 10);
  const addDays = (ymd, n) => { const d = new Date(ymd + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dow = (ymd) => new Date(ymd + "T00:00:00Z").getUTCDay();
  // iso "2026-11-17T17:00:00+07:00" → "อ. 17 พ.ย. 17:00"
  function when(iso, withTime = true) {
    if (!iso) return "";
    const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
    return `${DOWS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` + (withTime ? " " + iso.slice(11, 16) : "");
  }
  function ago(iso) {
    if (!iso) return "";
    const t = new Date(iso).getTime(), n = Date.now(), m = Math.round((n - t) / 60000);
    if (m < 1) return "เมื่อสักครู่";
    if (m < 60) return m + " นาทีที่แล้ว";
    if (m < 60 * 24) return Math.round(m / 60) + " ชม.ที่แล้ว";
    return when(iso);
  }

  // ===== API =====
  async function api(path, body) {
    const headers = { "Content-Type": "application/json" };
    if (DEV_USER) headers["x-dev-line-user"] = DEV_USER;
    else headers.Authorization = "Bearer " + S.token;
    const res = await fetch(API + path, body === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch {}
    if (res.status === 401 && !DEV_USER && window.liff) { try { liff.logout(); } catch {} liff.login({ redirectUri: location.href }); throw new Error("กำลังเข้าสู่ระบบใหม่"); }
    if (!res.ok) { const e = new Error(data.error || "เชื่อมต่อไม่สำเร็จ (" + res.status + ")"); e.status = res.status; e.body = data; throw e; }
    return data;
  }

  // ===== เริ่มหน้า: LIFF → login → /me · needMember: ยังไม่ลงทะเบียน → ../register/ · รออนุมัติ → แสดงสถานะ =====
  async function boot({ needMember = true, title } = {}) {
    if (!DEV_USER) {
      if (!window.liff) throw new Error("โหลด LINE SDK ไม่สำเร็จ");
      await liff.init({ liffId: LIFF_ID });
      if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href }); return new Promise(() => {}); }
      S.token = liff.getIDToken();
      if (!S.token) throw new Error("ไม่ได้รับ ID token กรุณาเปิดจากแชตเลขาเป็ดใน LINE");
      try { S.profile = await liff.getProfile(); } catch {}
    }
    const me = await api("me");
    S.me = me;
    setMe(me);
    if (needMember && !me.registered) {
      if (me.pending) { showPending(me.pending); return new Promise(() => {}); }
      location.replace(link("../register/"));
      return new Promise(() => {});
    }
    return me;
  }
  function setMe(me) {
    const el = $("#me"); if (!el) return;
    const t = me.me ? `${me.me.name} · ${me.me.title}` : me.pending ? "รออนุมัติการลงทะเบียน" : "ยังไม่ได้ลงทะเบียน";
    el.innerHTML = esc(t) + (DEV_USER ? ' <span class="devbadge">DEV</span>' : "");
  }
  function showPending(p) {
    state(`<b>รออนุมัติการลงทะเบียน</b>คำขอของ ${esc(p.full_name)} (${esc(p.role_th)}) รอ <b style="display:inline;font-size:inherit">${esc(p.approver)}</b> อนุมัติอยู่<br>อนุมัติแล้วเลขาเป็ดจะแจ้งในแชตทันที
      <a class="btn" href="${esc(link("../register/"))}">ดู / แก้ไขคำขอ</a>`);
  }
  // แทนเนื้อหาหลักด้วยข้อความสถานะ
  function state(html) {
    const main = $("#main"); if (!main) return;
    for (const el of $$("body > .fab, body > .bottombar")) el.hidden = true;
    main.innerHTML = `<div class="state${/class="big"/.test(html) ? "" : " duck"}">${html}</div>`;
  }
  function fail(e) {
    state(`<b>${e.status === 403 ? "ใช้หน้านี้ไม่ได้" : "เปิดหน้านี้ไม่สำเร็จ"}</b>${esc(e.message)}` +
      (e.status === 403 ? `<a class="btn" href="${esc(link("../"))}">กลับหน้าหลัก</a>` : `<button class="btn" onclick="location.reload()">ลองใหม่</button>`));
  }

  // ===== ส่วนแสดงผล =====
  function avatar(p, cls = "") {
    if (!p) return `<span class="av ${cls}">?</span>`;
    if (p.pic) return `<img class="av ${cls}" src="${esc(p.pic)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
    return `<span class="av ${cls}" aria-hidden="true">${esc(p.initials || initial(p.nick || p.name))}</span>`;
  }
  // อักษรแรกของชื่อ (สระหน้า เ แ โ ใ ไ เอา 2 ตัว เหมือนปฏิทิน)
  function initial(n) { const c = [...String(n || "?").replace(/^คุณ/, "")]; return /^[เแโใไ]/.test(c[0] || "") ? c.slice(0, 2).join("") : c[0] || "?"; }
  // แถบหนา + % ต่อท้าย (เหมือนการ์ดในแชต)
  const pbar = (p, status) => `<div class="pbrow ${esc(status)}"><div class="pb ${esc(status)}" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="ความคืบหน้า ${p}%"><i style="width:${Math.max(2, Math.min(100, p))}%"></i></div><b aria-hidden="true">${p}%</b></div>`;

  // การ์ดงานหนึ่งใบ (การ์ดดำ / ตามงาน) · actions = HTML ปุ่ม
  function taskItem(t, o = {}) {
    const st = t.status === "awaiting" ? "awaiting" : t.status;
    const nud = t.nudges ? `ตามแล้ว ${t.nudges} ครั้ง${t.last_nudged ? " · ล่าสุด " + ago(t.last_nudged) : ""}` : "ยังไม่เคยตาม";
    const ext = t.ext ? `<div class="warnbox" style="margin:0;font-size:13px">ขอเลื่อนเป็น <b>${esc(when(t.ext.new_due))}</b> · รอ ${esc(t.ext.approver || "")}<br>เหตุผล: ${esc(t.ext.reason)}${t.ext.head_note ? `<br>${esc(t.ext.head_note)}` : ""}</div>` : "";
    return `<article class="item${o.picked ? " sel" : ""}" data-id="${esc(t.id)}">
      <div class="row">${o.pick ? `<button type="button" class="pick" role="checkbox" aria-checked="${!!o.picked}" aria-label="เลือก ${esc(t.title)}" data-pick><span class="check">✓</span></button>` : ""}
        <div class="t">${t.special ? '<span class="pill black" style="margin-right:6px">การ์ดดำ</span>' : ""}${esc(t.title)}</div><span class="pill ${esc(st)}">${esc(t.status_th)}</span></div>
      ${o.owner === false ? "" : `<div class="who">${avatar(t.owner)}<span><b>${esc(t.owner.name)}</b> · ${esc(t.dept || "")}${t.approver && t.special ? " · ผู้อนุมัติ " + esc(t.approver.name) : ""}</span></div>`}
      ${pbar(t.progress, st)}
      <div class="sub">${esc(t.due_text)} · กำหนด ${esc(when(t.due))}${o.nudgeInfo === false ? "" : " · " + esc(nud)}</div>
      ${t.detail ? `<div class="sub">${esc(t.detail)}</div>` : ""}
      ${ext}
      ${t.last?.note || t.last?.photos?.length ? `<div class="note${t.last.photos?.length ? " hasph" : ""}">${photoThumb(t)}<div><small>อัปเดตล่าสุด${t.last.by ? " · " + esc(t.last.by) : ""} · ${esc(ago(t.last.at))}</small>${esc(t.last.note || "")}</div></div>` : ""}
      ${o.actions ? `<div class="btnrow">${o.actions}</div>` : ""}
    </article>`;
  }

  // รูปงานในอัปเดตล่าสุด (signed URL จาก API อายุ 1 ชม.) · แตะ = ดูเต็มจอ
  function photoThumb(t) {
    const ph = t.last?.photos || [];
    if (!ph.length) return "";
    return `<button type="button" class="thumb" data-photos="${esc(t.id)}" aria-label="ดูรูปงาน ${ph.length} รูป"><img src="${esc(ph[0])}" alt="" loading="lazy">${ph.length > 1 ? `<span>${ph.length}</span>` : ""}</button>`;
  }
  // ตัวดูรูปเต็มจอ: แตะรูป = รูปถัดไป · ปุ่ม × หรือ Esc = ปิด
  function viewPhotos(urls, start = 0) {
    if (!urls?.length) return;
    let i = start, el = $("#photoView");
    if (!el) {
      el = document.createElement("div");
      el.id = "photoView"; el.className = "pview"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "รูปงาน");
      el.innerHTML = `<img alt="รูปงาน"><div class="pbar"><span></span><button type="button" class="close" aria-label="ปิด">×</button></div>`;
      document.body.appendChild(el);
    }
    const show = () => { $("img", el).src = el._u[i]; $("span", el).textContent = el._u.length > 1 ? `${i + 1} / ${el._u.length} · แตะรูปเพื่อดูรูปถัดไป` : ""; };
    el._u = urls;
    el.onclick = (e) => { if (e.target.closest(".close")) { el.hidden = true; return; } if (e.target.tagName === "IMG" && el._u.length > 1) { i = (i + 1) % el._u.length; show(); } };
    show(); el.hidden = false; $(".close", el).focus();
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#photoView") && !$("#photoView").hidden) $("#photoView").hidden = true; });

  // ย่อรูปในเครื่องก่อนส่ง: ด้านยาวไม่เกิน max px · JPEG คุณภาพ q · คืน { type, data(base64), url(preview), size }
  async function shrinkPhoto(file, max = 1600, q = 0.8) {
    if (!/^image\//.test(file.type || "image/")) throw new Error("ไฟล์นี้ไม่ใช่รูป");
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("เปิดรูปไม่ได้ ลองรูปอื่น")); i.src = url; });
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      const dataUrl = cv.toDataURL("image/jpeg", q);
      const data = dataUrl.slice(dataUrl.indexOf(",") + 1);
      return { type: "image/jpeg", data, url: dataUrl, size: Math.floor(data.length * 3 / 4) };
    } finally { URL.revokeObjectURL(url); }
  }

  // ===== sheet / toast =====
  let lastFocus = null;
  function openSheet(id) {
    lastFocus = document.activeElement;
    const s = $(id); s.hidden = false;
    requestAnimationFrame(() => { s.classList.add("on"); $("#scrim").classList.add("on"); });
    setTimeout(() => (s.querySelector("input,textarea,select,button:not([data-close])") || s.querySelector("button"))?.focus(), 260);
  }
  function closeSheets() {
    for (const s of $$(".sheet.on")) { s.classList.remove("on"); setTimeout(() => (s.hidden = true), 260); }
    $("#scrim")?.classList.remove("on");
    lastFocus?.focus?.();
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-close]") || e.target.id === "scrim") closeSheets(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheets(); });
  let toastT;
  function toast(t) { const el = $("#toast"); if (!el) return; el.textContent = t; el.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), 3200); }

  // ปุ่มกำลังทำงาน
  async function busy(btn, fn, label = "กำลังส่ง…") {
    const old = btn.innerHTML; btn.disabled = true; btn.textContent = label;
    try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; }
  }
  // สรุปว่าแจ้งใครไปแล้ว
  function deliveredText(r) {
    const parts = [];
    if (r.notified?.length) parts.push("แจ้งทาง LINE: " + r.notified.join(", "));
    if (r.not_linked?.length) parts.push("ยังไม่ผูก LINE: " + r.not_linked.join(", "));
    if (r.failed?.length) parts.push("ส่งไม่สำเร็จ: " + r.failed.join(", "));
    return parts.join(" · ");
  }

  window.Duck = { LIFF_ID, DEV_USER, S, $, $$, esc, link, fixLinks, pad, bkkNow, todayStr, addDays, dow, when, ago, api, boot, state, fail, showPending,
    avatar, initial, pbar, taskItem, photoThumb, viewPhotos, shrinkPhoto, openSheet, closeSheets, toast, busy, deliveredText, MONTHS };
})();
