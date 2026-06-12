document.addEventListener("DOMContentLoaded", () => {
  const menu = document.querySelector(".menu");
  if (menu) {
    menu.addEventListener("toggle", () => {
      if (!menu.open) {
        return;
      }

      menu.querySelectorAll(".menu-list, .menu-list li").forEach((element) => {
        element.style.animation = "none";
        element.offsetHeight;
        element.style.animation = "";
      });
    });

    document.addEventListener("click", (event) => {
      if (!menu.contains(event.target)) {
        menu.removeAttribute("open");
      }
    });
  }

  const merchList = document.querySelector(".merch-list");
  if (merchList) {
    merchList.querySelectorAll(".merch-expandable").forEach((item) => {
      item.addEventListener("toggle", () => {
        if (!item.open) {
          return;
        }

        merchList.querySelectorAll(".merch-expandable").forEach((other) => {
          if (other !== item) {
            other.removeAttribute("open");
          }
        });
      });
    });
  }

  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll('a[href$=".html"]').forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) {
      return;
    }

    const targetPage = href === "index.html" && currentPage === "" ? "index.html" : href;
    if (targetPage === currentPage || (href === "index.html" && currentPage === "index.html")) {
      return;
    }

    link.addEventListener("click", (event) => {
      event.preventDefault();
      document.body.classList.add("is-leaving");
      window.setTimeout(() => {
        window.location.href = href;
      }, 320);
    });
  });

  initCountdown();
});

function initCountdown() {
  const countdown = document.getElementById("countdown");
  if (!countdown) {
    return;
  }

  const target = new Date(2026, 6, 15, 23, 0, 0);

  const tick = () => {
    const remaining = target.getTime() - Date.now();

    if (remaining <= 0) {
      countdown.textContent = "out now";
      return;
    }

    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const unit = (value, label) => `${value} ${label}${value === 1 ? "" : "s"}`;

    countdown.textContent = [
      days && unit(days, "day"),
      hours && unit(hours, "hour"),
      minutes && unit(minutes, "minute"),
      seconds && unit(seconds, "second"),
    ]
      .filter(Boolean)
      .join(" ");
  };

  tick();
  window.setInterval(tick, 1000);
}
