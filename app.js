// app.js - Orchestrator
let _supabase, currentDBOrder = null;
let allStandingOrders = [];
let activeProducts = [];
let originalKitchenVenue = ""; 

window.onload = function() {
    const savedUser = localStorage.getItem('kitchen_portal_user');
    if (savedUser) {
        window.currentUser = JSON.parse(savedUser);
        if (window.currentUser.role === 'kitchen') originalKitchenVenue = window.currentUser.venue;
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
        if (found.role === 'kitchen') originalKitchenVenue = found.venue;
        window.showDashboard();
    } else alert("Login Failed");
};

function startApp() {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Safety check: ensure functions exist before calling
    if (window.setTomorrowDate) window.setTomorrowDate();
    if (window.populateSuppliers) window.populateSuppliers();
    
    window.loadStandingOrders();
}

window.loadStandingOrders = async function() {
    const { data } = await _supabase.from('standing_orders').select('*');
    allStandingOrders = data || [];
    if (window.applyStandingToDaily) window.applyStandingToDaily();
};

window.handleLogout = function() {
    localStorage.removeItem('kitchen_portal_user');
    location.reload();
};
