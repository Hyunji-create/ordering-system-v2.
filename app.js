let _supabase, currentDBOrder = null;
let allStandingOrders = []; let activeProducts = []; let originalKitchenVenue = ""; 

window.onload = function() {
    const savedUser = localStorage.getItem('kitchen_portal_user');
    if (savedUser) {
        window.currentUser = JSON.parse(savedUser);
        if (window.currentUser.role === 'kitchen') originalKitchenVenue = window.currentUser.venue;
        showDashboard();
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
        showDashboard();
    } else alert("Failed");
};

window.handleLogout = function() { localStorage.removeItem('kitchen_portal_user'); location.reload(); };

function startApp() {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.setTomorrowDate();
    window.populateSuppliers();
    loadStandingOrders();
}

window.resetToKitchen = function() {
    window.currentUser.venue = originalKitchenVenue;
    updateOverrideIndicator(originalKitchenVenue, false);
    updateHeader(originalKitchenVenue);
    setTomorrowDate(); loadProducts();
};

async function loadStandingOrders() {
    const { data } = await _supabase.from('standing_orders').select('*');
    allStandingOrders = data || [];
    applyStandingToDaily();
}

// Logic for sorting and day toggles for standing orders
window.toggleDay = (btn) => btn.classList.toggle('day-active');
window.addStandingOrder = async function() { /* Logic for adding */ };
window.deleteStanding = async function(id) { /* Logic for deleting */ };
