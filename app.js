// app.js - Main Orchestrator
window.currentDBOrder = null;
window.allStandingOrders = [];
window.activeProducts = [];
window.originalKitchenVenue = ""; 

// 1. Check for saved session on load
window.onload = function() {
    const savedUser = localStorage.getItem('kitchen_portal_user');
    if (savedUser) {
        window.currentUser = JSON.parse(savedUser);
        if (window.currentUser.role === 'kitchen') window.originalKitchenVenue = window.currentUser.venue;
        window.showDashboard();
    }
};

// 2. Handle Login
window.handleLogin = function() {
    const u = document.getElementById('username').value.toLowerCase().trim();
    const p = document.getElementById('password').value.trim();
    const found = USERS.find(x => x.id === u && x.pw === p);
    
    if (found) {
        window.currentUser = JSON.parse(JSON.stringify(found));
        localStorage.setItem('kitchen_portal_user', JSON.stringify(window.currentUser));
        if (found.role === 'kitchen') window.originalKitchenVenue = found.venue;
        window.showDashboard();
    } else {
        alert("Login failed.");
    }
};

// 3. Handle Logout (FIXED: Added window. prefix)
window.handleLogout = function() {
    if(confirm("Are you sure you want to logout?")) {
        localStorage.removeItem('kitchen_portal_user');
        location.reload();
    }
};

// 4. Reset to Kitchen Manager View
window.resetToKitchen = function() {
    window.currentUser.venue = window.originalKitchenVenue;
    window.updateOverrideIndicator(window.originalKitchenVenue, false);
    window.updateHeader(window.originalKitchenVenue);
    window.setTomorrowDate();
    window.loadProducts();
};

// 5. Start the App Logic
window.startApp = function() {
    window.setTomorrowDate();
    window.populateSuppliers();
    window.loadStandingOrders();
};

// 6. Fetch Standing Orders
window.loadStandingOrders = async function() {
    const { data } = await window._supabase.from('standing_orders').select('*');
    window.allStandingOrders = data || [];
    if (window.applyStandingToDaily) window.applyStandingToDaily();
};
