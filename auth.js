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


// ================= FORM SETUP =================

function setupAuthForms() {

    const loginFormElement = document.getElementById("loginFormElement");
    const signupFormElement = document.getElementById("signupFormElement");

    console.log("Setting up auth forms...");
    console.log("Sign up form element found:", signupFormElement);
    console.log("Login form element found:", loginFormElement);

    // FORM EVENTS
    if (loginFormElement) {
        loginFormElement.addEventListener("submit", (e) => {
            console.log("Login form submitted");
            handleLogin(e);
        });
    }

    if (signupFormElement) {
        signupFormElement.addEventListener("submit", (e) => {
            console.log("Signup form submitted - event triggered");
            handleSignup(e);
        });
    }
}


// ================= SIGNUP =================

async function handleSignup(e) {
    e.preventDefault();
    
    console.log("Sign up form submitted");

    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("signupConfirmPassword").value;
    const errorDiv = document.getElementById("signupError");

    errorDiv.textContent = "";

    if (!name || !email || !password || !confirmPassword) {
        console.log("Form validation failed");
        return showError(errorDiv, "Please fill in all fields");
    }

    if (password.length < 6) {
        return showError(errorDiv, "Password must be at least 6 characters");
    }

    // Check password strength
    const strengthCheck = checkPasswordStrength(password);
    if (!strengthCheck.isStrong) {
        return showError(errorDiv, strengthCheck.message);
    }

    if (password !== confirmPassword) {
        return showError(errorDiv, "Passwords do not match");
    }

    console.log("Attempting to sign up:", { email, name });

    try {
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
            console.error("Sign up error:", error);
            return showError(errorDiv, "Error: " + error.message);
        }

        console.log("Sign up successful:", data);
        
        if (data.user) {
            errorDiv.style.color = "green";
            errorDiv.textContent = "Account created! Redirecting...";

            setTimeout(() => {
                localStorage.setItem("currentUser", JSON.stringify(data.user));
                window.location.href = "index.html";
            }, 2000);
        }
    } catch (err) {
        console.error("Unexpected error:", err);
        showError(errorDiv, "Unexpected error: " + err.message);
    }
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

function checkPasswordStrength(password) {
    let strength = 0;
    let feedback = [];

    if (password.length >= 8) strength++;
    else feedback.push("at least 8 characters");

    if (/[A-Z]/.test(password)) strength++;
    else feedback.push("an uppercase letter");

    if (/[a-z]/.test(password)) strength++;
    else feedback.push("a lowercase letter");

    if (/[0-9]/.test(password)) strength++;
    else feedback.push("a number");

    if (/[!@#$%^&*]/.test(password)) strength++;
    else feedback.push("a special character (!@#$%^&*)");

    if (strength < 3) {
        return {
            isStrong: false,
            message: "Password is too weak. Please include: " + feedback.join(", ")
        };
    }

    return { isStrong: true, message: "Password is strong" };
}


// ================= HELPERS =================

async function getCurrentUser() {
    const { data } = await window.supabaseClient.auth.getUser();
    return data.user;
}

async function logoutUser() {
    await window.supabaseClient.auth.signOut();
    localStorage.removeItem("currentUser");
    window.location.href = "login.html";
}

// ================= CHECK USER ON PAGE LOAD =================

async function checkUserAndUpdateNav() {
    const user = await getCurrentUser();
    const navList = document.querySelector('nav ul');
    
    if (!navList) return;

    const loginLink = navList.querySelector('li a[href="login.html"]');
    
    if (user) {
        if (loginLink) {
            loginLink.textContent = "Logout";
            loginLink.href = "#";
            loginLink.onclick = (e) => {
                e.preventDefault();
                logoutUser();
            };
        }
    } else {
        if (loginLink) {
            loginLink.textContent = "Login";
            loginLink.href = "login.html";
            loginLink.onclick = null;
        }
    }
}

// Call on page load
document.addEventListener("DOMContentLoaded", checkUserAndUpdateNav);