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
    } else {
        alert("Login failed.");
    }
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

window.toggleMaintenance = async function() {
    const confirmPw = prompt("Enter Admin Password:");
    if (confirmPw !== '1019') return alert("Wrong password.");
    
    const { data } = await _supabase.from('app_settings').select('setting_value').eq('setting_key', 'maintenance_mode').single();
    const newStatus = data.setting_value !== 'true';
    await _supabase.from('app_settings').update({ setting_value: newStatus.toString() }).eq('setting_key', 'maintenance_mode');
    location.reload();
};

window.checkMaintPassword = function() {
    if (document.getElementById('maint-pw').value === '1019') document.getElementById('maintenance-overlay').classList.add('hidden');
};

function updateOverrideIndicator(v, isO = false) {
    const ind = document.getElementById('override-status-indicator');
    if (isO) {
        ind.classList.remove('hidden');
        ind.innerHTML = `<div class="bg-red-600 text-white p-4 rounded-2xl flex justify-between items-center mb-4">
            <div class="text-left"><p class="text-[9px] font-black uppercase opacity-80">Override Active</p><p class="text-lg font-black uppercase">Acting For: ${v}</p></div>
            <button onclick="resetToKitchen()" class="bg-white text-red-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase">Exit</button>
        </div>`;
    } else {
        ind.classList.add('hidden');
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
    if (select && !select.innerHTML) select.innerHTML = `<option value="CK">CK</option><option value="DSQK">DSQK</option><option value="GJ">GJ</option>`;
    loadProducts();
};

function sortItemsByCustomOrder(a, b) {
    const nA = a.name || a.item_name || "";
    const nB = b.name || b.item_name || "";
    let iA = PRODUCT_ORDER.indexOf(nA);
    let iB = PRODUCT_ORDER.indexOf(nB);
    return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB);
}

function setTomorrowDate() {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    const iso = tom.toISOString().split('T')[0];
    document.getElementById('delivery-date').value = iso;
    document.getElementById('admin-view-date').value = iso;
}

window.switchTab = function(v) {
    document.getElementById('view-daily').classList.toggle('hidden', v !== 'daily');
    document.getElementById('view-standing').classList.toggle('hidden', v !== 'standing');

    const header = document.querySelector('.bg-white.p-6.rounded-3xl.shadow-sm.mb-6');
    if (header) header.classList.remove('hidden');

    document.getElementById('tab-daily').className = v === 'daily' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white transition-colors' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400 transition-colors';
    document.getElementById('tab-standing').className = v === 'standing' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white transition-colors' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400 transition-colors';

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
            const allowed = p.restricted_to ? p.restricted_to.split(',').map(v => v.trim()) : [];
            const userVenue = window.currentUser.venue;

            // Strict check: User only sees items allowed for their venue.
            let hasAccess = !p.restricted_to || allowed.includes(userVenue);

            if (!hasAccess) return;

            const isLead = LEAD_2_DAY_ITEMS.includes(p.name);
            const badge = isLead ? `<span class="block text-[8px] text-orange-600 font-black mt-0.5 uppercase">⚠️ 2-Day Lead</span>` : "";

            const createRow = (prefix) => `
                <div class="item-row py-4 border-b">
                    <div class="flex justify-between items-center px-2">
                        <div class="text-left">
                            <p class="font-bold text-slate-800 uppercase text-[13px] leading-tight">${p.name}</p>
                            ${badge}
                            <button onclick="toggleNote('${prefix}-${p.name}')" class="text-[9px] font-black text-blue-500 uppercase mt-1">📝 Note</button>
                        </div>
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="adjustQty('${prefix}-${p.name}', -1)" class="qty-btn" data-item="${p.name}">-</button>
                            <input type="number" id="qty-${prefix}-${p.name}" data-name="${p.name}" value="0" class="w-12 h-11 border-2 rounded-xl text-center font-black text-blue-600 outline-none border-slate-200">
                            <button type="button" onclick="adjustQty('${prefix}-${p.name}', 1)" class="qty-btn" data-item="${p.name}">+</button>
                        </div>
                    </div>
                    <input type="text" id="note-${prefix}-${p.name}" oninput="validateChanges()" placeholder="Note for ${p.name}..." class="note-input hidden">
                </div>`;

            if (dailyList) dailyList.innerHTML += createRow('daily');
            if (standingList) standingList.innerHTML += createRow('standing');
        });
        applyStandingToDaily();
    }
}

window.toggleNote = function(id) {
    const el = document.getElementById(`note-${id}`);
    if (el) el.classList.toggle('hidden');
};

// --- MANAGER OVERRIDE LOGIC START ---
window.adjustQty = function(id, change) {
    let itemName = id;
    if (id.startsWith('daily-')) itemName = id.replace('daily-', '');
    if (id.startsWith('standing-')) itemName = id.replace('standing-', '');

    // BYPASS: Managers can always edit (role === 'kitchen')
    // LOCKS: Only apply to Daily orders. Standing orders are never locked by time.
    if (!id.startsWith('standing-')) {
        if (window.currentUser.role !== 'kitchen' && isItemLocked(itemName)) return;
    }

    const input = document.getElementById(`qty-${id}`);
    if (input) {
        let currentVal = parseInt(input.value) || 0;
        input.value = Math.max(0, currentVal + change);
        
        // Only trigger 'Save Changes' button logic for daily view
        if (id.startsWith('daily-')) {
            validateChanges();
        }
    }
};

function isItemLocked(itemName) {
    // BYPASS: Managers never see locks
    if (window.currentUser.role === 'kitchen') return false;

    const product = activeProducts.find(x => x.name === itemName);
    if (product && product.supplier === 'GJ') return false;

    const dateStr = document.getElementById('delivery-date').value;
    const now = new Date();
    const oDate = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (oDate <= today) return true;
    if (LEAD_2_DAY_ITEMS.includes(itemName)) {
        if (oDate.getTime() === tomorrow.getTime()) return true;
        if (oDate.getTime() === new Date(today.setDate(today.getDate() + 2)).getTime() && now.getHours() >= 13) return true;
    }
    if (oDate.getTime() === tomorrow.getTime() && now.getHours() >= 13) return true;
    return false;
}

function checkFormLock() {
    const dateStr = document.getElementById('delivery-date').value;
    const supp = document.getElementById('supplier-select').value;
    const now = new Date();
    const oDate = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    let isPast = (oDate <= today) || (oDate.getTime() === tomorrow.getTime() && now.getHours() >= 13);
    // BYPASS: Lock logic does not apply if role is kitchen
    let locked = isPast && supp !== 'GJ' && window.currentUser.role !== 'kitchen';

    const btn = document.getElementById('save-btn'),
        msg = document.getElementById('lock-msg');

    if (locked) {
        if (btn) btn.classList.add('btn-disabled');
        if (msg) msg.classList.remove('hidden');
    } else {
        if (btn) btn.classList.remove('btn-disabled');
        if (msg) msg.classList.add('hidden');
    }

    activeProducts.forEach(p => {
        const input = document.getElementById(`qty-daily-${p.name}`);
        if (input) {
            // Managers don't see the greyed out boxes
            if (isItemLocked(p.name) && window.currentUser.role !== 'kitchen') input.classList.add('locked-qty');
            else input.classList.remove('locked-qty');
        }
    });
}
// --- MANAGER OVERRIDE LOGIC END ---

window.applyStandingToDaily = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(dateStr + "T00:00:00").getDay()];

    document.querySelectorAll('#product-list input[type="number"]').forEach(i => i.value = "0");
    document.querySelectorAll('.note-input').forEach(i => {
        i.value = "";
        i.classList.add('hidden');
    });

    const commentBox = document.getElementById('order-comment');
    if (commentBox) commentBox.value = "";

    const { data } = await _supabase.from('orders').select('*').eq('venue_id', window.currentUser.venue).eq('delivery_date', dateStr).eq('delivery_slot', slot).maybeSingle();
    currentDBOrder = data;

    if (data) {
        // --- AUTO-CLEAN DUPLICATES ON LOAD (Visual only) ---
        // We use this so that if you 'Adjust', you see clean numbers (No Summing, just overwriting)
        const uniqueMap = new Map();
        data.items.forEach(item => {
             const cleanName = item.name.trim();
             // Overwrite if exists. DO NOT ADD.
             uniqueMap.set(cleanName, { ...item, name: cleanName });
        });
        const cleanItems = Array.from(uniqueMap.values());
        // -------------------------------------

        cleanItems.forEach(item => {
            const inp = document.getElementById(`qty-daily-${item.name}`);
            if (inp) {
                inp.value = item.quantity;
                if (item.comment) {
                    const n = document.getElementById(`note-daily-${item.name}`);
                    n.value = item.comment;
                    n.classList.remove('hidden');
                }
            }
        });
        if (commentBox) commentBox.value = data.comment || "";
    } else {
        const matches = allStandingOrders.filter(s => s.venue_id === window.currentUser.venue && s.days_of_week.includes(targetDay) && s.delivery_slot === slot);
        matches.forEach(s => {
            const inp = document.getElementById(`qty-daily-${s.item_name}`);
            if (inp) inp.value = s.quantity;
        });
    }
    captureState();
    checkFormLock();
};

function captureState() {
    const state = [];
    document.querySelectorAll('#product-list input').forEach(i => state.push(i.value));
    const commentBox = document.getElementById('order-comment');
    if (commentBox) state.push(commentBox.value);
    initialFormState = JSON.stringify(state);
    validateChanges();
}

window.validateChanges = function() {
    const state = [];
    document.querySelectorAll('#product-list input').forEach(i => state.push(i.value));
    const commentBox = document.getElementById('order-comment');
    if (commentBox) state.push(commentBox.value);
    const btn = document.getElementById('save-btn');
    if (!btn) return;

    if (JSON.stringify(state) !== initialFormState) {
        btn.classList.remove('btn-disabled');
        // Change text for managers so they know they are overriding
        btn.innerText = window.currentUser.role === 'kitchen' ? "Confirm & Save Final Order" : "Save Changes";
    } else {
        btn.classList.add('btn-disabled');
    }
};

window.submitOrder = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    
    // 1. Capture inputs. We identify EXACTLY which items are on screen.
    const submittedItemNames = new Set();
    const newItems = [];

    document.querySelectorAll('#product-list .item-row').forEach(row => {
        const inp = row.querySelector('input[type="number"]');
        if (inp) {
            // TRIM whitespace to prevent "Matcha " vs "Matcha"
            const name = inp.dataset.name.trim(); 
            const qty = parseInt(inp.value) || 0;
            const note = row.querySelector('.note-input').value;

            submittedItemNames.add(name); // Track that we have touched this item

            // Only add to save list if quantity > 0
            if (qty > 0) {
                newItems.push({ name: name, quantity: qty, comment: note });
            }
        }
    });

    // 2. Handle Merging: Keep DB items ONLY if they are NOT in the submitted set
    let finalItems = [];

    if (currentDBOrder && currentDBOrder.items) {
        const keptDBItems = currentDBOrder.items.filter(dbItem => {
            // TRIM here too
            const dbName = dbItem.name.trim();
            // If the item name is in 'submittedItemNames', it means we have a new value (or 0) for it, 
            // so we should NOT keep the old one.
            return !submittedItemNames.has(dbName);
        });
        finalItems = [...keptDBItems];
    }

    // 3. Add the new items
    finalItems = [...finalItems, ...newItems];

    // 4. SAFETY NET: Deduplicate by name just in case (Overwrite duplicates, do not sum)
    const uniqueMap = new Map();
    finalItems.forEach(item => {
        // Ensure name is clean
        const n = item.name.trim();
        // If it exists, overwrite it. DO NOT SUM.
        uniqueMap.set(n, { ...item, name: n });
    });
    finalItems = Array.from(uniqueMap.values());

    const payload = {
        venue_id: window.currentUser.venue,
        delivery_date: dateStr,
        delivery_slot: slot,
        items: finalItems,
        comment: document.getElementById('order-comment').value
    };

    if (currentDBOrder) await _supabase.from('orders').update(payload).eq('id', currentDBOrder.id);
    else await _supabase.from('orders').insert([payload]);
    
    alert("Saved!");
    applyStandingToDaily();
};

window.generateConsolidatedReport = async function() {
    const dateStr = document.getElementById('admin-view-date').value;
    const targetDateObj = new Date(dateStr + "T00:00:00");
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][targetDateObj.getDay()];
    const leadDateObj = new Date(targetDateObj);
    leadDateObj.setDate(leadDateObj.getDate() + 2);
    const leadDateStr = leadDateObj.toISOString().split('T')[0];
    const res = document.getElementById('consolidated-results');
    if (!res) return;
    res.innerHTML = "LOADING...";
    res.classList.remove('hidden');

    try {
        const { data: allOrders } = await _supabase.from('orders').select('*').in('delivery_date', [dateStr, leadDateStr]);
        const { data: standings } = await _supabase.from('standing_orders').select('*');
        const { data: products } = await _supabase.from('products').select('name, supplier');
        const suppMap = {};
        products.forEach(p => suppMap[p.name] = (p.supplier === 'DSQ' ? 'DSQK' : p.supplier) || "GENERAL");

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

        (allOrders || []).forEach(o => {
            // --- NEW: DEDUPLICATE THE ORDER ITEMS BEFORE PROCESSING ---
            const uniqueOrderItems = new Map();
            if(o.items && Array.isArray(o.items)){
                o.items.forEach(i => {
                    const clean = i.name.trim();
                    // Overwrite matches. Do not sum.
                    uniqueOrderItems.set(clean, i); 
                });
            }
            const cleanItems = Array.from(uniqueOrderItems.values());
            // ----------------------------------------------------------

            if (o.delivery_date === dateStr && venueReport[o.venue_id]) {
                const sData = venueReport[o.venue_id][o.delivery_slot];
                sData.note = o.comment || "";
                
                cleanItems.forEach(i => {
                    if (i.quantity > 0) {
                        const s = suppMap[i.name] || "GENERAL";
                        sData[s].push({ name: i.name, qty: i.quantity, note: i.comment || "" });
                        if (totalPrep.hasOwnProperty(i.name)) totalPrep[i.name] += i.quantity;
                    }
                });
            }
            if (o.delivery_date === leadDateStr) {
                cleanItems.forEach(i => {
                    if (i.quantity > 0 && LEAD_2_DAY_ITEMS.includes(i.name)) leadPrep[i.name] = (leadPrep[i.name] || 0) + i.quantity;
                });
            }
        });

        standings.forEach(s => {
            if (s.days_of_week.includes(targetDay) && venueReport[s.venue_id]) {
                const sData = venueReport[s.venue_id][s.delivery_slot];
                const hasDaily = (allOrders || []).some(o => o.delivery_date === dateStr && o.venue_id === s.venue_id && o.delivery_slot === s.delivery_slot);
                if (!hasDaily) {
                    const supp = suppMap[s.item_name] || "GENERAL";
                    sData[supp].push({ name: s.item_name, qty: s.quantity });
                    if (totalPrep.hasOwnProperty(s.item_name)) totalPrep[s.item_name] += s.quantity;
                }
            }
        });

        let html = `<div class="flex justify-between border-b-2 border-slate-800 pb-2 mb-4 uppercase text-[12px] font-black text-slate-800"><span>📦 Loading Plan: ${dateStr}</span><button onclick="window.print()" class="text-blue-600 underline">Print</button></div>`;
        html += `<div class="mb-6 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-3xl print:bg-white"><h2 class="text-xs font-black text-emerald-800 uppercase mb-3 italic">Immediate Liquid Prep (Today)</h2><div class="grid grid-cols-3 gap-4">`;
        for (const [n, q] of Object.entries(totalPrep)) html += `<div class="bg-white p-2 rounded-xl text-center border border-emerald-100"><p class="text-[9px] font-bold text-slate-400 uppercase">${n}</p><p class="text-lg font-black text-emerald-600">${q}</p></div>`;
        html += `</div></div>`;

        if (Object.keys(leadPrep).length > 0) {
            html += `<div class="mb-6 p-4 bg-orange-50 border-2 border-orange-200 rounded-3xl print:hidden"><h2 class="text-xs font-black text-orange-800 uppercase mb-2 italic">Advance Prep (For ${leadDateStr})</h2>`;
            for (const [n, q] of Object.entries(leadPrep)) html += `<div class="flex justify-between py-1 border-b border-orange-100 text-xs font-bold uppercase"><span>${n}</span><span>x${q}</span></div>`;
            html += `</div>`;
        }

        Object.keys(venueReport).sort().forEach(v => {
            const vData = venueReport[v];
            if (["1st Delivery", "2nd Delivery"].some(slot => vData[slot].CK.length > 0 || vData[slot].DSQK.length > 0 || vData[slot].GJ.length > 0 || vData[slot].GENERAL.length > 0 || vData[slot].note)) {
                html += `<div class="mb-8 p-5 bg-white border-2 border-slate-200 rounded-3xl shadow-sm print:shadow-none"><h2 class="text-2xl font-black text-blue-900 border-b-4 border-blue-50 pb-1 mb-4 uppercase italic">${v}</h2>`;
                ["1st Delivery", "2nd Delivery"].forEach(sl => {
                    const sD = vData[sl];
                    if (sD.CK.length > 0 || sD.DSQK.length > 0 || sD.GJ.length > 0 || sD.GENERAL.length > 0 || sD.note) {
                        html += `<div class="mb-6 last:mb-0"><div class="flex justify-between items-center text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-1 border-b border-slate-100">
                                            <span>${sl}</span>
                                            ${window.currentUser.role === 'kitchen' ? `<button onclick="editVenueOrder('${v}', '${dateStr}', '${sl}')" class="text-blue-600 underline text-[10px] font-bold">✏️ Adjust</button>` : ""}
                                         </div>`;
                        ["CK", "DSQK", "GJ", "GENERAL"].forEach(sup => {
                            const items = sD[sup];
                            if (items && items.length > 0) {
                                const cClass = sup === 'CK' ? 'text-blue-600' : sup === 'DSQK' ? 'text-orange-600' : 'text-emerald-600';
                                html += `<div class="mb-3 pl-3 border-l-4 border-slate-100"><p class="text-[9px] font-black uppercase mb-1 ${cClass}">From: ${sup}</p>`;
                                items.sort(sortItemsByCustomOrder).forEach(i => {
                                    html += `<div class="flex justify-between items-center py-1 border-b border-slate-50 text-sm font-bold text-slate-700"><div class="flex items-center gap-2"><input type="checkbox" class="w-4 h-4 rounded border-slate-300"><span>${i.name}</span></div><span class="text-blue-900">x${i.qty}</span></div>`;
                                    if (i.note) html += `<p class="text-[10px] text-red-500 italic mb-1 ml-6">↳ ${i.note}</p>`;
                                });
                                html += `</div>`;
                            }
                        });
                        if (sD.note) html += `<div class="mt-2 p-2 bg-yellow-50 border border-yellow-100 rounded-xl text-[11px] text-yellow-800 font-bold italic">Venue Note: ${sD.note}</div>`;
                        html += `</div>`;
                    }
                });
                html += `</div>`;
            }
        });
        res.innerHTML = html;
    } catch (e) {
        console.error(e);
        res.innerHTML = "Error.";
    }
};

window.editVenueOrder = function(venueId, dateStr, slot) {
    window.currentUser.venue = venueId;
    updateOverrideIndicator(venueId, true);
    document.getElementById('delivery-date').value = dateStr;
    document.getElementById('delivery-slot').value = slot;
    window.switchTab('daily');
    loadProducts();
    setTimeout(() => {
        document.getElementById('override-status-indicator')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 500);
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

window.saveStandingSchedule = async function() {
    const slot = document.getElementById('standing-slot').value;
    const days = Array.from(document.querySelectorAll('.day-active')).map(b => b.dataset.day);
    if (days.length === 0) return alert("Select Day.");
    const itemsToSave = [];
    document.querySelectorAll('#standing-product-list input[type="number"]').forEach(input => {
        const qty = parseInt(input.value);
        if (qty > 0) itemsToSave.push({ name: input.dataset.name, qty: qty });
    });
    if (itemsToSave.length === 0) return alert("Enter quantities.");
    const targetVenue = (window.currentUser.role === 'kitchen') ? originalKitchenVenue : window.currentUser.venue;
    const payload = itemsToSave.map(item => ({ venue_id: targetVenue, item_name: item.name, quantity: item.qty, delivery_slot: slot, days_of_week: days.join(', ') }));
    const { error } = await _supabase.from('standing_orders').insert(payload);
    if (!error) {
        alert("Saved!");
        loadStandingOrders();
    } else alert("Error: " + error.message);
};

window.loadExistingStandingValues = function() {
    document.querySelectorAll('[id^="qty-standing-"]').forEach(input => input.value = 0);
    const activeVenue = (window.currentUser.role === 'kitchen') ? originalKitchenVenue : window.currentUser.venue;
    allStandingOrders.filter(s => s.venue_id === activeVenue).forEach(s => {
        const input = document.getElementById(`qty-standing-${s.item_name}`);
        if (input) input.value = s.quantity;
    });
};

function renderStandingList() {
    const cont = document.getElementById('standing-items-container');
    if (!cont) return;
    cont.innerHTML = "";
    const activeVenue = (window.currentUser.role === 'kitchen') ? originalKitchenVenue : window.currentUser.venue;
    const venueStandings = allStandingOrders.filter(s => s.venue_id === activeVenue);
    if (venueStandings.length === 0) {
        cont.innerHTML = `<p class="text-slate-400 font-bold py-10 uppercase text-[10px]">No standing orders for ${activeVenue}</p>`;
        return;
    }
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(day => {
        const dayOrders = venueStandings.filter(s => s.days_of_week.includes(day));
        if (dayOrders.length > 0) {
            let dayHtml = `<div class="mb-4 text-left"><h4 class="text-[11px] font-black text-blue-600 uppercase border-b mb-2 pb-1">${day}</h4>`;
            ["1st Delivery", "2nd Delivery"].forEach(sl => {
                const slOrders = dayOrders.filter(o => o.delivery_slot === sl).sort(sortItemsByCustomOrder);
                if (slOrders.length > 0) {
                    dayHtml += `<div class="pl-2 border-l-2 mb-2 border-slate-200"><p class="text-[9px] font-bold text-slate-400 uppercase italic mb-1">${sl}</p>`;
                    slOrders.forEach(s => {
                        dayHtml += `<div class="flex justify-between items-center bg-slate-50 p-2 rounded-xl border mb-1"><div><p class="font-bold text-slate-800 text-[12px] uppercase">${s.item_name} x${s.quantity}</p></div><button onclick="deleteStanding(${s.id})" class="text-red-500 font-black text-[9px] uppercase hover:underline p-2">Delete</button></div>`;
                    });
                    dayHtml += `</div>`;
                }
            });
            cont.innerHTML += dayHtml + `</div>`;
        }
    });
}

window.deleteStanding = async function(id) {
    if (confirm("Remove?")) {
        await _supabase.from('standing_orders').delete().eq('id', id);
        loadStandingOrders();
    }
};

window.toggleDay = function(b) {
    b.classList.toggle('day-active');
};

window.exportOrdersToCSV = async function() {
    const { data } = await _supabase.from('orders').select('*').order('delivery_date', { ascending: false });
    let csv = "Date,Slot,Venue,Item,Qty,ItemNote,GeneralNote\n";
    (data || []).forEach(o => {
        o.items.forEach(i => {
            csv += `${o.delivery_date},${o.delivery_slot},${o.venue_id},${i.name},${i.quantity},${(i.comment||"").replace(/,/g," ")},${(o.comment||"").replace(/,/g," ")}\n`;
        });
    });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Backup_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
};
