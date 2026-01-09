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
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
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
    const supplierSelect = document.getElementById('supplier-select');
    if (!supplierSelect) return;
    const supplier = supplierSelect.value;
    const { data } = await _supabase.from('products').select('*').eq('supplier', supplier);
    if (data) {
        activeProducts = data.sort(sortItemsByCustomOrder);
        const list = document.getElementById('product-list');
        const drop = document.getElementById('standing-item');
        if (list) list.innerHTML = ""; 
        if (drop) drop.innerHTML = `<option value="">-- ITEM --</option>`;
        
        activeProducts.forEach(p => {
            const allowed = p.restricted_to ? p.restricted_to.split(',').map(v=>v.trim()) : [];
            if (p.restricted_to && !allowed.includes(window.currentUser.venue)) return;
            
            const isLeadItem = LEAD_2_DAY_ITEMS.includes(p.name);
            const leadBadge = isLeadItem ? `<span class="block text-[8px] text-orange-600 font-black mt-0.5 uppercase tracking-tighter">⚠️ 2-Day Lead</span>` : "";

            if (list) {
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
            }
            if (drop) drop.innerHTML += `<option value="${p.name}">${p.name}</option>`;
        });
        applyStandingToDaily();
    }
}

window.toggleNote = function(name) {
    const el = document.getElementById(`note-${name}`);
    if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
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
    
    // NEW: Find the product to check its supplier
    const product = activeProducts.find(p => p.name === itemName);
    if (product && product.supplier === 'GJ') {
        return false; // GJ items are NEVER locked by time
    }

    const dateStr = document.getElementById('delivery-date').value;
    const now = new Date();
    const orderDate = new Date(dateStr + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);

    // Standard locking logic for non-GJ items
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
        if (btn) btn.classList.add('btn-disabled'); 
        if (msg) msg.classList.remove('hidden'); 
    } else {
        if (msg) msg.classList.add('hidden');
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
    const commentBox = document.getElementById('order-comment');
    if (commentBox) commentBox.value = "";
    
    const { data } = await _supabase.from('orders').select('*').eq('venue_id', window.currentUser.venue).eq('delivery_date', dateStr).eq('delivery_slot', slot).maybeSingle();
    currentDBOrder = data;
    
    if (data) {
        data.items.forEach(item => {
            const inp = document.getElementById(`qty-${item.name}`);
            if (inp) {
                inp.value = item.quantity;
                if (item.comment) { 
                    const note = document.getElementById(`note-${item.name}`); 
                    if (note) { note.value = item.comment; note.style.display = 'block'; }
                }
            }
        });
        if (commentBox) commentBox.value = data.comment || "";
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
    const commentBox = document.getElementById('order-comment');
    if (commentBox) state.push(commentBox.value);
    initialFormState = JSON.stringify(state);
    validateChanges();
}

window.validateChanges = function() {
    const state = [];
    document.querySelectorAll('#product-list input').forEach(i => state.push(i.value));
    document.querySelectorAll('.note-input').forEach(i => state.push(i.value));
    const commentBox = document.getElementById('order-comment');
    if (commentBox) state.push(commentBox.value);
    const currentFormState = JSON.stringify(state);
    const btn = document.getElementById('save-btn');
    if (!btn) return;
    btn.innerText = "Save Changes";
    if (currentFormState !== initialFormState) { 
        btn.classList.remove('btn-disabled'); 
        if (window.currentUser.role === 'kitchen') btn.innerText = "Confirm & Save Final Order";
    } else { 
        btn.classList.add('btn-disabled'); 
    }
};

// --- SAFE MERGE SUBMIT LOGIC ---
window.submitOrder = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const currentComment = document.getElementById('order-comment').value;
    
    // 1. Grab items currently visible on screen
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

    // 2. Determine final item list & comment
    let finalItems = [];
    let finalComment = currentComment || (currentDBOrder ? currentDBOrder.comment : "");

    if (currentDBOrder && currentDBOrder.items) {
        // Filter out existing DB items that match items we currently have on screen
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
        alert("Success: Quantities updated for " + window.currentUser.venue); 
        applyStandingToDaily(); 
    } else {
        alert("Error saving: " + res.error.message);
    }
};

// --- CONSOLIDATED REPORT ---
window.generateConsolidatedReport = async function() {
    const dateStr = document.getElementById('admin-view-date').value;
    const targetDateObj = new Date(dateStr + "T00:00:00");
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][targetDateObj.getDay()];
    const res = document.getElementById('consolidated-results');
    
    if (!res) return;
    res.innerHTML = "LOADING..."; res.classList.remove('hidden');

    try {
        const { data: oneOffs } = await _supabase.from('orders').select('*').eq('delivery_date', dateStr);
        const { data: standings } = await _supabase.from('standing_orders').select('*');
        const { data: products } = await _supabase.from('products').select('name, supplier');
        
        // 1. Map suppliers exactly as they are in Supabase
        const supplierMap = {};
        products.forEach(p => {
            supplierMap[p.name] = p.supplier ? p.supplier.toUpperCase() : "GENERAL";
        });

        const venueReport = {};
        const venues = ["WYN", "MCC", "WSQ", "DSQ", "GJ"];
        
        venues.forEach(v => {
            venueReport[v] = {
                "1st Delivery": { CK: [], DSQK: [], GJ: [], note: "" },
                "2nd Delivery": { CK: [], DSQK: [], GJ: [], note: "" }
            };
        });

        // 2. Process Standing Orders
        (standings || []).forEach(s => {
            if(s.days_of_week && s.days_of_week.includes(targetDay)) {
                let supp = supplierMap[s.item_name];
                if(venueReport[s.venue_id] && venueReport[s.venue_id][s.delivery_slot][supp]) {
                    venueReport[s.venue_id][s.delivery_slot][supp].push({ name: s.item_name, qty: s.quantity });
                }
            }
        });

        // 3. Process Manual Overrides
        (oneOffs || []).forEach(o => {
            if(venueReport[o.venue_id]) {
                venueReport[o.venue_id][o.delivery_slot] = { CK: [], DSQK: [], GJ: [], note: o.comment || "" };
                o.items.forEach(i => {
                    if (i.quantity > 0) {
                        let supp = supplierMap[i.name];
                        if (venueReport[o.venue_id][o.delivery_slot][supp]) {
                            venueReport[o.venue_id][o.delivery_slot][supp].push({ name: i.name, qty: i.quantity, note: i.comment || "" });
                        }
                    }
                });
            }
        });

        // 4. HTML Generation (Simplified)
        let html = `<div class="flex justify-between border-b-2 border-slate-800 pb-2 mb-4 uppercase text-[12px] font-black text-slate-800">
                <span>📦 Loading Plan: ${dateStr}</span>
                <button onclick="window.print()" class="text-blue-600 underline">Print</button>
            </div>`;

        venues.sort().forEach(v => {
            const vData = venueReport[v];
            const hasData = ["1st Delivery", "2nd Delivery"].some(slot => 
                vData[slot].CK.length > 0 || vData[slot].DSQK.length > 0 || vData[slot].GJ.length > 0 || vData[slot].note
            );

            if (hasData) {
                html += `<div class="mb-8 p-4 border-2 rounded-3xl bg-white shadow-sm border-slate-200">
                    <h2 class="text-2xl font-black text-blue-900 border-b-4 border-blue-100 pb-1 mb-4 uppercase italic">${v}</h2>`;

                ["1st Delivery", "2nd Delivery"].forEach(slot => {
                    const slotData = vData[slot];
                    if (slotData.CK.length > 0 || slotData.DSQK.length > 0 || slotData.GJ.length > 0 || slotData.note) {
                        html += `<div class="mb-6 last:mb-0">
                            <p class="text-[11px] font-black text-slate-400 uppercase mb-3 bg-slate-100 px-3 py-1 rounded-full inline-block">${slot}</p>`;

                        ["CK", "DSQK", "GJ"].forEach(supplier => {
                            const items = slotData[supplier].sort(sortItemsByCustomOrder);
                            if (items.length > 0) {
                                html += `<div class="mb-3 pl-2 border-l-4 ${supplier === 'CK' ? 'border-blue-500' : supplier === 'DSQK' ? 'border-orange-500' : 'border-green-500'}">
                                    <p class="text-[10px] font-black text-slate-400 uppercase">From: ${supplier}</p>`;
                                items.forEach(i => {
                                    html += `<div class="flex justify-between py-1 border-b border-slate-50 text-sm">
                                        <span class="font-bold text-slate-700">${i.name}</span>
                                        <span class="font-black text-blue-600">x${i.qty}</span>
                                    </div>`;
                                });
                                html += `</div>`;
                            }
                        });
                        if (slotData.note) html += `<div class="mt-2 p-2 bg-yellow-50 border-2 border-yellow-200 rounded-xl text-[11px] font-bold italic">⚠️ ${slotData.note}</div>`;
                        html += `</div>`;
                    }
                });
                html += `</div>`;
            }
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
    setTimeout(() => {
        const target = document.getElementById('override-status-indicator');
        if(target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    const cont = document.getElementById('standing-items-container'); 
    if(!cont) return;
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
