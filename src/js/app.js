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
