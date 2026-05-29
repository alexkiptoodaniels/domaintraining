// ============ USER AUTHENTICATION ============

// Initialize auth system
document.addEventListener('DOMContentLoaded', function() {
    initializeTheme();
    
    // Only run auth logic on auth.html page
    if (window.location.pathname.includes('auth.html')) {
        setupAuthForms();
    }
});

// ============ FORM TOGGLE ============
function setupAuthForms() {
    const toggleToSignup = document.getElementById('toggleToSignup');
    const toggleToLogin = document.getElementById('toggleToLogin');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginFormElement = document.getElementById('loginFormElement');
    const signupFormElement = document.getElementById('signupFormElement');

    if (toggleToSignup) {
        toggleToSignup.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
        });
    }

    if (toggleToLogin) {
        toggleToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        });
    }

    if (loginFormElement) {
        loginFormElement.addEventListener('submit', handleLogin);
    }

    if (signupFormElement) {
        signupFormElement.addEventListener('submit', handleSignup);
    }
}

// ============ LOGIN HANDLER ============
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    // Clear previous errors
    errorDiv.classList.remove('show');
    errorDiv.textContent = '';

    // Validate input
    if (!email || !password) {
        showError(errorDiv, 'Please fill in all fields');
        return;
    }

    // Get users from localStorage
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users.find(u => u.email === email);

    if (!user) {
        showError(errorDiv, 'Email not found. Please sign up first.');
        return;
    }

    // Verify password (simple comparison - in production use bcrypt)
    if (user.password !== hashPassword(password)) {
        showError(errorDiv, 'Invalid email or password');
        return;
    }

    // Login successful
    localStorage.setItem('currentUser', JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email
    }));

    window.location.href = 'index.html';
}

// ============ SIGNUP HANDLER ============
function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const errorDiv = document.getElementById('signupError');

    // Clear previous errors
    errorDiv.classList.remove('show');
    errorDiv.textContent = '';

    // Validate input
    if (!name || !email || !password || !confirmPassword) {
        showError(errorDiv, 'Please fill in all fields');
        return;
    }

    if (password.length < 6) {
        showError(errorDiv, 'Password must be at least 6 characters');
        return;
    }

    if (password !== confirmPassword) {
        showError(errorDiv, 'Passwords do not match');
        return;
    }

    // Validate email format
    if (!isValidEmail(email)) {
        showError(errorDiv, 'Please enter a valid email address');
        return;
    }

    // Get existing users
    const users = JSON.parse(localStorage.getItem('users')) || [];

    // Check if email already exists
    if (users.find(u => u.email === email)) {
        showError(errorDiv, 'Email already registered. Please login instead.');
        return;
    }

    // Create new user
    const newUser = {
        id: generateUserId(),
        name,
        email,
        password: hashPassword(password),
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));

    // Show success message and redirect
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = 'Account created successfully! Redirecting to login...';
    document.getElementById('signupForm').appendChild(successDiv);

    setTimeout(() => {
        document.getElementById('signupForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
    }, 1500);
}

// ============ UTILITY FUNCTIONS ============
function showError(errorDiv, message) {
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function hashPassword(password) {
    // Simple hash for demo - in production use bcrypt or similar
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ============ CHECK AUTH STATUS ============
function isUserLoggedIn() {
    return localStorage.getItem('currentUser') !== null;
}

function getCurrentUser() {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
}

function logoutUser() {
    localStorage.removeItem('currentUser');
    window.location.href = 'auth.html';
}
