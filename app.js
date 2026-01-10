// --- CONFIGURATION ---
const PRODUCT_ORDER = ["Matcha", "Hojicha", "Strawberry Puree", "Chia Pudding", "Mango Puree", "Vanilla Syrup", "Simple Syrup", "Toastie-Beef", "Toastie-Ham&Cheese", "Toastie-Curry", "Ice"];
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
        checkMaintenanceMode(); // Check status on load
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
    if (exportLink && window.currentUser.role === 'kitchen') {
        exportLink.classList.remove('hidden');
    }
    startApp();
}

// --- MAINTENANCE MODE LOGIC ---
async function checkMaintenanceMode() {
    const { data } = await _supabase.from('app_settings').select('setting_value').eq('setting_key', 'maintenance_mode').single();
    const isMaint = data && data.setting_value === 'true';

    // Show/Hide the control button only for ckmanager
    const maintBtn = document.getElementById('maint-toggle-btn');
    if (maintBtn && window.currentUser.id === 'ckmanager') {
        maintBtn.classList.remove('hidden');
        maintBtn.innerText = isMaint ? "⚠️ Disable Maintenance Mode" : "🛠️ Enable Maintenance Mode";
    }

    // Show overlay if active and user is NOT ckmanager
    if (isMaint && window.currentUser.id !== 'ckmanager') {
        document.getElementById('maintenance-overlay').classList.remove('hidden');
    }
}

window.toggleMaintenance = async function() {
    const confirmPw = prompt("Enter Admin Password to toggle Maintenance Mode:");
    if (confirmPw !== '1019') {
        alert("Incorrect password. Action cancelled.");
        return;
    }

    const { data: currentData } = await _supabase.from('app_settings').select('setting_value').eq('setting_key', 'maintenance_mode').single();
    const currentStatus = currentData.setting_value === 'true';
    const newStatus = !currentStatus;

    const { error } = await _supabase
        .from('app_settings')
        .update({ setting_value: newStatus.toString() })
        .eq('setting_key', 'maintenance_mode');

    if (!error) {
        alert("Maintenance Mode: " + (newStatus ? "ENABLED" : "DISABLED"));
        location.reload();
    } else {
        alert("Error updating status: " + error.message);
    }
};

window.checkMaintPassword = function() {
    const pw = document.getElementById('maint-pw').value;
    if (pw === '1019') {
        document.getElementById('maintenance-overlay').classList.add('hidden');
    } else {
        alert("Incorrect Access Code.");
    }
};

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

window.populateSuppliers = function() {
    const select = document.getElementById('supplier-select');
    if(select && !select.innerHTML) {
        select.innerHTML = `
            <option value="CK">CK</option>
            <option value="DSQK">DSQK</option> 
            <option value="GJ">GJ</option>
        `;
    }
    loadProducts();
};

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
            const userVenue = window.currentUser.venue;

            if (p.restricted_to) {
                let hasAccess = allowed.includes(userVenue);
                if ((userVenue === 'DSQ' || userVenue === 'DSQK') && 
                    (allowed.includes('DSQ') || allowed.includes('DSQK'))) {
                    hasAccess = true;
                }
                if (!hasAccess) return;
            }

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
    const product = activeProducts.find(p => p.name === itemName);
    if (product && product.supplier === 'GJ') return false; 

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
    const currentSupplier = document.getElementById('supplier-select').value;
    const now = new Date();
    const orderDate = new Date(dateStr + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    
    let isPastCutoff = (orderDate <= today) || (orderDate.getTime() === tomorrow.getTime() && now.getHours() >= 13);
    let totalLocked = isPastCutoff && currentSupplier !== 'GJ';

    const btn = document.getElementById('save-btn'), msg = document.getElementById('lock-msg');
    if (totalLocked && window.currentUser.role !== 'kitchen') { 
        if (btn) btn.classList.add('btn-disabled'); 
        if (msg) msg.classList.remove('hidden'); 
    } else {
        if (btn) btn.classList.remove('btn-disabled'); 
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

window.submitOrder = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const currentComment = document.getElementById('order-comment').value;
    const itemsOnScreen = [];
    document.querySelectorAll('#product-list .item-row').forEach(row => {
        const inp = row.querySelector('input[type="number"]');
        if(inp) {
            itemsOnScreen.push({ name: inp.dataset.name, quantity: parseInt(inp.value) || 0, comment: row.querySelector('.note-input').value });
        }
    });

    let finalItems = [];
    let finalComment = currentComment || (currentDBOrder ? currentDBOrder.comment : "");
    if (currentDBOrder && currentDBOrder.items) {
        const otherSupplierItems = currentDBOrder.items.filter(existingItem => !itemsOnScreen.some(screenItem => screenItem.name === existingItem.name));
        finalItems = [...otherSupplierItems, ...itemsOnScreen];
    } else { finalItems = itemsOnScreen; }
    
    const payload = { venue_id: window.currentUser.venue, delivery_date: dateStr, delivery_slot: slot, items: finalItems, comment: finalComment };
    let res = currentDBOrder ? await _supabase.from('orders').update(payload).eq('id', currentDBOrder.id) : await _supabase.from('orders').insert([payload]);

    if (!res.error) { 
        alert("Success: Quantities updated for " + window.currentUser.venue); 
        applyStandingToDaily(); 
    } else { alert("Error saving: " + res.error.message); }
};

window.generateConsolidatedReport = async function() {
    const dateStr = document.getElementById('admin-view-date').value;
    const targetDateObj = new Date(dateStr + "T00:00:00");
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][targetDateObj.getDay()];
    
    // Calculate date for Advance Prep (Today + 2 Days)
    const leadDateObj = new Date(targetDateObj);
    leadDateObj.setDate(leadDateObj.getDate() + 1); 
    const leadDateStr = leadDateObj.toISOString().split('T')[0];
    const leadDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][leadDateObj.getDay()];

    const res = document.getElementById('consolidated-results');
    if (!res) return;
    res.innerHTML = "LOADING..."; res.classList.remove('hidden');

    try {
        const { data: allOrders } = await _supabase.from('orders').select('*').in('delivery_date', [dateStr, leadDateStr]);
        const { data: standings } = await _supabase.from('standing_orders').select('*');
        const { data: products } = await _supabase.from('products').select('name, supplier');
        
        const supplierMap = {};
        products.forEach(p => { supplierMap[p.name] = p.supplier ? p.supplier.toUpperCase() : "GENERAL"; });

        const venueReport = {};
        const totalPrep = { "Matcha": 0, "Hojicha": 0, "Strawberry Puree": 0 };
        const leadPrep = {}; 
        const venues = ["WYN", "MCC", "WSQ", "DSQ", "GJ", "DSQK", "CK"];
        
        venues.forEach(v => {
            venueReport[v] = { 
                "1st Delivery": { CK: [], DSQK: [], GJ: [], GENERAL: [], note: "" }, 
                "2nd Delivery": { CK: [], DSQK: [], GJ: [], GENERAL: [], note: "" } 
            };
        });

        // 1. PROCESS STANDING ORDERS
        (standings || []).forEach(s => {
            if(s.days_of_week.includes(targetDay) && venueReport[s.venue_id]) {
                const supp = supplierMap[s.item_name] || "GENERAL";
                venueReport[s.venue_id][s.delivery_slot][supp].push({ name: s.item_name, qty: s.quantity });
                if(totalPrep.hasOwnProperty(s.item_name)) totalPrep[s.item_name] += s.quantity;
            }
            if(s.days_of_week.includes(leadDay) && LEAD_2_DAY_ITEMS.includes(s.item_name)) {
                leadPrep[s.item_name] = (leadPrep[s.item_name] || 0) + s.quantity;
            }
        });

        // 2. PROCESS ONE-OFF ORDERS
        (allOrders || []).forEach(o => {
            const isTarget = o.delivery_date === dateStr;
            const isLead = o.delivery_date === leadDateStr;

            if(isTarget && venueReport[o.venue_id]) {
                venueReport[o.venue_id][o.delivery_slot].note = o.comment || "";
                // Reset slot items for this venue/slot if a one-off exists (Standard app logic)
                const slotData = venueReport[o.venue_id][o.delivery_slot];
                slotData.CK = []; slotData.DSQK = []; slotData.GJ = []; slotData.GENERAL = [];
                
                o.items.forEach(i => {
                    if (i.quantity > 0) {
                        const supp = supplierMap[i.name] || "GENERAL";
                        slotData[supp].push({ name: i.name, qty: i.quantity, note: i.comment || "" });
                        if(totalPrep.hasOwnProperty(i.name)) totalPrep[i.name] += i.quantity;
                    }
                });
            }

            if(isLead && o.items) {
                o.items.forEach(i => {
                    if (i.quantity > 0 && LEAD_2_DAY_ITEMS.includes(i.name)) {
                        leadPrep[i.name] = (leadPrep[i.name] || 0) + i.quantity;
                    }
                });
            }
        });

        // BUILD HTML
        let html = `<div class="flex justify-between border-b-2 border-slate-800 pb-2 mb-4 uppercase text-[12px] font-black"><span>📦 Loading Plan: ${dateStr}</span><button onclick="window.print()" class="text-blue-600 underline">Print</button></div>`;

        // LIQUID PREP SECTION
        html += `<div class="mb-6 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-3xl"><h2 class="text-xs font-black text-emerald-800 uppercase mb-3 italic">Immediate Liquid Prep</h2><div class="grid grid-cols-3 gap-4">`;
        for (const [name, qty] of Object.entries(totalPrep)) {
            html += `<div class="bg-white p-2 rounded-xl text-center border border-emerald-100"><p class="text-[9px] font-bold text-slate-400 uppercase">${name}</p><p class="text-lg font-black text-emerald-600">${qty}</p></div>`;
        }
        html += `</div></div>`;

        // ADVANCE PREP SECTION
        if (Object.keys(leadPrep).length > 0) {
            html += `<div class="mb-6 p-4 bg-orange-50 border-2 border-orange-200 rounded-3xl"><h2 class="text-xs font-black text-orange-800 uppercase mb-2 italic">Advance Prep (For ${leadDateStr})</h2>`;
            for (const [name, qty] of Object.entries(leadPrep)) {
                html += `<div class="flex justify-between py-1 border-b border-orange-100 text-xs font-bold uppercase"><span>${name}</span><span>x${qty}</span></div>`;
            }
            html += `</div>`;
        }

        // VENUE BREAKDOWN
        Object.keys(venueReport).sort().forEach(v => {
            const vData = venueReport[v];
            const hasOrder = ["1st Delivery", "2nd Delivery"].some(slot => {
                const s = vData[slot];
                return s.CK.length > 0 || s.DSQK.length > 0 || s.GJ.length > 0 || s.GENERAL.length > 0 || s.note;
            });

            if (hasOrder) {
                html += `<div class="mb-8 p-5 bg-white border-2 border-slate-200 rounded-3xl shadow-sm">
                            <h2 class="text-2xl font-black text-blue-900 border-b-4 border-blue-50 pb-1 mb-4 uppercase italic">${v}</h2>`;

                ["1st Delivery", "2nd Delivery"].forEach(slot => {
                    const slotData = vData[slot];
                    const hasItems = slotData.CK.length > 0 || slotData.DSQK.length > 0 || slotData.GJ.length > 0 || slotData.GENERAL.length > 0;
                    
                    if (hasItems || slotData.note) {
                        html += `<div class="mb-6 last:mb-0">
                                    <div class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-1 border-b border-slate-100">${slot}</div>`;

                        // Strict Supplier Order: CK -> DSQK -> GJ
                        ["CK", "DSQK", "GJ", "GENERAL"].forEach(supplier => {
                            const items = slotData[supplier];
                            if (items && items.length > 0) {
                                const colorClass = supplier === 'CK' ? 'text-blue-600' : supplier === 'DSQK' ? 'text-orange-600' : 'text-emerald-600';
                                html += `<div class="mb-3 pl-3 border-l-4 border-slate-100">
                                            <p class="text-[9px] font-black uppercase mb-1 ${colorClass}">Supplier: ${supplier}</p>`;
                                items.forEach(i => {
                                    html += `<div class="flex justify-between py-0.5 text-sm font-bold text-slate-700"><span>${i.name}</span><span class="text-blue-900">x${i.qty}</span></div>`;
                                    if(i.note) html += `<p class="text-[10px] text-red-500 italic mb-1">↳ ${i.note}</p>`;
                                });
                                html += `</div>`;
                            }
                        });

                        if (slotData.note) {
                            html += `<div class="mt-2 p-2 bg-yellow-50 rounded-xl text-[10px] text-yellow-800 font-bold border border-yellow-100 italic">Note: ${slotData.note}</div>`;
                        }
                        html += `</div>`;
                    }
                });
                html += `</div>`;
            }
        });
        res.innerHTML = html;
    } catch (e) { console.error(e); res.innerHTML = "Error generating report."; }
};

window.editVenueOrder = function(venueId, dateStr, slot) {
    window.currentUser.venue = venueId;
    updateOverrideIndicator(venueId, true);
    document.getElementById('delivery-date').value = dateStr;
    document.getElementById('delivery-slot').value = slot;
    window.switchTab('daily');
    loadProducts(); 
    setTimeout(() => { document.getElementById('override-status-indicator')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 500);
};

window.resetToKitchen = function() {
    window.currentUser.venue = originalKitchenVenue;
    updateOverrideIndicator(originalKitchenVenue, false);
    document.getElementById('welcome-msg').innerText = originalKitchenVenue;
    setTomorrowDate();
    loadProducts();
    renderStandingList();
};

async function loadStandingOrders() {
    const { data } = await _supabase.from('standing_orders').select('*');
    allStandingOrders = data || [];
    renderStandingList();
}

function renderStandingList() {
    const cont = document.getElementById('standing-items-container'); 
    const inputArea = document.querySelector('#view-standing .bg-blue-900'); 
    if(!cont) return;
    
    const isOverriding = (window.currentUser.role === 'kitchen' && window.currentUser.venue !== originalKitchenVenue);
    if (inputArea) isOverriding ? inputArea.classList.add('hidden') : inputArea.classList.remove('hidden');

    cont.innerHTML = "";
    const activeVenue = (window.currentUser.role === 'kitchen') ? originalKitchenVenue : window.currentUser.venue;
    const venueStandings = allStandingOrders.filter(s => s.venue_id === activeVenue);
    
    if (venueStandings.length === 0) {
        cont.innerHTML = `<p class="text-slate-400 font-bold py-10 uppercase text-[10px]">No standing orders for ${activeVenue}</p>`;
        if (isOverriding) cont.innerHTML = `<div class="bg-slate-100 p-4 rounded-2xl mb-4 text-[10px] font-bold text-slate-500 uppercase italic text-center">ℹ️ Standing editing disabled while adjusting others.</div>` + cont.innerHTML;
        return;
    }

    if (isOverriding) cont.innerHTML = `<div class="bg-slate-100 p-4 rounded-2xl mb-4 text-[10px] font-bold text-slate-500 uppercase italic text-center">ℹ️ Standing editing disabled while adjusting others.</div>`;

    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(day => {
        const dayOrders = venueStandings.filter(s => s.days_of_week.includes(day));
        if (dayOrders.length > 0) {
            let dayHtml = `<div class="mb-4 text-left"><h4 class="text-[11px] font-black text-blue-600 uppercase border-b mb-2 pb-1">${day}</h4>`;
            ["1st Delivery", "2nd Delivery"].forEach(slot => {
                const slotOrders = dayOrders.filter(o => o.delivery_slot === slot).sort(sortItemsByCustomOrder);
                if (slotOrders.length > 0) {
                    dayHtml += `<div class="pl-2 border-l-2 mb-2 border-slate-200"><p class="text-[9px] font-bold text-slate-400 uppercase italic mb-1">${slot}</p>`;
                    slotOrders.forEach(s => {
                        dayHtml += `<div class="flex justify-between items-center bg-slate-50 p-2 rounded-xl border mb-1"><div><p class="font-bold text-slate-800 text-[12px] uppercase">${s.item_name} x${s.quantity}</p></div><button onclick="deleteStanding(${s.id})" class="text-red-500 font-black text-[9px] uppercase hover:underline p-2 ${isOverriding ? 'hidden' : ''}">Delete</button></div>`;
                    });
                    dayHtml += `</div>`;
                }
            });
            cont.innerHTML += dayHtml + `</div>`;
        }
    });
}

window.addStandingOrder = async function() {
    const item = document.getElementById('standing-item').value;
    const slot = document.getElementById('standing-slot').value;
    const qtyInput = document.getElementById('standing-qty');
    const qty = parseInt(qtyInput.value);
    const days = Array.from(document.querySelectorAll('.day-active')).map(b => b.dataset.day);
    if (!item || isNaN(qty) || days.length === 0) return alert("Fill all info.");
    
    const targetVenue = (window.currentUser.role === 'kitchen') ? originalKitchenVenue : window.currentUser.venue;
    const { error } = await _supabase.from('standing_orders').insert([{ venue_id: targetVenue, item_name: item, quantity: qty, delivery_slot: slot, days_of_week: days.join(', ') }]);
    if(!error) { alert("Standing Order Saved!"); qtyInput.value = ""; document.querySelectorAll('.day-active').forEach(b => b.classList.remove('day-active')); loadStandingOrders(); }
};

window.deleteStanding = async function(id) {
    if(confirm("Permanently remove this standing order?")) {
        const { error } = await _supabase.from('standing_orders').delete().eq('id', id);
        if(!error) loadStandingOrders();
    }
};

window.toggleDay = function(btn) { btn.classList.toggle('day-active'); };

window.exportOrdersToCSV = async function() {
    if(!confirm("Download all order history as CSV?")) return;
    const { data, error } = await _supabase.from('orders').select('delivery_date, delivery_slot, venue_id, items, comment').order('delivery_date', { ascending: false });
    if (error) { alert("Export failed: " + error.message); return; }

    let csvContent = "Date,Slot,Venue,Item,Qty,ItemNote,GeneralNote\n";
    data.forEach(order => {
        order.items.forEach(item => {
            const cleanItemNote = (item.comment || "").replace(/,/g, " ");
            const cleanGeneralNote = (order.comment || "").replace(/,/g, " ");
            csvContent += `${order.delivery_date},${order.delivery_slot},${order.venue_id},${item.name},${item.quantity},${cleanItemNote},${cleanGeneralNote}\n`;
        });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Kitchen_Orders_Backup_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
