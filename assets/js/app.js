// My-Kids-Hub Login + OAuth functionality

document.addEventListener("DOMContentLoaded", async () => {

    // ============================================================
    // PASSWORD SHOW / HIDE
    // ============================================================

    const togglePassword =
        document.getElementById("togglePassword");

    const password =
        document.getElementById("password");

    if (togglePassword && password) {

        togglePassword.addEventListener("click", () => {

            const type =
                password.getAttribute("type") === "password"
                    ? "text"
                    : "password";

            password.setAttribute("type", type);

            togglePassword.classList.toggle(
                "fa-eye"
            );

            togglePassword.classList.toggle(
                "fa-eye-slash"
            );
        });
    }


    // ============================================================
    // LOGIN ELEMENTS
    // ============================================================

    const loginForm =
        document.getElementById("loginForm");

    const googleLoginBtn =
        document.getElementById("googleLoginBtn");


    // ============================================================
    // GITHUB PAGES APPLICATION URL
    // ============================================================

    const APP_ORIGIN =
        "https://a6c6m6.github.io/My-Kids-Hub/";


    const getAppUrl = (page = "index.html") => {

        const url =
            new URL(page, APP_ORIGIN);

        url.search = "";
        url.hash = "";

        return url.toString();
    };


    // ============================================================
    // OAUTH BUTTON LOADING
    // ============================================================

    const setOAuthButtonLoading = (button) => {

        if (!button) {
            return () => {};
        }

        const original =
            button.innerHTML;

        button.disabled = true;

        button.setAttribute(
            "aria-busy",
            "true"
        );

        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';


        return () => {

            button.disabled = false;

            button.removeAttribute(
                "aria-busy"
            );

            button.innerHTML =
                original;
        };
    };


    // ============================================================
    // GOOGLE LOGIN
    // ============================================================

    const loginWithOAuth = async (
        provider,
        button
    ) => {

        if (!window.supabaseClient?.auth) {

            alert(
                "Authentication service is not available. Please try again later."
            );

            return;
        }


        const restore =
            setOAuthButtonLoading(button);


        try {

            const {
                error
            } =
                await window.supabaseClient.auth
                    .signInWithOAuth({

                        provider,

                        options: {

                            // ALWAYS use GitHub Pages
                            redirectTo:
                                getAppUrl(
                                    "index.html"
                                ),

                            queryParams:
                                provider === "google"
                                    ? {
                                          access_type:
                                              "offline",

                                          prompt:
                                              "select_account"
                                      }
                                    : undefined
                        }
                    });


            if (error) {
                throw error;
            }


        } catch (error) {

            console.error(
                "My-Kids-Hub OAuth Error:",
                error
            );


            restore();


            const message =
                error?.message || "";


            if (
                /provider.*not.*enabled|unsupported.*provider/i
                    .test(message)
            ) {

                alert(
                    "Google sign-in is not enabled in Supabase."
                );


            } else if (
                /redirect|url configuration/i
                    .test(message)
            ) {

                alert(
                    "OAuth redirect URL is not configured in Supabase."
                );


            } else {

                alert(
                    message ||
                    "Google login failed. Please try again."
                );
            }
        }
    };


    // ============================================================
    // GOOGLE BUTTON EVENT
    // ============================================================

    if (googleLoginBtn) {

        googleLoginBtn.addEventListener(
            "click",
            () => {

                loginWithOAuth(
                    "google",
                    googleLoginBtn
                );

            }
        );
    }


    // ============================================================
    // OAUTH CALLBACK / SESSION HANDLING
    // ============================================================
    //
    // IMPORTANT:
    //
    // Supabase automatically processes:
    //
    //     #access_token=
    //     #refresh_token=
    //
    // when createClient() is initialized.
    //
    // Therefore DO NOT manually call setSession()
    // with the returned tokens.
    //
    // We wait for Supabase's INITIAL_SESSION event.
    //
    // ============================================================


    if (window.supabaseClient?.auth) {

        window.supabaseClient.auth.onAuthStateChange(
            async (event, session) => {

                console.log(
                    "My-Kids-Hub Auth Event:",
                    event
                );


                // ------------------------------------------------
                // OAuth / Initial session
                // ------------------------------------------------

                if (
                    event === "INITIAL_SESSION" &&
                    session
                ) {

                    console.log(
                        "My-Kids-Hub: Supabase session detected."
                    );


                    // Remove OAuth token from address bar
                    window.history.replaceState(
                        {},
                        document.title,
                        getAppUrl(
                            "index.html"
                        )
                    );


                    // Go to dashboard
                    window.location.replace(
                        getAppUrl(
                            "dashboard.html"
                        )
                    );


                    return;
                }


                // ------------------------------------------------
                // Signed in
                // ------------------------------------------------

                if (
                    event === "SIGNED_IN" &&
                    session
                ) {

                    console.log(
                        "My-Kids-Hub: User signed in."
                    );


                    // Check whether this is an OAuth callback
                    const hasOAuthHash =
                        window.location.hash.includes(
                            "access_token="
                        );


                    const hasOAuthCode =
                        new URLSearchParams(
                            window.location.search
                        ).has("code");


                    if (
                        hasOAuthHash ||
                        hasOAuthCode
                    ) {

                        window.history.replaceState(
                            {},
                            document.title,
                            getAppUrl(
                                "index.html"
                            )
                        );


                        window.location.replace(
                            getAppUrl(
                                "dashboard.html"
                            )
                        );
                    }
                }
            }
        );


        // ========================================================
        // FALLBACK SESSION CHECK
        // ========================================================
        //
        // This handles cases where INITIAL_SESSION was already
        // emitted before the listener was attached.
        //
        // ========================================================

        try {

            const {
                data,
                error
            } =
                await window.supabaseClient.auth
                    .getSession();


            if (
                !error &&
                data?.session
            ) {

                const hash =
                    window.location.hash;


                const search =
                    window.location.search;


                const hasOAuthCallback =
                    hash.includes(
                        "access_token="
                    ) ||
                    hash.includes(
                        "refresh_token="
                    ) ||
                    search.includes(
                        "code="
                    );


                if (hasOAuthCallback) {

                    console.log(
                        "My-Kids-Hub: OAuth session confirmed."
                    );


                    window.history.replaceState(
                        {},
                        document.title,
                        getAppUrl(
                            "index.html"
                        )
                    );


                    window.location.replace(
                        getAppUrl(
                            "dashboard.html"
                        )
                    );


                    return;
                }
            }

        } catch (error) {

            console.error(
                "My-Kids-Hub session check error:",
                error
            );
        }
    }


    // ============================================================
    // EMAIL + PASSWORD LOGIN
    // ============================================================

    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            async (e) => {

                e.preventDefault();


                const btn =
                    document.getElementById(
                        "loginBtn"
                    );


                const emailInput =
                    document.getElementById(
                        "email"
                    );


                const passwordInput =
                    document.getElementById(
                        "password"
                    );


                if (
                    !btn ||
                    !emailInput ||
                    !passwordInput
                ) {

                    return;
                }


                const email =
                    emailInput.value.trim();


                const pass =
                    passwordInput.value;


                // ------------------------------------------------
                // Validation
                // ------------------------------------------------

                if (
                    !email ||
                    !pass
                ) {

                    alert(
                        "Please fill in all fields."
                    );

                    return;
                }


                const originalContent =
                    btn.innerHTML;


                btn.innerHTML =
                    '<i class="fas fa-spinner fa-spin"></i> Processing...';


                btn.disabled = true;


                try {

                    if (
                        !window.supabaseClient
                    ) {

                        throw new Error(
                            "Authentication service is not available."
                        );
                    }


                    // ------------------------------------------------
                    // EMAIL LOGIN
                    // ------------------------------------------------

                    const {
                        data,
                        error
                    } =
                        await window.supabaseClient.auth
                            .signInWithPassword({

                                email,

                                password:
                                    pass
                            });


                    if (error) {
                        throw error;
                    }


                    // ------------------------------------------------
                    // SUCCESS
                    // ------------------------------------------------

                    if (
                        data?.session
                    ) {

                        console.log(
                            "My-Kids-Hub: Email login successful."
                        );


                        window.location.replace(
                            "dashboard.html"
                        );


                        return;
                    }


                    throw new Error(
                        "Authentication session was not created."
                    );


                } catch (error) {

                    console.error(
                        "My-Kids-Hub Login Error:",
                        error
                    );


                    const message =
                        error?.message ||
                        "Invalid email or password. Please try again.";


                    alert(
                        message
                    );


                    btn.innerHTML =
                        originalContent;


                    btn.disabled = false;
                }
            }
        );
    }

});
