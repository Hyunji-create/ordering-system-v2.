// app.js - Orchestrator
window.currentDBOrder = null;
window.allStandingOrders = [];
window.activeProducts = [];
window.originalKitchenVenue = ""; 

window.onload = function() {
    const savedUser = localStorage.getItem('kitchen_portal_user');
    if (savedUser) {
        window.currentUser = JSON.parse(savedUser);
        if (window.currentUser.role === 'kitchen') window.originalKitchenVenue = window.currentUser.venue;
        window.showDashboard();
    }
};

window.handleLogin = function() {
    const u = document.getElementById('username').value.toLowerCase().trim();
    const p = document.getElementById('password').value.trim();
    const found = USERS.find(x => x.id === u && x.pw === p);
    if (found) {
        window.currentUser = JSON.parse(JSON.stringify(found));
        localStorage.setItem('kitchen_portal_user', JSON.stringify(window.currentUser));
        if (found.role === 'kitchen') window.originalKitchenVenue = found.venue;
        window.showDashboard();
    } else alert("Failed");
};

window.startApp = function() {
    window.setTomorrowDate();
    window.populateSuppliers ? window.populateSuppliers() : null;
    window.loadStandingOrders();
}

window.loadStandingOrders = async function() {
    const { data } = await window._supabase.from('standing_orders').select('*');
    window.allStandingOrders = data || [];
    if (window.applyStandingToDaily) window.applyStandingToDaily();
};
