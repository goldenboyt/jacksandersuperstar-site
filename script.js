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
  initRsvpForm();
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

function initRsvpForm() {
  const form = document.getElementById("rsvp-form");
  const message = document.getElementById("rsvp-message");
  const rsvpEmailEndpoint = "https://formsubmit.co/ajax/jsander2004@gmail.com";

  if (!form || !message) {
    return;
  }

  const showMessage = (text, isError = false) => {
    message.textContent = text;
    message.hidden = false;
    message.classList.toggle("rsvp-message--error", isError);
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector(".rsvp-submit");
    const formData = new FormData(form);
    const firstName = String(formData.get("firstName") || "").trim();
    const lastName = String(formData.get("lastName") || "").trim();
    const honey = String(formData.get("_honey") || "").trim();

    if (honey) {
      return;
    }

    if (!firstName || !lastName) {
      showMessage("first and last name required", true);
      return;
    }

    submitButton.disabled = true;
    showMessage("sending…");

    try {
      const response = await fetch("/api/rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ firstName, lastName, _honey: honey }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        showMessage(result.error || "something went wrong — try again", true);
        submitButton.disabled = false;
        return;
      }

      try {
        await fetch(rsvpEmailEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            _subject: result.subject,
            message: result.message,
            _template: "box",
            _captcha: "false",
          }),
        });
      } catch {
        // RSVP is saved even if the email fails.
      }

      form.reset();
      showMessage("you're on the list");
      submitButton.disabled = false;
    } catch {
      showMessage("something went wrong — try again", true);
      submitButton.disabled = false;
    }
  });
}
