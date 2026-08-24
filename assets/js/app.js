// My-Kids-Hub Login + OAuth functionality

document.addEventListener("DOMContentLoaded", async () => {

    // ============================================================
    // PASSWORD SHOW / HIDE
    // ============================================================

    const togglePassword = document.getElementById("togglePassword");
    const password = document.getElementById("password");

    if (togglePassword && password) {
        togglePassword.addEventListener("click", () => {

            const type =
                password.getAttribute("type") === "password"
                    ? "text"
                    : "password";

            password.setAttribute("type", type);

            togglePassword.classList.toggle("fa-eye");
            togglePassword.classList.toggle("fa-eye-slash");
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
    // APPLICATION URL
    // ============================================================
    //
    // Google OAuth must return to the deployed GitHub Pages URL.
    //
    // Localhost / VS Code testing:
    //     OAuth callback -> GitHub Pages
    //
    // GitHub Pages:
    //     OAuth callback -> GitHub Pages
    //
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
    // OAUTH ERROR READER
    // ============================================================

    const getOAuthError = () => {

        const url =
            new URL(window.location.href);

        const params =
            new URLSearchParams(url.search);

        const hash =
            new URLSearchParams(
                url.hash.replace(/^#/, "")
            );

        return {

            code:
                params.get("error_code") ||
                hash.get("error_code"),

            description:
                params.get("error_description") ||
                hash.get("error_description") ||
                params.get("error") ||
                hash.get("error")
        };
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
    // GOOGLE / SOCIAL LOGIN
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

            const { error } =
                await window.supabaseClient.auth
                    .signInWithOAuth({

                        provider,

                        options: {

                            // IMPORTANT:
                            // Always return to GitHub Pages.
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
                `My Kids Hub ${provider} OAuth Error:`,
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
                    "Google sign-in is not enabled in Supabase yet. Enable the provider and add the OAuth redirect URL, then try again."
                );


            } else if (
                /redirect|url configuration/i
                    .test(message)
            ) {

                alert(
                    "OAuth redirect URL is not configured in Supabase. Add the My-Kids-Hub callback URL and try again."
                );


            } else {

                alert(
                    message ||
                    "Google login is not available. Please use email and password."
                );
            }
        }
    };


    // ============================================================
    // GOOGLE BUTTON
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
    // OAUTH CALLBACK
    // ============================================================
    //
    // Supabase Google OAuth may return:
    //
    //     index.html#access_token=...
    //     index.html#refresh_token=...
    //
    // OR:
    //
    //     index.html?code=...
    //
    // The old code only called getSession().
    //
    // Here we explicitly create the session when tokens
    // are returned.
    //
    // ============================================================


    const currentHash =
        window.location.hash
            .replace(/^#/, "");


    const hashParams =
        new URLSearchParams(
            currentHash
        );


    const searchParams =
        new URLSearchParams(
            window.location.search
        );


    const accessToken =
        hashParams.get(
            "access_token"
        );


    const refreshToken =
        hashParams.get(
            "refresh_token"
        );


    const authCode =
        searchParams.get(
            "code"
        );


    const oauthError =
        searchParams.get(
            "error_description"
        ) ||
        hashParams.get(
            "error_description"
        ) ||
        searchParams.get(
            "error"
        ) ||
        hashParams.get(
            "error"
        );


    // ============================================================
    // OAUTH ERROR
    // ============================================================

    if (oauthError) {

        console.error(
            "My Kids Hub OAuth Error:",
            oauthError
        );


        let message =
            oauthError;


        try {

            message =
                decodeURIComponent(
                    oauthError.replace(
                        /\+/g,
                        " "
                    )
                );

        } catch (e) {

            console.warn(
                "OAuth error decode failed:",
                e
            );
        }


        alert(message);

        return;
    }


    // ============================================================
    // IMPORTANT:
    // ACCESS TOKEN + REFRESH TOKEN CALLBACK
    // ============================================================

    if (
        accessToken &&
        refreshToken &&
        window.supabaseClient?.auth
    ) {

        try {

            console.log(
                "My-Kids-Hub: OAuth access token detected."
            );


            // ----------------------------------------------------
            // Explicitly create Supabase session
            // ----------------------------------------------------

            const {
                data,
                error
            } =
                await window.supabaseClient.auth
                    .setSession({

                        access_token:
                            accessToken,

                        refresh_token:
                            refreshToken
                    });


            if (error) {
                throw error;
            }


            if (data?.session) {

                console.log(
                    "My-Kids-Hub: OAuth session created successfully."
                );


                // ------------------------------------------------
                // Remove access token from URL
                // ------------------------------------------------

                window.history.replaceState(
                    {},
                    document.title,
                    getAppUrl(
                        "index.html"
                    )
                );


                // ------------------------------------------------
                // Go to dashboard
                // ------------------------------------------------

                window.location.replace(
                    getAppUrl(
                        "dashboard.html"
                    )
                );


                return;
            }


            throw new Error(
                "Supabase session was not created."
            );


        } catch (error) {

            console.error(
                "My-Kids-Hub OAuth session error:",
                error
            );


            alert(
                "Google login succeeded, but the session could not be created. Please try again."
            );


            return;
        }
    }


    // ============================================================
    // PKCE / AUTHORIZATION CODE CALLBACK
    // ============================================================

    if (
        authCode &&
        window.supabaseClient?.auth
    ) {

        try {

            console.log(
                "My-Kids-Hub: OAuth authorization code detected."
            );


            const {
                data,
                error
            } =
                await window.supabaseClient.auth
                    .exchangeCodeForSession(
                        authCode
                    );


            if (error) {
                throw error;
            }


            if (data?.session) {

                console.log(
                    "My-Kids-Hub: OAuth code exchanged successfully."
                );


                // Remove ?code= from URL
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


            throw new Error(
                "OAuth session was not created."
            );


        } catch (error) {

            console.error(
                "My-Kids-Hub OAuth code exchange error:",
                error
            );


            alert(
                "Unable to complete Google login. Please try again."
            );


            return;
        }
    }


    // ============================================================
    // NORMAL EXISTING SESSION CHECK
    // ============================================================
    //
    // This handles the case where a user already has a valid
    // Supabase session.
    //
    // ============================================================

    if (
        !accessToken &&
        !authCode &&
        window.supabaseClient?.auth
    ) {

        try {

            const {
                data,
                error
            } =
                await window.supabaseClient.auth
                    .getSession();


            if (!error && data?.session) {

                console.log(
                    "My-Kids-Hub: Existing session detected."
                );

                // Do not redirect automatically from the
                // login page if this is a normal page load.
                //
                // The user can still use the login page.
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
                    // Supabase email/password login
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
                    // Login success
                    // ------------------------------------------------

                    if (
                        data &&
                        data.session
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
                        "My-Kids-Hub Auth Error:",
                        error
                    );


                    // Show actual Supabase error where useful.
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
