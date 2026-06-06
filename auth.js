// ================= SAFE INIT =================

document.addEventListener("DOMContentLoaded", () => {

    console.log("AUTH JS LOADED");

    // Check Supabase loaded
    if (!window.supabase) {
        console.error("Supabase not loaded. Check script order in HTML.");
        return;
    }

    // Create Supabase client safely
    const supabaseUrl = "https://xvqqqdibtbfgfkgveezm.supabase.co";
    const supabaseKey = "sb_publishable_NV2iGz-DCLOWD6wkm3UwOw_vlMpi8zi";

    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // expose globally so functions can use it
    window.supabaseClient = supabase;

    // Theme (safe check)
    if (typeof initializeTheme === "function") {
        initializeTheme();
    }

    setupAuthForms();
});


// ================= FORM TOGGLE =================

function setupAuthForms() {

    const toggleToSignup = document.getElementById("toggleToSignup");
    const toggleToLogin = document.getElementById("toggleToLogin");

    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");

    const loginFormElement = document.getElementById("loginFormElement");
    const signupFormElement = document.getElementById("signupFormElement");

    // Safety check
    if (!loginForm || !signupForm) {
        console.error("Forms not found in HTML");
        return;
    }

    // SHOW SIGNUP FORM
    if (toggleToSignup) {
        toggleToSignup.addEventListener("click", (e) => {
            e.preventDefault();
            loginForm.classList.add("hidden");
            signupForm.classList.remove("hidden");
        });
    }

    // SHOW LOGIN FORM
    if (toggleToLogin) {
        toggleToLogin.addEventListener("click", (e) => {
            e.preventDefault();
            signupForm.classList.add("hidden");
            loginForm.classList.remove("hidden");
        });
    }

    // FORM EVENTS
    if (loginFormElement) {
        loginFormElement.addEventListener("submit", handleLogin);
    }

    if (signupFormElement) {
        signupFormElement.addEventListener("submit", handleSignup);
    }
}


// ================= SIGNUP =================

async function handleSignup(e) {
    e.preventDefault();

    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("signupConfirmPassword").value;
    const errorDiv = document.getElementById("signupError");

    errorDiv.textContent = "";

    if (!name || !email || !password || !confirmPassword) {
        return showError(errorDiv, "Please fill in all fields");
    }

    if (password.length < 6) {
        return showError(errorDiv, "Password must be at least 6 characters");
    }

    if (password !== confirmPassword) {
        return showError(errorDiv, "Passwords do not match");
    }

    const { data, error } = await window.supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: name
            }
        }
    });

    if (error) {
        return showError(errorDiv, error.message);
    }

    errorDiv.style.color = "green";
    errorDiv.textContent = "Account created! Check email (if confirmation enabled).";

    setTimeout(() => {
        signupForm.classList.add("hidden");
        loginForm.classList.remove("hidden");
    }, 2000);
}


// ================= LOGIN =================

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errorDiv = document.getElementById("loginError");

    errorDiv.textContent = "";

    if (!email || !password) {
        return showError(errorDiv, "Please fill in all fields");
    }

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        return showError(errorDiv, error.message);
    }

    localStorage.setItem("currentUser", JSON.stringify(data.user));

    window.location.href = "index.html";
}


// ================= ERROR HANDLER =================

function showError(div, message) {
    div.style.color = "red";
    div.textContent = message;
}


// ================= HELPERS =================

async function getCurrentUser() {
    const { data } = await window.supabaseClient.auth.getUser();
    return data.user;
}

async function logoutUser() {
    await window.supabaseClient.auth.signOut();
    localStorage.removeItem("currentUser");
    window.location.href = "auth.html";
}