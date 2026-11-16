// Toggle de visibilidad de contraseña para /admin/login (CSP-safe)
document.querySelectorAll("[data-toggle-password]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-toggle-password");
    const input = targetId ? document.getElementById(targetId) : null;
    if (!input) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    btn.textContent = isPassword ? "Ocultar" : "Ver";
  });
});
