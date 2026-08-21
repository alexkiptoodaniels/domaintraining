// ================= SAFE INIT =================

document.addEventListener("DOMContentLoaded", () => {

    console.log("AUTH JS LOADED");

    // Check Supabase loaded
    if (!window.supabase) {
        console.error("Supabase not loaded. Check script order in HTML.");
        return;
    }

    // Create Supabase client safely
    const supabaseUrl = "https://aywujanlhafdqcocyuex.supabase.co";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5d3VqYW5saGFmZHFjb2N5dWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzYyNTIsImV4cCI6MjA5NTMxMjI1Mn0.QWLUq6iRuXvTdujW3EDtF6uZKju5-kEoO1zNVbQMq-Y";

    let supabase;
    try {
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    } catch (err) {
        console.error("Failed to create Supabase client:", err);
        return;
    }

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

    clearMessage(errorDiv);
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
            const msg = (error.message || "").toLowerCase();
            if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
                return showError(errorDiv, "This email is already registered. Try logging in instead.");
            }
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
                    // Inspect the constraint/message to say specifically what's
                    // already taken, rather than a generic message.
                    const detail = ((lookupError.message || "") + " " + (lookupError.details || "")).toLowerCase();

                    if (detail.includes("phone_number")) {
                        return showError(errorDiv, "This phone number is already registered to another account");
                    }
                    if (detail.includes("email")) {
                        return showError(errorDiv, "This email is already registered to another account");
                    }
                    if (detail.includes("login_id")) {
                        return showError(errorDiv, "That login ID was just taken — please try signing up again");
                    }
                    return showError(errorDiv, "Some of your details are already registered to another account");
                }

                return showError(errorDiv, "Account created, but we couldn't finish setup: " + lookupError.message);
            }

            showSuccess(errorDiv, `Account created! Your login ID is <strong>${loginId}</strong> &mdash; you can log in with your email, phone, or this ID. Redirecting...`);

            setTimeout(() => {
                localStorage.setItem("currentUser", JSON.stringify(data.user));
                window.location.href = "inventory.html";
            }, 6000);
        }
    } catch (err) {
        console.error("Unexpected error:", err);
        showError(errorDiv, "Unexpected error: " + err.message);
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

    clearMessage(errorDiv);
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


// ================= PROFILE PAGE =================

let originalProfileValues = null;

async function loadProfile() {
    const contentEl = document.getElementById("profileContent");

    // Only run this on profile.html
    if (!contentEl) return;

    const loadingEl = document.getElementById("profileLoading");

    const user = await getCurrentUser();

    if (!user) {
        alert("Please log in to view your profile");
        window.location.href = "login.html";
        return;
    }

    const meta = user.user_metadata || {};

    // Phone isn't part of Supabase's user object — it lives in login_lookup.
    let phone = "";
    try {
        const { data: lookupRow, error: lookupError } = await window.supabaseClient
            .from('login_lookup')
            .select('phone_number')
            .eq('id', user.id)
            .single();

        if (lookupError) {
            console.error("Could not load phone number:", lookupError);
        } else if (lookupRow) {
            phone = lookupRow.phone_number || "";
        }
    } catch (err) {
        console.error("Unexpected error loading phone number:", err);
    }

    document.getElementById("profileLoginId").value = meta.login_id || "—";
    document.getElementById("profileName").value = meta.full_name || "";
    document.getElementById("profileEmail").value = user.email || "";
    document.getElementById("profilePhone").value = phone;

    originalProfileValues = {
        name: meta.full_name || "",
        email: user.email || "",
        phone: phone
    };

    if (loadingEl) loadingEl.style.display = "none";
    contentEl.style.display = "block";

    setupProfileEditing(user.id);
}

function setupProfileEditing(userId) {
    const editBtn = document.getElementById("editProfileBtn");
    const saveBtn = document.getElementById("saveProfileBtn");
    const cancelBtn = document.getElementById("cancelProfileBtn");
    const viewActions = document.getElementById("profileViewActions");
    const editActions = document.getElementById("profileEditActions");
    const errorDiv = document.getElementById("profileError");

    const nameInput = document.getElementById("profileName");
    const emailInput = document.getElementById("profileEmail");
    const phoneInput = document.getElementById("profilePhone");

    if (!editBtn || !saveBtn || !cancelBtn) return;

    function enterEditMode() {
        clearMessage(errorDiv);
        nameInput.removeAttribute("readonly");
        emailInput.removeAttribute("readonly");
        phoneInput.removeAttribute("readonly");
        viewActions.style.display = "none";
        editActions.style.display = "flex";
        nameInput.focus();
    }

    function exitEditMode() {
        nameInput.setAttribute("readonly", true);
        emailInput.setAttribute("readonly", true);
        phoneInput.setAttribute("readonly", true);
        editActions.style.display = "none";
        viewActions.style.display = "flex";
    }

    editBtn.addEventListener("click", enterEditMode);

    cancelBtn.addEventListener("click", () => {
        clearMessage(errorDiv);
        nameInput.value = originalProfileValues.name;
        emailInput.value = originalProfileValues.email;
        phoneInput.value = originalProfileValues.phone;
        exitEditMode();
    });

    saveBtn.addEventListener("click", async () => {
        clearMessage(errorDiv);

        const newName = nameInput.value.trim();
        const newEmail = emailInput.value.trim();
        const newPhone = phoneInput.value.trim();

        if (!newName || !newEmail || !newPhone) {
            return showError(errorDiv, "Please fill in all fields");
        }

        if (!isValidPhone(newPhone)) {
            return showError(errorDiv, "Please enter a valid phone number");
        }

        const emailChanged = newEmail !== originalProfileValues.email;
        const phoneChanged = newPhone !== originalProfileValues.phone;
        const nameChanged = newName !== originalProfileValues.name;

        if (!emailChanged && !phoneChanged && !nameChanged) {
            exitEditMode();
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        try {
            // 1. Update the auth account (email + name) in one call. Supabase
            //    enforces email uniqueness itself here, so a duplicate email
            //    is caught before anything else changes.
            if (emailChanged || nameChanged) {
                const updatePayload = { data: { full_name: newName } };
                if (emailChanged) updatePayload.email = newEmail;

                const { error: updateError } = await window.supabaseClient.auth.updateUser(updatePayload);

                if (updateError) {
                    const msg = (updateError.message || "").toLowerCase();
                    if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("already been registered")) {
                        return showError(errorDiv, "This email is already registered to another account");
                    }
                    return showError(errorDiv, "Error: " + updateError.message);
                }
            }

            // 2. Update phone number (and keep login_lookup.email in sync) —
            //    the phone_number column's UNIQUE constraint catches duplicates.
            if (phoneChanged || emailChanged) {
                const lookupUpdate = {};
                if (phoneChanged) lookupUpdate.phone_number = newPhone;
                if (emailChanged) lookupUpdate.email = newEmail;

                const { error: lookupUpdateError } = await window.supabaseClient
                    .from('login_lookup')
                    .update(lookupUpdate)
                    .eq('id', userId);

                if (lookupUpdateError) {
                    if (lookupUpdateError.code === "23505") {
                        const detail = ((lookupUpdateError.message || "") + " " + (lookupUpdateError.details || "")).toLowerCase();
                        if (detail.includes("phone_number")) {
                            return showError(errorDiv, "This phone number is already registered to another account");
                        }
                        return showError(errorDiv, "That email or phone number is already registered to another account");
                    }
                    return showError(errorDiv, "Could not update phone number: " + lookupUpdateError.message);
                }
            }

            originalProfileValues = { name: newName, email: newEmail, phone: newPhone };
            exitEditMode();

            showSuccess(
                errorDiv,
                emailChanged
                    ? "Saved! Check your inbox to confirm your new email — it won't take effect until you do."
                    : "Profile updated."
            );
        } catch (err) {
            console.error("Unexpected error updating profile:", err);
            showError(errorDiv, "Unexpected error: " + err.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Changes";
        }
    });
}

document.addEventListener("DOMContentLoaded", loadProfile);

// ================= ERROR HANDLER =================

function showError(div, message) {
    div.style.color = "red";
    div.textContent = message;
    div.classList.add("show");
}

function showSuccess(div, html) {
    div.style.color = "green";
    div.innerHTML = html;
    div.classList.add("show");
}

function clearMessage(div) {
    div.textContent = "";
    div.classList.remove("show");
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
    if (!window.supabaseClient) {
        console.error("Supabase client not initialized — check supabaseUrl/supabaseKey in auth.js");
        return null;
    }
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

    // Find the profile list item
    let profileItem = navList.querySelector('li.profile-nav-item');
    
    // Find the login link
    let loginLink = navList.querySelector('li a[href="login.html"]');
    
    if (user) {
        // User is logged in - show inventory & profile, hide login
        if (inventoryItem) {
            inventoryItem.style.display = 'block';
        }

        if (profileItem) {
            profileItem.style.display = 'block';
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
        // User is logged out - hide inventory & profile, show login
        if (inventoryItem) {
            inventoryItem.style.display = 'none';
        }

        if (profileItem) {
            profileItem.style.display = 'none';
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