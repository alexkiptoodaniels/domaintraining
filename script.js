// Product Data Store
let products = [];

let nextId = 1;
let currentEditId = null;
let isSorted = false;
let currentUser = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeTheme();
    setupModalListeners();
    setupFormListeners();
    setupSearch();
    setupActiveNav();
    loadUserAndProducts();
});

// Load current user and products from database
async function loadUserAndProducts() {
    try {
        // Get current user
        if (window.supabaseClient) {
            const { data } = await window.supabaseClient.auth.getUser();
            currentUser = data.user;
            
            if (currentUser) {
                await loadProductsFromDB();
            } else {
                console.log("No user logged in");
                // Redirect to login if on inventory page
                if (window.location.pathname.includes('inventory.html')) {
                    alert('Please log in to access your inventory');
                    window.location.href = 'login.html';
                    return;
                }
                renderTable();
                updateStats();
            }
        }
    } catch (error) {
        console.error("Error loading user and products:", error);
        renderTable();
        updateStats();
    }
}

// Load products from Supabase database
async function loadProductsFromDB() {
    try {
        if (!window.supabaseClient || !currentUser) return;

        const { data, error } = await window.supabaseClient
            .from('inventory')
            .select('*')
            .eq('user_id', currentUser.id);

        if (error) {
            console.error("Error loading products:", error);
            return;
        }

        // Transform database format to app format
        products = data.map(item => ({
            id: item.id,
            name: item.product_name,
            productId: item.product_id,
            price: item.price,
            stock: item.quantity_available
        }));

        renderTable();
        updateStats();
    } catch (error) {
        console.error("Unexpected error loading products:", error);
    }
}

// ============ THEME MANAGEMENT ============
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

function setTheme(theme) {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    if (theme === 'light') {
        body.classList.add('light-mode');
        if (themeToggle) themeToggle.textContent = '🌙 Dark Mode';
    } else {
        body.classList.remove('light-mode');
        if (themeToggle) themeToggle.textContent = '☀️ Light Mode';
    }
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const body = document.body;
    const currentTheme = body.classList.contains('light-mode') ? 'light' : 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

// ============ TABLE RENDERING ============
function renderTable(productsToRender = products) {
    const tbody = document.getElementById('productTable');
    tbody.innerHTML = '';

    productsToRender.forEach(product => {
        const status = product.stock <= 10 ? 'Low Stock' : 'In Stock';
        const statusClass = product.stock <= 10 ? 'status-inactive' : 'status-active';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(product.name)}</td>
            <td>${escapeHtml(product.productId)}</td>
            <td>$${product.price.toFixed(2)}</td>
            <td>${product.stock}</td>
            <td><span class="${statusClass}">${status}</span></td>
            <td>
                <div class="actions">
                    <button class="btn-small btn-edit" data-id="${product.id}">Edit</button>
                    <button class="btn-small btn-delete" data-id="${product.id}">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    attachTableListeners();
}

function attachTableListeners() {
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.dataset.id);
            openEditModal(id);
        });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.dataset.id);
            showDeleteConfirm(id);
        });
    });
}

// ============ STATS MANAGEMENT ============
function updateStats() {
    const totalCount = products.length;
    const inStockCount = products.filter(p => p.stock > 0).length;
    const lowStockCount = products.filter(p => p.stock <= 10).length;

    document.getElementById('totalProducts').textContent = totalCount;
    document.getElementById('inStockCount').textContent = inStockCount;
    document.getElementById('lowStockCount').textContent = lowStockCount;
}

// ============ SEARCH & FILTER ============
function filterProducts(searchTerm) {
    if (!searchTerm) return products;

    const term = searchTerm.toLowerCase();
    return products.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.productId.toLowerCase().includes(term)
    );
}

function sortProducts() {
    isSorted = !isSorted;
    const sortBtn = document.getElementById('sortBtn');

    if (isSorted) {
        sortBtn.classList.add('active');
        sortBtn.textContent = 'Sort A-Z (ON)';
    } else {
        sortBtn.classList.remove('active');
        sortBtn.textContent = 'Sort A-Z';
    }

    performSearch();
}

function performSearch() {
    const searchTerm = document.getElementById('searchInput').value;
    let results = filterProducts(searchTerm);

    if (isSorted) {
        results = [...results].sort((a, b) => a.name.localeCompare(b.name));
    }

    renderTable(results);
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const sortBtn = document.getElementById('sortBtn');

    if (searchInput) {
        searchInput.addEventListener('keyup', performSearch);
    }

    if (sortBtn) {
        sortBtn.addEventListener('click', sortProducts);
    }
}

// ============ MODAL MANAGEMENT ============
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
}

function setupModalListeners() {
    // Close modal on X button click
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.dataset.modal;
            closeModal(modalId);
        });
    });

    // Close modal on cancel button click
    document.querySelectorAll('.btn-cancel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.dataset.modal;
            closeModal(modalId);
        });
    });

    // Close modal on overlay click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    // Add button listener
    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            currentEditId = null;
            document.getElementById('addProductForm').reset();
            openModal('addProductModal');
        });
    }
}

// ============ FORM MANAGEMENT ============
function setupFormListeners() {
    const addForm = document.getElementById('addProductForm');
    const editForm = document.getElementById('editProductForm');
    const deleteBtn = document.getElementById('confirmDelete');

    if (addForm) {
        addForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleAddProduct();
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleEditProduct();
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDeleteProduct);
    }
}

async function handleAddProduct() {
    const form = document.getElementById('addProductForm');
    const name = form.elements['productName'].value.trim();
    const productId = form.elements['productId'].value.trim();
    const price = parseFloat(form.elements['productPrice'].value);
    const stock = parseInt(form.elements['productStock'].value);

    if (!name || !productId || isNaN(price) || isNaN(stock)) {
        alert('Please fill in all fields with valid values');
        return;
    }

    if (price < 0) {
        alert('Price must be a positive number');
        return;
    }

    if (stock < 0) {
        alert('Stock must be a positive number');
        return;
    }

    if (!currentUser) {
        alert('Please log in to add products');
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('inventory')
            .insert([{
                user_id: currentUser.id,
                product_name: name,
                product_id: productId,
                price: price,
                quantity_available: stock
            }])
            .select();

        if (error) {
            console.error("Error adding product:", error);
            alert('Error adding product: ' + error.message);
            return;
        }

        // Add to local array
        if (data && data[0]) {
            products.push({
                id: data[0].id,
                name: data[0].product_name,
                productId: data[0].product_id,
                price: data[0].price,
                stock: data[0].quantity_available
            });
        }

        renderTable();
        updateStats();
        closeModal('addProductModal');
        form.reset();
    } catch (error) {
        console.error("Unexpected error:", error);
        alert('Unexpected error: ' + error.message);
    }
}

function openEditModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    currentEditId = productId;
    const form = document.getElementById('editProductForm');
    form.elements['productName'].value = product.name;
    form.elements['productId'].value = product.productId;
    form.elements['productPrice'].value = product.price;
    form.elements['productStock'].value = product.stock;

    openModal('editProductModal');
}

async function handleEditProduct() {
    const form = document.getElementById('editProductForm');
    const name = form.elements['productName'].value.trim();
    const productId = form.elements['productId'].value.trim();
    const price = parseFloat(form.elements['productPrice'].value);
    const stock = parseInt(form.elements['productStock'].value);

    if (!name || !productId || isNaN(price) || isNaN(stock)) {
        alert('Please fill in all fields with valid values');
        return;
    }

    if (price < 0) {
        alert('Price must be a positive number');
        return;
    }

    if (stock < 0) {
        alert('Stock must be a positive number');
        return;
    }

    try {
        const { error } = await window.supabaseClient
            .from('inventory')
            .update({
                product_name: name,
                product_id: productId,
                price: price,
                quantity_available: stock
            })
            .eq('id', currentEditId);

        if (error) {
            console.error("Error updating product:", error);
            alert('Error updating product: ' + error.message);
            return;
        }

        // Update local array
        const product = products.find(p => p.id === currentEditId);
        if (product) {
            product.name = name;
            product.productId = productId;
            product.price = price;
            product.stock = stock;
        }

        renderTable();
        updateStats();
        closeModal('editProductModal');
        form.reset();
    } catch (error) {
        console.error("Unexpected error:", error);
        alert('Unexpected error: ' + error.message);
    }
}

function showDeleteConfirm(productId) {
    currentEditId = productId;
    openModal('deleteModal');
}

async function handleDeleteProduct() {
    try {
        const { error } = await window.supabaseClient
            .from('inventory')
            .delete()
            .eq('id', currentEditId);

        if (error) {
            console.error("Error deleting product:", error);
            alert('Error deleting product: ' + error.message);
            return;
        }

        products = products.filter(p => p.id !== currentEditId);
        renderTable();
        updateStats();
        closeModal('deleteModal');
        currentEditId = null;
    } catch (error) {
        console.error("Unexpected error:", error);
        alert('Unexpected error: ' + error.message);
    }
}

// ============ NAVIGATION ============
function setupActiveNav() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('nav a');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// ============ UTILITY ============
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}