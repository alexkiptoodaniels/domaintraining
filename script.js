// Product Data Store
let products = [
    { id: 1, name: 'MacBook Pro 14"', productId: 'MBPRO14', stock: 8, price: 1999 },
    { id: 2, name: 'Dell XPS 15', productId: 'DXPS15', stock: 12, price: 1899 },
    { id: 3, name: 'Lenovo ThinkPad X1', productId: 'LTP-X1', stock: 3, price: 1299 },
    { id: 4, name: 'ASUS ROG Gaming', productId: 'ASUS-ROG', stock: 6, price: 2199 },
    { id: 5, name: 'HP Pavilion 15', productId: 'HP-PAV15', stock: 15, price: 699 }
];

let nextId = 6;
let currentEditId = null;
let isSorted = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeTheme();
    renderTable();
    updateStats();
    setupModalListeners();
    setupFormListeners();
    setupSearch();
    setupActiveNav();
});

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

function handleAddProduct() {
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

    products.push({
        id: nextId++,
        name,
        productId,
        price,
        stock
    });

    renderTable();
    updateStats();
    closeModal('addProductModal');
    form.reset();
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

function handleEditProduct() {
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
}

function showDeleteConfirm(productId) {
    currentEditId = productId;
    openModal('deleteModal');
}

function handleDeleteProduct() {
    products = products.filter(p => p.id !== currentEditId);
    renderTable();
    updateStats();
    closeModal('deleteModal');
    currentEditId = null;
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