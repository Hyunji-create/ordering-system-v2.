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
    if (exportLink && window.currentUser.role === 'kitchen') {
        exportLink.classList.remove('hidden');
    }
    startApp();
}

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
    const { data: currentData } = await _supabase.from('app_settings').select('setting_value').eq('setting_key', 'maintenance_mode').single();
    const newStatus = currentData.setting_value !== 'true';
    await _supabase.from('app_settings').update({ setting_value: newStatus.toString() }).eq('setting_key', 'maintenance_mode');
    location.reload();
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

function sortItemsByCustomOrder(a, b) {
    const nameA = a.name || a.item_name || "";
    const nameB = b.name || b.item_name || "";
    let idxA = PRODUCT_ORDER.indexOf(nameA);
    let idxB = PRODUCT_ORDER.indexOf(nameB);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : iB);
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
    
    // UI Fix: Ensure header with supplier select is always visible
    const header = document.querySelector('.bg-white.p-6.rounded-3xl.shadow-sm.mb-6');
    if (header) header.classList.remove('hidden');

    document.getElementById('tab-daily').className = view === 'daily' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
    document.getElementById('tab-standing').className = view === 'standing' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
    
    if (view === 'standing') loadExistingStandingValues();
};

window.populateSuppliers = function() {
    const select = document.getElementById('supplier-select');
    if(select && !select.innerHTML) select.innerHTML = `<option value="CK">CK</option><option value="DSQK">DSQK</option><option value="GJ">GJ</option>`;
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
        const standingList = document.getElementById('standing-product-list');
        if (list) list.innerHTML = ""; 
        if (standingList) standingList.innerHTML = ""; 
        
        activeProducts.forEach(p => {
            const allowed = p.restricted_to ? p.restricted_to.split(',').map(v=>v.trim()) : [];
            const userVenue = window.currentUser.venue;
            const userRole = window.currentUser.role;

            let hasAccess = (userRole === 'kitchen');
            if (!hasAccess) {
                hasAccess = !p.restricted_to || allowed.includes(userVenue);
                if (!hasAccess && userVenue.startsWith('DSQ') && allowed.some(a => a.startsWith('DSQ'))) hasAccess = true;
            }
            if (!hasAccess) return;
            
            const isLeadItem = LEAD_2_DAY_ITEMS.includes(p.name);
            const leadBadge = isLeadItem ? `<span class="block text-[8px] text-orange-600 font-black mt-0.5 uppercase tracking-tighter">⚠️ 2-Day Lead</span>` : "";

            const createRowTemplate = (prefix) => `
                <div class="item-row py-4 border-b">
                    <div class="flex justify-between items-center px-2">
                        <div class="text-left">
                            <p class="font-bold text-slate-800 uppercase text-[13px] leading-tight">${p.name}</p>
                            ${leadBadge}
                            <button onclick="toggleNote('${prefix}-${p.name}')" class="text-[9px] font-black text-blue-500 uppercase mt-1">📝 Note</button>
                        </div>
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="adjustQty('${prefix}-${p.name}', -1)" class="qty-btn" data-item="${p.name}">-</button>
                            <input type="number" id="qty-${prefix}-${p.name}" oninput="validateChanges()" data-name="${p.name}" value="0" inputmode="numeric" pattern="[0-9]*" class="w-12 h-11 bg-white border-2 rounded-xl text-center font-black text-blue-600 outline-none border-slate-200">
                            <button type="button" onclick="adjustQty('${prefix}-${p.name}', 1)" class="qty-btn" data-item="${p.name}">+</button>
                        </div>
                    </div>
                    <input type="text" id="note-${prefix}-${p.name}" oninput="validateChanges()" placeholder="Note..." class="note-input hidden">
                </div>`;

            if (list) list.innerHTML += createRowTemplate('daily');
            if (standingList) standingList.innerHTML += createRowTemplate('standing');
        });
        applyStandingToDaily();
    }
}

window.toggleNote = function(id) {
    const el = document.getElementById(`note-${id}`);
    if (el) el.classList.toggle('hidden');
};

window.adjustQty = function(id, change) {
    const itemName = id.split('-').pop(); // Get actual item name
    if (window.currentUser.role !== 'kitchen' && isItemLocked(itemName)) return;
    const input = document.getElementById(`qty-${id}`);
    if (input) {
        input.value = Math.max(0, (parseInt(input.value) || 0) + change);
        validateChanges();
    }
};

function isItemLocked(itemName) {
    if (window.currentUser.role === 'kitchen') return false; 
    const product = activeProducts.find(p => p.name === itemName);
    if (product && product.supplier === 'GJ') return false; 

    const dateStr = document.getElementById('delivery-date').value;
    const now = new Date();
    const oDate = new Date(dateStr + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    if (oDate <= today) return true;
    if (oDate.getTime() === tomorrow.getTime() && now.getHours() >= 13) return true;
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
    let totalLocked = isPastCutoff && currentSupplier !== 'GJ' && window.currentUser.role !== 'kitchen';

    const btn = document.getElementById('save-btn'), msg = document.getElementById('lock-msg');
    if (totalLocked) { if (btn) btn.classList.add('btn-disabled'); if (msg) msg.classList.remove('hidden'); }
    else { if (btn) btn.classList.remove('btn-disabled'); if (msg) msg.classList.add('hidden'); }
    
    activeProducts.forEach(p => {
        const input = document.getElementById(`qty-daily-${p.name}`);
        if (input) {
            if (isItemLocked(p.name)) input.classList.add('locked-qty'); 
            else input.classList.remove('locked-qty');
        }
    });
}

window.applyStandingToDaily = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(dateStr + "T00:00:00").getDay()];
    
    document.querySelectorAll('#product-list input[type="number"]').forEach(i => i.value = "0");
    const commentBox = document.getElementById('order-comment');
    if (commentBox) commentBox.value = ""; // Fix General Note sticking
    
    const { data } = await _supabase.from('orders').select('*').eq('venue_id', window.currentUser.venue).eq('delivery_date', dateStr).eq('delivery_slot', slot).maybeSingle();
    currentDBOrder = data;
    
    if (data) {
        data.items.forEach(item => {
            const inp = document.getElementById(`qty-daily-${item.name}`);
            if (inp) {
                inp.value = item.quantity;
                if (item.comment) { const n = document.getElementById(`note-daily-${item.name}`); n.value = item.comment; n.classList.remove('hidden'); }
            }
        });
        if (commentBox) commentBox.value = data.comment || "";
    } else {
        const matches = allStandingOrders.filter(s => s.venue_id === window.currentUser.venue && s.days_of_week.includes(targetDay) && s.delivery_slot === slot);
        matches.forEach(s => { const inp = document.getElementById(`qty-daily-${s.item_name}`); if (inp) inp.value = s.quantity; });
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
        btn.innerText = window.currentUser.role === 'kitchen' ? "Confirm & Save Final Order" : "Save Changes";
    } else btn.classList.add('btn-disabled');
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
        alert("Success: Order saved!"); 
        applyStandingToDaily(); 
    } else { alert("Error saving: " + res.error.message); }
};

window.generateConsolidatedReport = async function() {
    const dateStr = document.getElementById('admin-view-date').value;
    const targetDateObj = new Date(dateStr + "T00:00:00");
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][targetDateObj.getDay()];
    const leadDateObj = new Date(targetDateObj); leadDateObj.setDate(leadDateObj.getDate() + 2); 
    const leadDateStr = leadDateObj.toISOString().split('T')[0];

    const res = document.getElementById('consolidated-results');
    if (!res) return;
    res.innerHTML = "LOADING..."; res.classList.remove('hidden');

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
        venues.forEach(v => { venueReport[v] = { "1st Delivery": { CK: [], DSQK: [], GJ: [], GENERAL: [], note: "" }, "2nd Delivery": { CK: [], DSQK: [], GJ: [], GENERAL: [], note: "" } }; });

        (allOrders || []).forEach(o => {
            if (o.delivery_date === dateStr && venueReport[o.venue_id]) {
                const sData = venueReport[o.venue_id][o.delivery_slot];
                sData.note = o.comment || "";
                o.items.forEach(i => {
                    if (i.quantity > 0) {
                        const s = suppMap[i.name] || "GENERAL";
                        sData[s].push({ name: i.name, qty: i.quantity, note: i.comment || "" });
                        if (totalPrep.hasOwnProperty(i.name)) totalPrep[i.name] += i.quantity;
                    }
                });
            }
            if (o.delivery_date === leadDateStr) {
                o.items.forEach(i => { if (i.quantity > 0 && LEAD_2_DAY_ITEMS.includes(i.name)) leadPrep[i.name] = (leadPrep[i.name] || 0) + i.quantity; });
            }
        });

        standings.forEach(s => {
            if (s.days_of_week && s.days_of_week.includes(targetDay) && venueReport[s.venue_id]) {
                const sData = venueReport[s.venue_id][s.delivery_slot];
                // Only fallback to standing if daily order is completely missing
                const hasDaily = (allOrders || []).some(o => o.delivery_date === dateStr && o.venue_id === s.venue_id && o.delivery_slot === s.delivery_slot);
                if (!hasDaily) {
                    const supp = suppMap[s.item_name] || "GENERAL";
                    sData[supp].push({ name: s.item_name, qty: s.quantity });
                    if (totalPrep.hasOwnProperty(s.item_name)) totalPrep[s.item_name] += s.quantity;
                }
            }
        });

        let html = `<div class="flex justify-between border-b-2 border-slate-800 pb-2 mb-4 uppercase text-[12px] font-black text-slate-800"><span>📦 Loading Plan: ${dateStr}</span><button onclick="window.print()" class="text-blue-600 underline">Print</button></div>`;
        
        // Liquid Prep summary
        html += `<div class="mb-6 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-3xl print:bg-white print:border-slate-300"><h2 class="text-xs font-black text-emerald-800 uppercase mb-3 italic">Immediate Liquid Prep (Today)</h2><div class="grid grid-cols-3 gap-4">`;
        for (const [n, q] of Object.entries(totalPrep)) html += `<div class="bg-white p-2 rounded-xl text-center border border-emerald-100"><p class="text-[9px] font-bold text-slate-400 uppercase">${n}</p><p class="text-lg font-black text-emerald-600">${q}</p></div>`;
        html += `</div></div>`;

        // Advance Prep summary
        if (Object.keys(leadPrep).length > 0) {
            html += `<div class="mb-6 p-4 bg-orange-50 border-2 border-orange-200 rounded-3xl print:hidden"><h2 class="text-xs font-black text-orange-800 uppercase mb-2 italic">Advance Prep (For ${leadDateStr})</h2>`;
            for (const [n, q] of Object.entries(leadPrep)) html += `<div class="flex justify-between py-1 border-b border-orange-100 text-xs font-bold uppercase"><span>${n}</span><span>x${q}</span></div>`;
            html += `</div>`;
        }

        Object.keys(venueReport).sort().forEach(v => {
            const vData = venueReport[v];
            const hasData = ["1st Delivery", "2nd Delivery"].some(slot => {
                const s = vData[slot];
                return s.CK.length > 0 || s.DSQK.length > 0 || s.GJ.length > 0 || s.GENERAL.length > 0 || s.note;
            });

            if (hasData) {
                html += `<div class="mb-8 p-4 border-2 rounded-3xl bg-white shadow-sm border-slate-200"><h2 class="text-2xl font-black text-blue-900 border-b-4 border-blue-100 pb-1 mb-4 uppercase italic">${v}</h2>`;
                ["1st Delivery", "2nd Delivery"].forEach(slot => {
                    const slotData = vData[slot];
                    if (slotData.CK.length > 0 || slotData.DSQK.length > 0 || slotData.GJ.length > 0 || slotData.GENERAL.length > 0 || slotData.note) {
                        html += `<div class="mb-6 last:mb-0"><div class="flex justify-between items-center bg-slate-100 px-3 py-1 rounded-full mb-3">
                                    <span class="text-[11px] font-black text-slate-500 uppercase tracking-widest">${slot}</span>
                                    ${window.currentUser.role === 'kitchen' ? `<button onclick="editVenueOrder('${v}', '${dateStr}', '${slot}')" class="text-[10px] font-bold text-blue-600 uppercase underline">✏️ Adjust</button>` : ""}
                                 </div>`;
                        
                        // Strict Supplier Order: CK -> DSQK -> GJ
                        ["CK", "DSQK", "GJ", "GENERAL"].forEach(supplier => {
                            const items = slotData[supplier];
                            if (items && items.length > 0) {
                                const cClass = supplier === 'CK' ? 'text-blue-600' : supplier === 'DSQK' ? 'text-orange-600' : 'text-emerald-600';
                                html += `<div class="mb-3 pl-2 border-l-4 border-slate-100"><p class="text-[10px] font-black uppercase mb-1 ${cClass}">From: ${supplier}</p>`;
                                items.sort(sortItemsByCustomOrder).forEach(i => {
                                    html += `<div class="flex justify-between py-1 border-b border-slate-50 text-sm font-bold text-slate-700">
                                                <div class="flex items-center gap-2"><input type="checkbox" class="w-4 h-4 rounded border-slate-300"><span>${i.name}</span></div>
                                                <span class="text-blue-900">x${i.qty}</span>
                                             </div>`;
                                    if (i.note) html += `<p class="text-[10px] text-red-500 italic mb-1 ml-6">↳ ${i.note}</p>`;
                                });
                                html += `</div>`;
                            }
                        });
                        if (slotData.note) html += `<div class="mt-2 p-2 bg-yellow-50 border border-yellow-100 rounded-xl text-[11px] text-yellow-800 font-bold italic">⚠️ Venue Note: ${slotData.note}</div>`;
                        html += `</div>`;
                    }
                });
                html += `</div>`;
            }
        });
        res.innerHTML = html;
    } catch (e) { console.error(e); res.innerHTML = "Error."; }
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
};

async function loadStandingOrders() {
    const { data } = await _supabase.from('standing_orders').select('*');
    allStandingOrders = data || [];
}

window.loadExistingStandingValues = function() {
    document.querySelectorAll('[id^="qty-standing-"]').forEach(input => input.value = 0);
    const activeVenue = (window.currentUser.role === 'kitchen') ? originalKitchenVenue : window.currentUser.venue;
    allStandingOrders.filter(s => s.venue_id === activeVenue).forEach(s => {
        const input = document.getElementById(`qty-standing-${s.item_name}`);
        if (input) input.value = s.quantity;
    });
};

window.exportOrdersToCSV = async function() {
    const { data } = await _supabase.from('orders').select('*').order('delivery_date', { ascending: false });
    let csv = "Date,Slot,Venue,Item,Qty,ItemNote,GeneralNote\n";
    (data || []).forEach(order => {
        order.items.forEach(item => {
            const cleanItemNote = (item.comment || "").replace(/,/g, " ");
            const cleanGeneralNote = (order.comment || "").replace(/,/g, " ");
            csv += `${order.delivery_date},${order.delivery_slot},${order.venue_id},${item.name},${item.quantity},${cleanItemNote},${cleanGeneralNote}\n`;
        });
    });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement("a"); a.href = url; a.download = `Backup_${new Date().toISOString().split('T')[0]}.csv`; a.click();
};
