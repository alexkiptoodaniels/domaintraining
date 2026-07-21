// ================= SAFE INIT =================

document.addEventListener("DOMContentLoaded", () => {

    console.log("AUTH JS LOADED");

    // Check Supabase loaded
    if (!window.supabase) {
        console.error("Supabase not loaded. Check script order in HTML.");
        return;
    }

    // Create Supabase client safely
    const supabaseUrl = "sb_publishable_jq0S9xtfWrfxFNYNybUSwQ_4FR1T7dd";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5d3VqYW5saGFmZHFjb2N5dWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzYyNTIsImV4cCI6MjA5NTMxMjI1Mn0.QWLUq6iRuXvTdujW3EDtF6uZKju5-kEoO1zNVbQMq-Y";

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


// ================= LOGIN-ID / LOOKUP HELPERS =================
// Supabase Auth signs in by real email. To also allow logging in with a
// phone number or the generated login ID, we resolve those to the account's
// real email first (via the get_login_email() DB function), then sign in
// normally with that email.

function looksLikeEmail(value) {
    return value.includes("@");
}

// ================= SIGNUP =================

async function handleSignup(e) {
    e.preventDefault();
    
    console.log("Sign up form submitted");

    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const phone = document.getElementById("signupPhone").value.trim();
    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("signupConfirmPassword").value;
    const errorDiv = document.getElementById("signupError");

    errorDiv.textContent = "";

    if (!name || !email || !phone || !password || !confirmPassword) {
        console.log("Form validation failed");
        return showError(errorDiv, "Please fill in all fields");
    }

    if (!isValidPhone(phone)) {
        return showError(errorDiv, "Please enter a valid phone number");
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

    try {
        // 1. Atomically reserve the next sequential login ID (e.g. "001").
        const { data: loginId, error: idError } = await window.supabaseClient
            .rpc('generate_login_id');

        if (idError || !loginId) {
            console.error("Error generating login ID:", idError);
            return showError(errorDiv, "Could not generate a login ID. Please try again.");
        }

        // 2. Create the actual auth account using the real email.
        console.log("Attempting to sign up:", { email, name, loginId });

        const { data, error } = await window.supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    phone_number: phone,
                    login_id: loginId
                }
            }
        });

        if (error) {
            console.error("Sign up error:", error);
            return showError(errorDiv, "Error: " + error.message);
        }

        if (data.user) {
            // 3. Save the lookup row so phone/login-ID can be resolved back to
            //    this email at login time. phone_number and login_id both have
            //    UNIQUE constraints, so duplicates fail here rather than being
            //    silently allowed.
            const { error: lookupError } = await window.supabaseClient
                .from('login_lookup')
                .insert([{
                    id: data.user.id,
                    email: email,
                    phone_number: phone,
                    login_id: loginId
                }]);

            if (lookupError) {
                console.error("Error saving login lookup:", lookupError);
                if (lookupError.code === "23505") {
                    return showError(errorDiv, "This phone number is already registered to another account");
                }
                console.error("Note: email duplicates are normally caught earlier by auth.signUp(); this branch is mainly for phone_number/login_id conflicts.");
                return showError(errorDiv, "Account created, but we couldn't finish setup: " + lookupError.message);
            }

            errorDiv.style.color = "green";
            errorDiv.innerHTML = `Account created! Your login ID is <strong>${loginId}</strong> &mdash; you can log in with your email, phone, or this ID. Redirecting...`;

            setTimeout(() => {
                localStorage.setItem("currentUser", JSON.stringify(data.user));
                window.location.href = "inventory.html";
            }, 6000);
        }
    } catch (err) {
        console.error("Unexpected error:", err);
        showError(errorDiv, "Unexpected error: " + err.message);
    }
}

// ================= PHONE VALIDATION =================

function isValidPhone(phone) {
    // Allows an optional leading +, digits, spaces, dashes, and parentheses.
    // Requires at least 7 digits overall so obviously-invalid entries are rejected.
    const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
    const digitCount = (phone.match(/[0-9]/g) || []).length;
    return phoneRegex.test(phone) && digitCount >= 7;
}


// ================= LOGIN =================

async function handleLogin(e) {
    e.preventDefault();

    const identifier = document.getElementById("loginIdentifier").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errorDiv = document.getElementById("loginError");

    errorDiv.textContent = "";

    if (!identifier || !password) {
        return showError(errorDiv, "Please fill in all fields");
    }

    let email = identifier;

    // If it's not an email, resolve phone number or login ID to the
    // account's real email via the get_login_email() DB function.
    if (!looksLikeEmail(identifier)) {
        const { data: resolvedEmail, error: lookupError } = await window.supabaseClient
            .rpc('get_login_email', { identifier });

        if (lookupError || !resolvedEmail) {
            return showError(errorDiv, "Invalid email, phone number, login ID, or password");
        }

        email = resolvedEmail;
    }

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        return showError(errorDiv, error.message);
    }

    localStorage.setItem("currentUser", JSON.stringify(data.user));

    window.location.href = "inventory.html";
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

    // Find the inventory list item
    let inventoryItem = navList.querySelector('li.inventory-nav-item');
    
    // Find the login link
    let loginLink = navList.querySelector('li a[href="login.html"]');
    
    if (user) {
        // User is logged in - show inventory, hide login
        if (inventoryItem) {
            inventoryItem.style.display = 'block';
        }
        
        if (!loginLink) {
            // If login link doesn't exist, create logout link
            const newLi = document.createElement('li');
            const newLink = document.createElement('a');
            newLink.textContent = "Log Out";
            newLink.href = "#";
            newLink.onclick = (e) => {
                e.preventDefault();
                logoutUser();
            };
            newLi.appendChild(newLink);
            navList.appendChild(newLi);
        } else {
            // Update existing login link to logout
            loginLink.textContent = "Log Out";
            loginLink.href = "#";
            loginLink.onclick = (e) => {
                e.preventDefault();
                logoutUser();
            };
        }
        console.log("User logged in - inventory shown, logout button shown");
    } else {
        // User is logged out - hide inventory, show login
        if (inventoryItem) {
            inventoryItem.style.display = 'none';
        }
        
        if (loginLink) {
            loginLink.textContent = "Log In";
            loginLink.href = "login.html";
            loginLink.onclick = null;
        }
        console.log("User logged out - inventory hidden, login button shown");
    }
}

// Call on page load
document.addEventListener("DOMContentLoaded", checkUserAndUpdateNav);