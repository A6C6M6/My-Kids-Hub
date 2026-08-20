document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("resetForm");
    const resetBtn = document.getElementById("resetBtn");
    const emailInput = document.getElementById("email");

    if (!form || !resetBtn || !emailInput) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = emailInput.value.trim();

        if (!email) {
            alert("Please enter email address.");
            emailInput.focus();
            return;
        }

        resetBtn.disabled = true;

        try {
            const resetUrl = new URL("../reset-password.html", window.location.href).href;

            const { error } = await window.supabaseClient.auth.resetPasswordForEmail(
                email,
                { redirectTo: resetUrl }
            );

            if (error) {
                alert(error.message);
                return;
            }

            alert("Password reset link sent successfully.");
        } catch (error) {
            alert(error?.message || "Unable to send password reset link.");
        } finally {
            resetBtn.disabled = false;
        }
    });
});
