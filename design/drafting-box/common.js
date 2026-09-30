// Content + behaviour shared by the lavender2 drafts: strings, language toggle,
// collapsible timelines, and (re)mounting the card stage after each render.
//   Z.boot({ render(ctx) -> html, mount(ctx) -> cleanup })
(function () {
  const S = window.SITE;
  const TXT = {
    ko: {
      work: "작업", about: "소개", history: "이력", drive: "운전",
      scroll: "스크롤", flip: "명함 뒤집기",
      workHead: "이제까지 만든 것들", aboutHead: "소개",
      historyHead: "타임라인", qualHead: "자격 · 인증",
      view: "프로젝트 보기", more: (n) => `${n}개 더 보기`, less: "접기",
      school: "국민대학교 인공지능학부 · 26학번",
      hosted: "라즈베리파이에서 자체 호스팅",
      projects: (n) => `프로젝트 ${n}개`,
    },
    en: {
      work: "Work", about: "About", history: "History", drive: "Drive",
      scroll: "Scroll", flip: "Flip the card",
      workHead: "Things I've built", aboutHead: "About",
      historyHead: "Timeline", qualHead: "Certifications & credentials",
      view: "View project", more: (n) => `Show ${n} more`, less: "Collapse",
      school: "Kookmin University, School of AI · Class of '26",
      hosted: "Self-hosted on a Raspberry Pi",
      projects: (n) => `${n} projects`,
    },
  };
  const ICON = {
    wheel: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M3.5 10.5h6.3M14.2 10.5h6.3M12 14.2V21" stroke="currentColor" stroke-width="1.8"/></svg>',
    arrow: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevron: '<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.2-3.1-.1-.4-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.2.8.8 1.2 1.9 1.2 3.1 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  };

  let lang = "ko";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const pick = (o, k) => o[`${k}_${lang}`] || o[`${k}_ko`] || "";
  const paras = (s) => s.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const asset = (p) => p;
  const linkText = (l) => l.url.replace(/^mailto:|^https?:\/\//, "");

  function ctx() {
    return { S, lang, t: TXT[lang], icon: ICON, esc, pick, paras, asset, linkText, name: S.name, tagline: pick(S, "tagline") };
  }

  function wire() {
    document.querySelectorAll("[data-lang-toggle]").forEach((b) =>
      b.addEventListener("click", () => {
        lang = lang === "ko" ? "en" : "ko";
        draw();
      })
    );
    document.querySelectorAll(".btn-more").forEach((btn) =>
      btn.addEventListener("click", () => {
        const sec = btn.closest(".tl");
        const open = sec.classList.toggle("open");
        btn.setAttribute("aria-expanded", String(open));
        btn.querySelector(".lbl").textContent = open ? TXT[lang].less : TXT[lang].more(+btn.dataset.n);
      })
    );
    const hd = document.querySelector(".hd");
    if (hd) {
      const on = () => hd.classList.toggle("scrolled", scrollY > 8);
      addEventListener("scroll", on, { passive: true });
      on();
    }
  }

  let theme = null, cleanup = null;
  function draw() {
    if (cleanup) cleanup();
    const y = scrollY;
    document.documentElement.lang = lang;
    document.getElementById("app").innerHTML = theme.render(ctx());
    scrollTo(0, y);
    wire();
    cleanup = theme.mount ? theme.mount(ctx()) : null;
  }

  window.Z = {
    boot(t) {
      theme = t;
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", draw);
      else draw();
    },
    ICON,
  };
})();
