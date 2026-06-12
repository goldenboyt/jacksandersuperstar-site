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

});
