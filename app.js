// --- CONFIG & STATE ---
let _supabase, initialFormState = "", currentDBOrder = null;
let allStandingOrders = [], activeProducts = [], originalKitchenVenue = ""; 

const PRODUCT_ORDER = ["Matcha", "Hojicha", "Strawberry Puree", "Chia Pudding", "Mango Puree", "Vanilla Syrup", "Simple Syrup", "Ice"];
const LEAD_2_DAY_ITEMS = ["Vanilla Syrup", "Simple Syrup", "Yuzu Juice"];

// --- INITIALIZATION ---
window.onload = function() {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const savedUser = localStorage.getItem('kitchen_portal_user');
    if (savedUser) {
        window.currentUser = JSON.parse(savedUser);
        if (window.currentUser.role === 'kitchen') originalKitchenVenue = window.currentUser.venue;
        showDashboard();
    }
};

// --- LOGIN/LOGOUT ---
window.handleLogin = function() {
    const u = document.getElementById('username').value.toLowerCase().trim();
    const p = document.getElementById('password').value.trim();
    const found = USERS.find(x => x.id === u && x.pw === p);
    if (found) {
        window.currentUser = JSON.parse(JSON.stringify(found));
        localStorage.setItem('kitchen_portal_user', JSON.stringify(window.currentUser));
        if (found.role === 'kitchen') originalKitchenVenue = found.venue;
        showDashboard();
    } else { alert("Login failed."); }
};

window.handleLogout = function() {
    if(confirm("Logout?")) {
        localStorage.removeItem('kitchen_portal_user');
        location.reload();
    }
};

function showDashboard() {
    document.getElementById('login-card').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    updateHeader(window.currentUser.venue);
    startApp();
}

// --- UI UPDATES ---
function updateHeader(venueName) {
    document.getElementById('welcome-msg').innerHTML = `<span class="text-blue-600">●</span> ${venueName}`;
}

function updateOverrideIndicator(venueName, isOverride = false) {
    const indicator = document.getElementById('override-status-indicator');
    if (isOverride) {
        indicator.classList.remove('hidden');
        indicator.innerHTML = `
            <div class="bg-red-600 text-white p-4 rounded-2xl flex justify-between items-center shadow-lg mb-4">
                <div class="text-left">
                    <p class="text-[9px] font-black uppercase opacity-80">Override Active</p>
                    <p class="text-lg font-black uppercase leading-none">ACTING FOR: ${venueName}</p>
                </div>
                <button onclick="resetToKitchen()" class="bg-white text-red-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-md">Exit</button>
            </div>`;
    } else {
        indicator.classList.add('hidden');
    }
}

window.switchTab = function(view) {
    document.getElementById('view-daily').classList.toggle('hidden', view !== 'daily');
    document.getElementById('view-standing').classList.toggle('hidden', view !== 'standing');
    document.getElementById('tab-daily').className = view === 'daily' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
    document.getElementById('tab-standing').className = view === 'standing' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
};

// --- CORE LOGIC ---
function startApp() {
    setTomorrowDate();
    populateSuppliers();
    loadStandingOrders();
}

function setTomorrowDate() {
    const tom = new Date(); tom.setDate(tom.getDate() + 1);
    const iso = tom.toISOString().split('T')[0];
    document.getElementById('delivery-date').value = iso;
    document.getElementById('admin-view-date').value = iso;
}

function populateSuppliers() {
    const select = document.getElementById('supplier-select');
    if(select && !select.innerHTML) select.innerHTML = `<option value="CK">CK</option><option value="DSQ">DSQ</option><option value="GJ">GJ</option>`;
    loadProducts();
}

async function loadProducts() {
    const supplier = document.getElementById('supplier-select').value;
    const { data } = await _supabase.from('products').select('*').eq('supplier', supplier);
    if (data) {
        activeProducts = data.sort((a,b) => PRODUCT_ORDER.indexOf(a.name) - PRODUCT_ORDER.indexOf(b.name));
        const list = document.getElementById('product-list');
        list.innerHTML = ""; 
        activeProducts.forEach(p => {
            const allowed = p.restricted_to ? p.restricted_to.split(',').map(v=>v.trim()) : [];
            if (p.restricted_to && !allowed.includes(window.currentUser.venue)) return;
            list.innerHTML += `
                <div class="item-row py-4 border-b">
                    <div class="flex justify-between items-center px-2">
                        <div class="text-left">
                            <p class="font-bold text-slate-800 uppercase text-[13px] leading-tight">${p.name}</p>
                            <button onclick="toggleNote('${p.name}')" class="text-[9px] font-black text-blue-500 uppercase mt-1">📝 Note</button>
                        </div>
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="adjustQty('${p.name}', -1)" class="qty-btn">-</button>
                            <input type="number" id="qty-${p.name}" oninput="validateChanges()" data-name="${p.name}" value="0" class="w-12 h-11 border-2 rounded-xl text-center font-black">
                            <button type="button" onclick="adjustQty('${p.name}', 1)" class="qty-btn">+</button>
                        </div>
                    </div>
                    <input type="text" id="note-${p.name}" oninput="validateChanges()" placeholder="Note..." class="note-input">
                </div>`;
        });
        applyStandingToDaily();
    }
}

window.toggleNote = function(name) {
    const el = document.getElementById(`note-${name}`);
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
};

window.adjustQty = function(itemName, change) {
    const input = document.getElementById(`qty-${itemName}`);
    if (input) {
        let val = parseInt(input.value) || 0;
        val = Math.max(0, val + change);
        input.value = val;
        validateChanges();
    }
};

async function applyStandingToDaily() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(dateStr + "T00:00:00").getDay()];

    document.querySelectorAll('#product-list input[type="number"]').forEach(i => i.value = "0");
    document.querySelectorAll('.note-input').forEach(i => { i.value = ""; i.style.display = 'none'; });

    const { data } = await _supabase.from('orders').select('*').eq('venue_id', window.currentUser.venue).eq('delivery_date', dateStr).eq('delivery_slot', slot).maybeSingle();
    currentDBOrder = data;

    if (data) {
        data.items.forEach(item => {
            const inp = document.getElementById(`qty-${item.name}`);
            if (inp) {
                inp.value = item.quantity;
                if (item.comment) {
                    const note = document.getElementById(`note-${item.name}`);
                    note.value = item.comment; note.style.display = 'block';
                }
            }
        });
        document.getElementById('order-comment').value = data.comment || "";
    } else {
        const matches = allStandingOrders.filter(s => s.venue_id === window.currentUser.venue && s.days_of_week.includes(targetDay) && s.delivery_slot === slot);
        matches.forEach(s => { 
            const inp = document.getElementById(`qty-${s.item_name}`); 
            if (inp) { inp.value = s.quantity; inp.classList.add('auto-filled'); } 
        });
    }
}

window.submitOrder = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const items = [];
    document.querySelectorAll('#product-list .item-row').forEach(row => {
        const inp = row.querySelector('input[type="number"]');
        if(inp) {
            items.push({ 
                name: inp.dataset.name, 
                quantity: parseInt(inp.value) || 0, 
                comment: row.querySelector('.note-input').value 
            });
        }
    });
    const payload = { venue_id: window.currentUser.venue, delivery_date: dateStr, delivery_slot: slot, items: items, comment: document.getElementById('order-comment').value };
    let res = currentDBOrder ? await _supabase.from('orders').update(payload).eq('id', currentDBOrder.id) : await _supabase.from('orders').insert([payload]);
    if (!res.error) { alert("Saved!"); applyStandingToDaily(); }
};

window.validateChanges = function() {
    const btn = document.getElementById('save-btn');
    btn.classList.remove('btn-disabled');
    btn.innerText = window.currentUser.role === 'kitchen' ? "Confirm & Save Final Order" : "Save Changes";
};

// --- REPORTS & OVERRIDE ---
window.generateConsolidatedReport = async function() {
    const dateStr = document.getElementById('admin-view-date').value;
    const res = document.getElementById('consolidated-results');
    res.innerHTML = "LOADING..."; res.classList.remove('hidden');

    try {
        const { data: oneOffs } = await _supabase.from('orders').select('*').eq('delivery_date', dateStr);
        const { data: standings } = await _supabase.from('standing_orders').select('*');
        const venueReport = {};
        ["WYN", "MCC", "WSQ", "DSQ", "GJ"].forEach(v => { venueReport[v] = { "1st Delivery": {items:[], note:""}, "2nd Delivery": {items:[], note:""} }; });

        (oneOffs || []).forEach(o => {
            if(venueReport[o.venue_id]) {
                venueReport[o.venue_id][o.delivery_slot].items = o.items.map(i => ({ name: i.name, qty: i.quantity, note: i.comment || "" }));
                if (o.comment) venueReport[o.venue_id][o.delivery_slot].note = o.comment;
            }
        });

        let html = `<div class="p-2 border-b uppercase text-[10px] font-bold">Loading Plan (${dateStr})</div>`;
        Object.keys(venueReport).sort().forEach(v => {
            html += `<div class="mb-4 p-4 border rounded-xl bg-slate-50 text-left"><b>${v}</b>`;
            ["1st Delivery", "2nd Delivery"].forEach(slot => {
                const items = venueReport[v][slot].items.filter(i => i.qty > 0);
                if(items.length > 0 || venueReport[v][slot].note) {
                    html += `<div class="mt-2 flex justify-between text-[10px] text-blue-600 font-bold uppercase"><span>${slot}</span><button onclick="editVenueOrder('${v}','${dateStr}','${slot}')" class="underline">Adjust</button></div>`;
                    items.forEach(i => html += `<div class="text-xs">${i.name} x${i.qty} ${i.note ? '<span class="text-red-500 italic">('+i.note+')</span>' : ''}</div>`);
                    if(venueReport[v][slot].note) html += `<div class="text-[10px] bg-red-100 p-1 rounded mt-1 font-bold italic">⚠️ ${venueReport[v][slot].note}</div>`;
                }
            });
            html += `</div>`;
        });
        res.innerHTML = html;
    } catch (e) { console.error(e); }
};

window.editVenueOrder = function(venueId, dateStr, slot) {
    window.currentUser.venue = venueId;
    updateOverrideIndicator(venueId, true);
    document.getElementById('delivery-date').value = dateStr;
    document.getElementById('delivery-slot').value = slot;
    window.switchTab('daily');
    loadProducts();
    setTimeout(() => { document.getElementById('override-status-indicator').scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 500);
};

window.resetToKitchen = function() {
    window.currentUser.venue = originalKitchenVenue;
    updateOverrideIndicator(originalKitchenVenue, false);
    updateHeader(originalKitchenVenue);
    startApp();
};

async function loadStandingOrders() {
    const { data } = await _supabase.from('standing_orders').select('*');
    allStandingOrders = data || [];
}
