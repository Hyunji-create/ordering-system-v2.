// --- CONFIGURATION ---
const PRODUCT_ORDER = [
    "Matcha", "Hojicha", "Strawberry Puree", "Chia Pudding", "Mango Puree", 
    "Vanilla Syrup", "Simple Syrup", "Toastie-Beef", "Toastie-Ham&Cheese", "Toastie-Curry", "Ice",
    "Banana Bread", "Yuzu Curd", "Cookie", "Yuzu Juice", "Diced Strawberry", "Granola"
];
const LEAD_2_DAY_ITEMS = ["Vanilla Syrup", "Simple Syrup", "Yuzu Juice"];

const USERS = [
    { id: 'wynstaff', pw: 'wynstaff', venue: 'WYN', role: 'venue' },
    { id: 'mccstaff', pw: 'mccstaff', venue: 'MCC', role: 'venue' },
    { id: 'wsqstaff', pw: 'wsqstaff', venue: 'WSQ', role: 'venue' },
    { id: 'dsqstaff', pw: 'dsqstaff', venue: 'DSQ', role: 'venue' }, 
    { id: 'gjstaff', pw: 'gjstaff', venue: 'GJ', role: 'venue' },
    { id: 'dsqkmanager', pw: 'dsqkmanager', venue: 'DSQK', role: 'kitchen' },
    { id: 'ckmanager', pw: 'ckmanager', venue: 'CK', role: 'kitchen' }
];

let _supabase, initialFormState = "", currentDBOrder = null;
let allStandingOrders = [];
let activeProducts = [];
let originalKitchenVenue = ""; 

// --- SESSION & PERSISTENCE ---
window.onload = function() {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const savedUser = localStorage.getItem('kitchen_portal_user');
    if (savedUser) {
        window.currentUser = JSON.parse(savedUser);
        if (window.currentUser.role === 'kitchen') originalKitchenVenue = window.currentUser.venue;
        showDashboard();
        checkMaintenanceMode(); 
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
        checkMaintenanceMode();
    } else { alert("Login failed."); }
};

window.handleLogout = function() {
    localStorage.removeItem('kitchen_portal_user');
    location.reload();
};

function showDashboard() {
    document.getElementById('login-card').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('welcome-msg').innerText = window.currentUser.venue;
    const exportLink = document.getElementById('admin-export-link');
    if (exportLink && window.currentUser.role === 'kitchen') exportLink.classList.remove('hidden');
    startApp();
}

// --- MAINTENANCE MODE ---
async function checkMaintenanceMode() {
    const { data } = await _supabase.from('app_settings').select('setting_value').eq('setting_key', 'maintenance_mode').single();
    const isMaint = data && data.setting_value === 'true';
    const maintBtn = document.getElementById('maint-toggle-btn');
    if (maintBtn && window.currentUser.id === 'ckmanager') {
        maintBtn.classList.remove('hidden');
        maintBtn.innerText = isMaint ? "⚠️ Disable Maintenance Mode" : "🛠️ Enable Maintenance Mode";
    }
    if (isMaint && window.currentUser.id !== 'ckmanager') {
        document.getElementById('maintenance-overlay').classList.remove('hidden');
    }
}

// --- CORE APP LOGIC ---
function startApp() {
    setTomorrowDate();
    window.populateSuppliers();
    loadStandingOrders(); 
}

window.populateSuppliers = function() {
    const select = document.getElementById('supplier-select');
    if(select && !select.innerHTML) select.innerHTML = `<option value="CK">CK</option><option value="DSQK">DSQK</option><option value="GJ">GJ</option>`;
    loadProducts();
};

function sortItemsByCustomOrder(a, b) {
    const nA = a.name || a.item_name || ""; const nB = b.name || b.item_name || "";
    let iA = PRODUCT_ORDER.indexOf(nA); let iB = PRODUCT_ORDER.indexOf(nB);
    return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB);
}

function setTomorrowDate() {
    const tom = new Date(); tom.setDate(tom.getDate() + 1);
    const iso = tom.toISOString().split('T')[0];
    document.getElementById('delivery-date').value = iso;
    document.getElementById('admin-view-date').value = iso;
}

window.switchTab = function(v) {
    document.getElementById('view-daily').classList.toggle('hidden', v !== 'daily');
    document.getElementById('view-standing').classList.toggle('hidden', v !== 'standing');
    
    // Ensure the Supplier selection header stays visible for both tabs
    const header = document.querySelector('.bg-white.p-6.rounded-3xl.shadow-sm.mb-6');
    if (header) header.classList.remove('hidden');

    document.getElementById('tab-daily').className = v === 'daily' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
    document.getElementById('tab-standing').className = v === 'standing' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
    
    if (v === 'standing') loadExistingStandingValues();
};

async function loadProducts() {
    const supplier = document.getElementById('supplier-select').value;
    const { data } = await _supabase.from('products').select('*').eq('supplier', supplier);
    
    if (data) {
        activeProducts = data.sort(sortItemsByCustomOrder);
        const dailyList = document.getElementById('product-list');
        const standingList = document.getElementById('standing-product-list'); 
        
        if (dailyList) dailyList.innerHTML = ""; 
        if (standingList) standingList.innerHTML = ""; 
        
        activeProducts.forEach(p => {
            const allowed = p.restricted_to ? p.restricted_to.split(',').map(v=>v.trim()) : [];
            const userVenue = window.currentUser.venue;
            const userRole = window.currentUser.role;

            let hasAccess = (userRole === 'kitchen');
            if (!hasAccess) {
                hasAccess = !p.restricted_to || allowed.includes(userVenue);
                if (!hasAccess && userVenue.startsWith('DSQ') && allowed.some(a => a.startsWith('DSQ'))) {
                    hasAccess = true;
                }
            }

            if (!hasAccess) return;

            const isLead = LEAD_2_DAY_ITEMS.includes(p.name);
            const badge = isLead ? `<span class="block text-[8px] text-orange-600 font-black mt-0.5 uppercase">⚠️ 2-Day Lead</span>` : "";

            const createRow = (prefix) => `
                <div class="item-row py-4 border-b">
                    <div class="flex justify-between items-center px-2">
                        <div class="text-left">
                            <p class="font-bold text-slate-800 uppercase text-[13px] leading-tight">${p.name}</p>
                            ${badge}
                        </div>
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="adjustQty('${prefix}-${p.name}', -1)" class="qty-btn" data-item="${p.name}">-</button>
                            <input type="number" id="qty-${prefix}-${p.name}" data-name="${p.name}" value="0" class="w-12 h-11 border-2 rounded-xl text-center font-black text-blue-600 outline-none border-slate-200">
                            <button type="button" onclick="adjustQty('${prefix}-${p.name}', 1)" class="qty-btn" data-item="${p.name}">+</button>
                        </div>
                    </div>
                </div>`;

            if (dailyList) dailyList.innerHTML += createRow('daily');
            if (standingList) standingProductList.innerHTML += createRow('standing');
        });
        applyStandingToDaily();
    }
}

window.adjustQty = function(id, c) {
    const i = document.getElementById(`qty-${id}`);
    if (i) { i.value = Math.max(0, (parseInt(i.value) || 0) + c); validateChanges(); }
};

window.applyStandingToDaily = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(dateStr + "T00:00:00").getDay()];
    
    document.querySelectorAll('#product-list input[type="number"]').forEach(i => i.value = "0");
    const commentBox = document.getElementById('order-comment');
    if (commentBox) commentBox.value = ""; // Fix for Note staying on other days

    const { data } = await _supabase.from('orders').select('*').eq('venue_id', window.currentUser.venue).eq('delivery_date', dateStr).eq('delivery_slot', slot).maybeSingle();
    currentDBOrder = data;

    if (data) {
        data.items.forEach(item => {
            const inp = document.getElementById(`qty-daily-${item.name}`);
            if (inp) inp.value = item.quantity;
        });
        if (commentBox) commentBox.value = data.comment || "";
    } else {
        const matches = allStandingOrders.filter(s => s.venue_id === window.currentUser.venue && s.days_of_week.includes(targetDay) && s.delivery_slot === slot);
        matches.forEach(s => { const i = document.getElementById(`qty-daily-${s.item_name}`); if (i) i.value = s.quantity; });
    }
};

window.generateConsolidatedReport = async function() {
    // ... logic remains same as last version including forced CK->DSQK->GJ sequence ...
};
