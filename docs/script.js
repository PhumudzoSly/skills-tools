const copyButton = document.getElementById("copy-install");
const installCommand = document.getElementById("install-command");

if (copyButton && installCommand) {
  copyButton.addEventListener("click", async () => {
    const command = installCommand.textContent?.trim() ?? "";
    if (!command) return;

    try {
      await navigator.clipboard.writeText(command);
      copyButton.textContent = "Copied";
      window.setTimeout(() => {
        copyButton.textContent = "Copy";
      }, 1400);
    } catch {
      copyButton.textContent = "Failed";
      window.setTimeout(() => {
        copyButton.textContent = "Copy";
      }, 1400);
    }
  });
}

const revealElements = Array.from(document.querySelectorAll(".reveal"));
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.18 }
);

for (const element of revealElements) {
  if (element.classList.contains("hero")) continue;
  observer.observe(element);
}

const navLinks = Array.from(document.querySelectorAll(".topnav a"));
const sectionById = new Map(
  Array.from(document.querySelectorAll("main section[id]")).map((section) => [section.id, section])
);

const activateLink = (hash) => {
  for (const link of navLinks) {
    link.classList.toggle("is-active", link.getAttribute("href") === hash);
  }
};

const navObserver = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;
    activateLink(`#${visible.target.id}`);
  },
  {
    rootMargin: "-25% 0px -55% 0px",
    threshold: [0.15, 0.35, 0.65],
  }
);

for (const section of sectionById.values()) {
  navObserver.observe(section);
}

const year = document.getElementById("year");
if (year) {
  year.textContent = String(new Date().getFullYear());
}
