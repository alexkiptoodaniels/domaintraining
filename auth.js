// ============ SUPABASE SETUP ============
// 🔴 PUT YOUR SUPABASE DETAILS HERE
const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseKey = "YOUR_SUPABASE_ANON_KEY";

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// ============ INIT ============

document.addEventListener("DOMContentLoaded", () => {
    initializeTheme();

    setupAuthForms();
});

// ============ FORM TOGGLE ============

function setupAuthForms() {
    const toggleToSignup = document.getElementById("toggleToSignup");
    const toggleToLogin = document.getElementById("toggleToLogin");

    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");

    const loginFormElement = document.getElementById("loginFormElement");
    const signupFormElement = document.getElementById("signupFormElement");

    if (toggleToSignup) {
        toggleToSignup.addEventListener("click", (e) => {
            e.preventDefault();
            loginForm.classList.add("hidden");
            signupForm.classList.remove("hidden");
        });
    }

    if (toggleToLogin) {
        toggleToLogin.addEventListener("click", (e) => {
            e.preventDefault();
            signupForm.classList.add("hidden");
            loginForm.classList.remove("hidden");
        });
    }

    if (loginFormElement) {
        loginFormElement.addEventListener("submit", handleLogin);
    }

    if (signupFormElement) {
        signupFormElement.addEventListener("submit", handleSignup);
    }
}

// ============ SIGNUP (SUPABASE) ============

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

    const { data, error } = await supabase.auth.signUp({
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

    // Success message
    errorDiv.style.color = "green";
    errorDiv.textContent = "Account created! Check your email to confirm.";

    setTimeout(() => {
        document.getElementById("signupForm").classList.add("hidden");
        document.getElementById("loginForm").classList.remove("hidden");
    }, 2000);
}

// ============ LOGIN (SUPABASE) ============

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errorDiv = document.getElementById("loginError");

    errorDiv.textContent = "";

    if (!email || !password) {
        return showError(errorDiv, "Please fill in all fields");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        return showError(errorDiv, error.message);
    }

    // Save session user (optional but useful)
    localStorage.setItem("currentUser", JSON.stringify(data.user));

    // Redirect to dashboard/home
    window.location.href = "index.html";
}

// ============ ERROR HANDLER ============

function showError(div, message) {
    div.style.color = "red";
    div.textContent = message;
}

// ============ AUTH HELPERS ============

async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
}

async function logoutUser() {
    await supabase.auth.signOut();
    localStorage.removeItem("currentUser");
    window.location.href = "auth.html";
}