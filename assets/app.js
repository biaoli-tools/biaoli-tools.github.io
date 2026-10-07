const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
navToggle?.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.setAttribute("aria-label", open ? "关闭导航" : "打开导航");
});

document.querySelectorAll(".dropzone").forEach((zone) => {
  const input = zone.querySelector('input[type="file"]');
  ["dragenter", "dragover"].forEach((event) => zone.addEventListener(event, (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach((event) => zone.addEventListener(event, (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
  }));
  zone.addEventListener("drop", (event) => {
    if (!event.dataTransfer.files.length) return;
    const transfer = new DataTransfer();
    [...event.dataTransfer.files].forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
});

const year = document.querySelector("[data-year]");
if (year) year.textContent = new Date().getFullYear();


function closeMobileNav() {
  if (!navLinks?.classList.contains("open")) return;
  navLinks.classList.remove("open");
  navToggle?.setAttribute("aria-expanded", "false");
  navToggle?.setAttribute("aria-label", "打开导航");
}

navLinks?.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMobileNav();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && navLinks?.classList.contains("open")) {
    closeMobileNav();
    navToggle?.focus();
  }
});

// Mark the current section for assistive technology without hard-coding it into every page.
for (const link of document.querySelectorAll('.nav-links a[href^="/"]')) {
  const href = new URL(link.href, location.origin);
  if (href.hash) continue;
  if (href.pathname === location.pathname) link.setAttribute("aria-current", "page");
}

// Lightweight task search on the home page. Filtering happens only in the current DOM.
const toolSearch = document.querySelector("#tool-search");
const toolSearchClear = document.querySelector("#tool-search-clear");
const toolSearchStatus = document.querySelector("#tool-search-status");
const toolItems = [...document.querySelectorAll("[data-tool-item]")];
const toolEmpty = document.querySelector("[data-tool-empty]");

function normalizeSearch(value) {
  return String(value || "").trim().toLocaleLowerCase("zh-CN").replace(/\s+/g, " ");
}

function filterTools() {
  if (!toolSearch) return;
  const query = normalizeSearch(toolSearch.value);
  const terms = query ? query.split(" ") : [];
  let visible = 0;
  for (const item of toolItems) {
    const haystack = normalizeSearch(item.dataset.search);
    const matched = terms.every((term) => haystack.includes(term));
    item.hidden = !matched;
    if (matched) visible += 1;
  }
  if (toolEmpty) toolEmpty.hidden = visible !== 0;
  if (toolSearchClear) toolSearchClear.hidden = !query;
  if (toolSearchStatus) toolSearchStatus.textContent = query ? `找到 ${visible} 个匹配工具。` : `显示全部 ${visible} 个工具。`;
}

toolSearch?.addEventListener("input", filterTools);
toolSearch?.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !toolSearch.value) return;
  event.preventDefault();
  toolSearch.value = "";
  filterTools();
  toolSearch.focus();
});
toolSearchClear?.addEventListener("click", () => {
  toolSearch.value = "";
  filterTools();
  toolSearch.focus();
});


// Sponsor measurement: only sends placement and page path, never file or table data.
const sponsorLinks = [...document.querySelectorAll("[data-sponsor][data-sponsor-placement]")];
function trackSponsor(eventName, link) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", eventName, {
    sponsor: link.dataset.sponsor,
    placement: link.dataset.sponsorPlacement,
    page_path: location.pathname
  });
}
for (const link of sponsorLinks) {
  link.addEventListener("click", () => trackSponsor("sponsor_click", link));
}
if ("IntersectionObserver" in window && sponsorLinks.length) {
  const seenSponsorPlacements = new WeakSet();
  const sponsorObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.5 || seenSponsorPlacements.has(entry.target)) continue;
      seenSponsorPlacements.add(entry.target);
      trackSponsor("sponsor_view", entry.target);
      sponsorObserver.unobserve(entry.target);
    }
  }, { threshold: 0.5 });
  sponsorLinks.forEach((link) => sponsorObserver.observe(link));
}
