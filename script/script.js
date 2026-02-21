document.querySelectorAll("a.link").forEach((link) => {
  link.addEventListener("click", function (e) {
    e.preventDefault();
    const href = this.href;

    document.body.classList.add("fade-out");

    setTimeout(() => {
      window.location.href = href;
    }, 600); // same as CSS time
  });
});
