// --- CONFIGURATION ---
const PRODUCT_ORDER = ["Matcha", "Hojicha", "Strawberry Puree", "Chia Pudding", "Mango Puree", "Vanilla Syrup", "Simple Syrup", "Ice"];
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
    startApp();
}

function updateOverrideIndicator(venueName, isOverride = false) {
    const indicator = document.getElementById('override-status-indicator');
    if (isOverride) {
        indicator.classList.remove('hidden');
        indicator.innerHTML = `
            <div class="bg-red-600 text-white p-4 rounded-2xl flex justify-between items-center shadow-lg border-b-4 border-red-800 mb-4">
                <div class="text-left">
                    <p class="text-[9px] font-black uppercase tracking-widest opacity-80 mb-1">Override Mode Active</p>
                    <p class="text-lg font-black tracking-tighter uppercase leading-none">ACTING FOR: ${venueName}</p>
                </div>
                <button onclick="resetToKitchen()" class="bg-white text-red-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-md">Exit</button>
            </div>`;
    } else {
        indicator.classList.add('hidden');
    }
}

// --- CORE APP LOGIC ---
function startApp() {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    setTomorrowDate();
    window.populateSuppliers();
    loadStandingOrders();
}

function sortItemsByCustomOrder(a, b) {
    const nameA = a.name || a.item_name || "";
    const nameB = b.name || b.item_name || "";
    let idxA = PRODUCT_ORDER.indexOf(nameA);
    let idxB = PRODUCT_ORDER.indexOf(nameB);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
}

function setTomorrowDate() {
    const tom = new Date(); tom.setDate(tom.getDate() + 1);
    const iso = tom.toISOString().split('T')[0];
    document.getElementById('delivery-date').value = iso;
    document.getElementById('admin-view-date').value = iso;
}

window.switchTab = function(view) {
    document.getElementById('view-daily').classList.toggle('hidden', view !== 'daily');
    document.getElementById('view-standing').classList.toggle('hidden', view !== 'standing');
    document.getElementById('tab-daily').className = view === 'daily' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
    document.getElementById('tab-standing').className = view === 'standing' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
};

window.populateSuppliers = function() {
    const select = document.getElementById('supplier-select');
    if(select && !select.innerHTML) select.innerHTML = `<option value="CK">CK</option><option value="DSQ">DSQ</option><option value="GJ">GJ</option>`;
    loadProducts();
};

async function loadProducts() {
    const supplier = document.getElementById('supplier-select').value;
    const { data } = await _supabase.from('products').select('*').eq('supplier', supplier);
    if (data) {
        activeProducts = data.sort(sortItemsByCustomOrder);
        const list = document.getElementById('product-list');
        const drop = document.getElementById('standing-item');
        list.innerHTML = ""; drop.innerHTML = `<option value="">-- ITEM --</option>`;
        
        activeProducts.forEach(p => {
            const allowed = p.restricted_to ? p.restricted_to.split(',').map(v=>v.trim()) : [];
            if (p.restricted_to && !allowed.includes(window.currentUser.venue)) return;
            
            const isLeadItem = LEAD_2_DAY_ITEMS.includes(p.name);
            const leadBadge = isLeadItem ? `<span class="block text-[8px] text-orange-600 font-black mt-0.5 uppercase tracking-tighter">⚠️ 2-Day Lead</span>` : "";

            list.innerHTML += `
                <div class="item-row py-4 border-b">
                    <div class="flex justify-between items-center px-2">
                        <div class="text-left">
                            <p class="font-bold text-slate-800 uppercase text-[13px] leading-tight">${p.name}</p>
                            ${leadBadge}
                            <button onclick="toggleNote('${p.name}')" class="text-[9px] font-black text-blue-500 uppercase mt-1">📝 Note</button>
                        </div>
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="adjustQty('${p.name}', -1)" class="qty-btn" data-item="${p.name}">-</button>
                            <input type="number" id="qty-${p.name}" oninput="validateChanges()" data-name="${p.name}" value="0" inputmode="numeric" pattern="[0-9]*" class="w-12 h-11 bg-white border-2 rounded-xl text-center font-black text-blue-600 outline-none border-slate-200">
                            <button type="button" onclick="adjustQty('${p.name}', 1)" class="qty-btn" data-item="${p.name}">+</button>
                        </div>
                    </div>
                    <input type="text" id="note-${p.name}" oninput="validateChanges()" placeholder="Note for ${p.name}..." class="note-input">
                </div>`;
            drop.innerHTML += `<option value="${p.name}">${p.name}</option>`;
        });
        applyStandingToDaily();
    }
}

window.toggleNote = function(name) {
    const el = document.getElementById(`note-${name}`);
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
};

window.adjustQty = function(itemName, change) {
    if (window.currentUser.role !== 'kitchen' && isItemLocked(itemName)) return;
    const input = document.getElementById(`qty-${itemName}`);
    if (input) {
        let val = parseInt(input.value) || 0;
        val = Math.max(0, val + change);
        input.value = val;
        validateChanges();
    }
};

function isItemLocked(itemName) {
    if (window.currentUser.role === 'kitchen') return false; 
    const dateStr = document.getElementById('delivery-date').value;
    const now = new Date();
    const orderDate = new Date(dateStr + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
    if (orderDate <= today) return true;
    if (LEAD_2_DAY_ITEMS.includes(itemName)) {
        if (orderDate.getTime() === tomorrow.getTime()) return true;
        if (orderDate.getTime() === dayAfter.getTime() && now.getHours() >= 13) return true;
    }
    if (orderDate.getTime() === tomorrow.getTime() && now.getHours() >= 13) return true;
    return false;
}

function checkFormLock() {
    const dateStr = document.getElementById('delivery-date').value;
    const orderDate = new Date(dateStr + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    const now = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    let totalLocked = (orderDate <= today) || (orderDate.getTime() === tomorrow.getTime() && now.getHours() >= 13);
    const btn = document.getElementById('save-btn'), msg = document.getElementById('lock-msg');
    if (totalLocked && window.currentUser.role !== 'kitchen') { 
        btn.classList.add('btn-disabled'); msg.classList.remove('hidden'); 
    } else {
        msg.classList.add('hidden');
    }
    activeProducts.forEach(p => {
        const locked = isItemLocked(p.name);
        const input = document.getElementById(`qty-${p.name}`);
        const btns = document.querySelectorAll(`button[data-item="${p.name}"]`);
        if (input) {
            if (locked) { input.classList.add('locked-qty'); btns.forEach(b => b.classList.add('opacity-30', 'pointer-events-none')); } 
            else { input.classList.remove('locked-qty'); btns.forEach(b => b.classList.remove('opacity-30', 'pointer-events-none')); }
        }
    });
}

window.applyStandingToDaily = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(dateStr + "T00:00:00").getDay()];
    document.querySelectorAll('#product-list input[type="number"]').forEach(i => { i.value = "0"; i.classList.remove('auto-filled'); });
    document.querySelectorAll('.note-input').forEach(i => { i.value = ""; i.style.display = 'none'; });
    document.getElementById('order-comment').value = "";
    
    // VITAL FIX: Use the acting venue for the DB query
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
        matches.forEach(s => { const inp = document.getElementById(`qty-${s.item_name}`); if (inp) { inp.value = s.quantity; inp.classList.add('auto-filled'); } });
    }
    captureState();
    checkFormLock();
};

function captureState() {
    const state = [];
    document.querySelectorAll('#product-list input').forEach(i => state.push(i.value));
    document.querySelectorAll('.note-input').forEach(i => state.push(i.value));
    state.push(document.getElementById('order-comment').value);
    initialFormState = JSON.stringify(state);
    validateChanges();
}

window.validateChanges = function() {
    const state = [];
    document.querySelectorAll('#product-list input').forEach(i => state.push(i.value));
    document.querySelectorAll('.note-input').forEach(i => state.push(i.value));
    state.push(document.getElementById('order-comment').value);
    const currentFormState = JSON.stringify(state);
    const btn = document.getElementById('save-btn');
    btn.innerText = "Save Changes";
    if (currentFormState !== initialFormState) { 
        btn.classList.remove('btn-disabled'); 
        if (window.currentUser.role === 'kitchen') btn.innerText = "Confirm & Save Final Order";
    } else { 
        btn.classList.add('btn-disabled'); 
    }
};

window.submitOrder = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const currentComment = document.getElementById('order-comment').value;
    
    const itemsOnScreen = [];
    document.querySelectorAll('#product-list .item-row').forEach(row => {
        const inp = row.querySelector('input[type="number"]');
        if(inp) {
            itemsOnScreen.push({ 
                name: inp.dataset.name, 
                quantity: parseInt(inp.value) || 0, 
                comment: row.querySelector('.note-input').value 
            });
        }
    });

    let finalItems = [];
    // PRESERVE COMMENT: If the box is empty now, keep the old comment from the DB
    let finalComment = currentComment || (currentDBOrder ? currentDBOrder.comment : "");

    if (currentDBOrder && currentDBOrder.items) {
        const otherSupplierItems = currentDBOrder.items.filter(existingItem => 
            !itemsOnScreen.some(screenItem => screenItem.name === existingItem.name)
        );
        finalItems = [...otherSupplierItems, ...itemsOnScreen];
    } else {
        finalItems = itemsOnScreen;
    }
    
    const payload = { 
        venue_id: window.currentUser.venue, 
        delivery_date: dateStr, 
        delivery_slot: slot, 
        items: finalItems, 
        comment: finalComment 
    };

    let res = currentDBOrder ? 
        await _supabase.from('orders').update(payload).eq('id', currentDBOrder.id) : 
        await _supabase.from('orders').insert([payload]);

    if (!res.error) { 
        alert("Success: Saved merged order for " + window.currentUser.venue); 
        applyStandingToDaily(); 
    }
};

    // 2. Prepare the final item list
    let finalItems = [];

    if (currentDBOrder && currentDBOrder.items) {
        // MERGE LOGIC: Start with all existing items from the database
        // Remove any items that match the supplier currently on screen (we will replace them)
        const otherSupplierItems = currentDBOrder.items.filter(existingItem => 
            !itemsOnScreen.some(screenItem => screenItem.name === existingItem.name)
        );
        
        // Combine the "untouched" items with the "newly adjusted" items
        finalItems = [...otherSupplierItems, ...itemsOnScreen];
    } else {
        // No existing order, just use what's on screen
        finalItems = itemsOnScreen;
    }
    
    const payload = { 
        venue_id: window.currentUser.venue, 
        delivery_date: dateStr, 
        delivery_slot: slot, 
        items: finalItems, 
        comment: document.getElementById('order-comment').value 
    };

    let res;
    if (currentDBOrder) {
        res = await _supabase.from('orders').update(payload).eq('id', currentDBOrder.id);
    } else {
        res = await _supabase.from('orders').insert([payload]);
    }

    if (!res.error) { 
        alert("Success: Quantities updated for " + window.currentUser.venue + " (" + currentSupplier + ")"); 
        applyStandingToDaily(); 
    } else {
        alert("Error saving order: " + res.error.message);
    }
};

// --- CONSOLIDATED REPORT ---
window.generateConsolidatedReport = async function() {
    const dateStr = document.getElementById('admin-view-date').value;
    const targetDateObj = new Date(dateStr + "T00:00:00");
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][targetDateObj.getDay()];
    const nextDateObj = new Date(targetDateObj); nextDateObj.setDate(targetDateObj.getDate() + 1);
    const nextDateStr = nextDateObj.toISOString().split('T')[0];
    const nextDayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][nextDateObj.getDay()];
    const res = document.getElementById('consolidated-results');
    res.innerHTML = "LOADING..."; res.classList.remove('hidden');

    try {
        const { data: oneOffs } = await _supabase.from('orders').select('*').eq('delivery_date', dateStr);
        const { data: upcomingOneOffs } = await _supabase.from('orders').select('*').eq('delivery_date', nextDateStr);
        const { data: standings } = await _supabase.from('standing_orders').select('*');
        const venueReport = {};
        const totalCounts = {};
        const upcomingLeadTotals = {};
        PRODUCT_ORDER.forEach(p => totalCounts[p] = 0);
        LEAD_2_DAY_ITEMS.forEach(p => upcomingLeadTotals[p] = 0);
        ["WYN", "MCC", "WSQ", "DSQ", "GJ"].forEach(v => { venueReport[v] = { "1st Delivery": {items:[], note:""}, "2nd Delivery": {items:[], note:""} }; });

        (standings || []).forEach(s => {
            if(s.days_of_week && s.days_of_week.includes(targetDay)) {
                if(venueReport[s.venue_id]) {
                    venueReport[s.venue_id][s.delivery_slot].items.push({ name: s.item_name, qty: s.quantity });
                    if(totalCounts.hasOwnProperty(s.item_name)) totalCounts[s.item_name] += s.quantity;
                }
            }
            if(s.days_of_week && s.days_of_week.includes(nextDayName) && LEAD_2_DAY_ITEMS.includes(s.item_name)) {
                upcomingLeadTotals[s.item_name] += s.quantity;
            }
        });
        (oneOffs || []).forEach(o => {
            if(venueReport[o.venue_id]) {
                venueReport[o.venue_id][o.delivery_slot].items.forEach(oldItem => { if(totalCounts.hasOwnProperty(oldItem.name)) totalCounts[oldItem.name] -= oldItem.qty; });
                venueReport[o.venue_id][o.delivery_slot].items = o.items.map(i => ({ name: i.name, qty: i.quantity, note: i.comment || "" }));
                if (o.comment) venueReport[o.venue_id][o.delivery_slot].note = o.comment;
                o.items.forEach(i => { if(totalCounts.hasOwnProperty(i.name)) totalCounts[i.name] += i.quantity; });
            }
        });
        (upcomingOneOffs || []).forEach(o => { o.items.forEach(i => { if (LEAD_2_DAY_ITEMS.includes(i.name)) {
            const matchStanding = (standings || []).find(s => s.venue_id === o.venue_id && s.delivery_slot === o.delivery_slot && s.item_name === i.name && s.days_of_week.includes(nextDayName));
            if (matchStanding) upcomingLeadTotals[i.name] -= matchStanding.quantity;
            upcomingLeadTotals[i.name] += i.quantity;
        } }); });

        let html = `<div class="flex justify-between border-b pb-2 mb-4 uppercase text-[10px] font-black text-blue-900"><span>Loading Plan (${dateStr})</span><button onclick="window.print()" class="underline">Print</button></div>`;
        if (window.currentUser.role === 'kitchen') {
            html += `<div class="mb-6 p-4 border-2 border-blue-600 bg-blue-50 rounded-2xl text-left shadow-md">
                        <h3 class="font-black text-blue-900 text-lg border-b border-blue-200 pb-1 mb-3 italic">TOTAL PREP (${dateStr})</h3>
                        <div class="grid grid-cols-1 gap-1 mb-4">`;
            PRODUCT_ORDER.forEach(p => { html += `<div class="flex justify-between py-1 text-sm font-bold border-b border-blue-100"><span>${p}</span><span>x ${totalCounts[p]}</span></div>`; });
            html += `</div><h3 class="font-black text-orange-600 text-lg border-b border-orange-200 pb-1 mb-3 italic">UPCOMING LEAD (${nextDateStr})</h3>
                     <div class="grid grid-cols-1 gap-1">`;
            LEAD_2_DAY_ITEMS.forEach(p => { html += `<div class="flex justify-between py-1 text-sm font-bold border-b border-orange-100"><span>${p}</span><span>x ${upcomingLeadTotals[p]}</span></div>`; });
            html += `</div></div>`;
        }

        Object.keys(venueReport).sort().forEach(v => {
            const vData = venueReport[v];
            if(vData["1st Delivery"].items.length > 0 || vData["2nd Delivery"].items.length > 0 || vData["1st Delivery"].note || vData["2nd Delivery"].note) {
                html += `<div class="mb-6 p-4 border-2 rounded-2xl bg-white text-left border-slate-200 shadow-sm"><h3 class="font-black text-blue-800 text-lg border-b pb-1 mb-3 uppercase italic">${v}</h3>`;
                ["1st Delivery", "2nd Delivery"].forEach(slot => {
                    const activeItems = vData[slot].items.filter(i => i.qty > 0).sort(sortItemsByCustomOrder);
                    if(activeItems.length > 0 || vData[slot].note) {
                        html += `<div class="mb-4"><div class="flex justify-between items-center mb-1 border-l-4 border-blue-400 pl-2"><p class="text-[9px] font-black text-slate-400 italic">${slot}</p>
                                ${window.currentUser.role === 'kitchen' ? `<button onclick="editVenueOrder('${v}', '${dateStr}', '${slot}')" class="text-[9px] font-black text-blue-600 underline uppercase">✏️ Adjust</button>` : ""}</div>`;
                        activeItems.forEach(i => {
                            html += `<div class="flex justify-between py-1 text-sm font-bold border-b border-slate-50"><span>${i.name}</span><span class="text-blue-600">x${i.qty}</span></div>`;
                            if(i.note) html += `<p class="text-[10px] text-red-600 italic mb-1 leading-tight">↳ ${i.note}</p>`;
                        });
                        if(vData[slot].note) html += `<div class="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800 font-bold italic">⚠️ ${vData[slot].note}</div>`;
                        html += `</div>`;
                    }
                });
                html += `</div>`;
            }
        });
        res.innerHTML = html || `<p class="text-center p-10 text-slate-400 font-bold">No orders found.</p>`;
    } catch (e) { console.error(e); }
};

window.editVenueOrder = function(venueId, dateStr, slot) {
    // 1. Force the current acting user to be the venue we want to adjust
    window.currentUser.venue = venueId;
    updateOverrideIndicator(venueId, true);
    
    // 2. Set the form values
    document.getElementById('delivery-date').value = dateStr;
    document.getElementById('delivery-slot').value = slot;
    
    // 3. Switch tabs and load the specific data
    window.switchTab('daily');
    
    // VITAL FIX: Force a fresh product load and apply standing for the NEW venue
    loadProducts(); 
    
    setTimeout(() => {
        document.getElementById('override-status-indicator').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 500);
};

window.resetToKitchen = function() {
    window.currentUser.venue = originalKitchenVenue;
    updateOverrideIndicator(originalKitchenVenue, false);
    setTomorrowDate();
    loadProducts();
};

// --- STANDING ORDERS ---
async function loadStandingOrders() {
    const { data } = await _supabase.from('standing_orders').select('*');
    allStandingOrders = data || [];
    renderStandingList();
    applyStandingToDaily();
}

function renderStandingList() {
    const cont = document.getElementById('standing-items-container'); if(!cont) return;
    cont.innerHTML = "";
    const venueStandings = allStandingOrders.filter(s => s.venue_id === window.currentUser.venue);
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(day => {
        const dayOrders = venueStandings.filter(s => s.days_of_week.includes(day));
        if (dayOrders.length > 0) {
            let dayHtml = `<div class="mb-4 text-left"><h4 class="text-[11px] font-black text-blue-600 uppercase border-b mb-2 pb-1">${day}</h4>`;
            ["1st Delivery", "2nd Delivery"].forEach(slot => {
                const slotOrders = dayOrders.filter(o => o.delivery_slot === slot).sort(sortItemsByCustomOrder);
                if (slotOrders.length > 0) {
                    dayHtml += `<div class="pl-2 border-l-2 mb-2 border-slate-200"><p class="text-[9px] font-bold text-slate-400 uppercase italic mb-1">${slot}</p>`;
                    slotOrders.forEach(s => dayHtml += `<div class="flex justify-between items-center bg-slate-50 p-2 rounded-xl border mb-1"><div><p class="font-bold text-slate-800 text-[12px] uppercase">${s.item_name} x${s.quantity}</p></div><button onclick="deleteStanding(${s.id})" class="text-red-500 font-black text-[9px] uppercase hover:underline">Delete</button></div>`);
                    dayHtml += `</div>`;
                }
            });
            cont.innerHTML += dayHtml + `</div>`;
        }
    });
}

window.toggleDay = function(btn) { btn.classList.toggle('day-active'); };
window.addStandingOrder = async function() {
    const item = document.getElementById('standing-item').value, slot = document.getElementById('standing-slot').value, qtyInput = document.getElementById('standing-qty'), qty = parseInt(qtyInput.value);
    const days = Array.from(document.querySelectorAll('.day-active')).map(b => b.dataset.day);
    if (!item || isNaN(qty) || days.length === 0) return alert("Fill all info.");
    const { error } = await _supabase.from('standing_orders').insert([{ venue_id: window.currentUser.venue, item_name: item, quantity: qty, delivery_slot: slot, days_of_week: days.join(', ') }]);
    if(!error) { alert("Added!"); qtyInput.value = ""; document.querySelectorAll('.day-active').forEach(b => b.classList.remove('day-active')); loadStandingOrders(); }
};
window.deleteStanding = async function(id) { if(confirm("Remove?")) { await _supabase.from('standing_orders').delete().eq('id', id); loadStandingOrders(); } };
