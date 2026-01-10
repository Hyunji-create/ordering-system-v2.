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
    } else ind.classList.add('hidden');
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
    document.getElementById('tab-daily').className = v === 'daily' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
    document.getElementById('tab-standing').className = v === 'standing' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
};

async function loadProducts() {
    const supplier = document.getElementById('supplier-select').value;
    const slot = document.getElementById('delivery-slot').value;
    const { data } = await _supabase.from('products').select('*').eq('supplier', supplier);
    
    if (data) {
        activeProducts = data.sort(sortItemsByCustomOrder);
        const list = document.getElementById('product-list');
        const drop = document.getElementById('standing-item');
        if (list) list.innerHTML = ""; 
        if (drop) drop.innerHTML = `<option value="">-- ITEM --</option>`;
        
        activeProducts.forEach(p => {
            if (supplier === 'GJ' && slot === '1st Delivery') return;
            const allowed = p.restricted_to ? p.restricted_to.split(',').map(v=>v.trim()) : [];
            const userVenue = window.currentUser.venue;

            // FIX: Ensure no-restriction items show, and restricted items match venue exactly
            let hasAccess = !p.restricted_to || allowed.includes(userVenue);
            if (!hasAccess) return;

            const isLead = LEAD_2_DAY_ITEMS.includes(p.name);
            const badge = isLead ? `<span class="block text-[8px] text-orange-600 font-black mt-0.5 uppercase">⚠️ 2-Day Lead</span>` : "";

            if (list) {
                list.innerHTML += `<div class="item-row py-4 border-b">
                    <div class="flex justify-between items-center px-2">
                        <div class="text-left"><p class="font-bold text-slate-800 uppercase text-[13px] leading-tight">${p.name}</p>${badge}<button onclick="toggleNote('${p.name}')" class="text-[9px] font-black text-blue-500 uppercase mt-1">📝 Note</button></div>
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="adjustQty('${p.name}', -1)" class="qty-btn" data-item="${p.name}">-</button>
                            <input type="number" id="qty-${p.name}" oninput="validateChanges()" data-name="${p.name}" value="0" class="w-12 h-11 border-2 rounded-xl text-center font-black text-blue-600 outline-none border-slate-200">
                            <button type="button" onclick="adjustQty('${p.name}', 1)" class="qty-btn" data-item="${p.name}">+</button>
                        </div>
                    </div>
                    <input type="text" id="note-${p.name}" oninput="validateChanges()" placeholder="Note..." class="note-input">
                </div>`;
            }
            if (drop) drop.innerHTML += `<option value="${p.name}">${p.name}</option>`;
        });
        applyStandingToDaily();
    }
}

window.toggleNote = function(n) {
    const el = document.getElementById(`note-${n}`);
    if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
};

window.adjustQty = function(n, c) {
    if (window.currentUser.role !== 'kitchen' && isItemLocked(n)) return;
    const i = document.getElementById(`qty-${n}`);
    if (i) { i.value = Math.max(0, (parseInt(i.value) || 0) + c); validateChanges(); }
};

function isItemLocked(n) {
    if (window.currentUser.role === 'kitchen') return false; 
    const p = activeProducts.find(x => x.name === n);
    if (p && p.supplier === 'GJ') return false; 
    const dateStr = document.getElementById('delivery-date').value;
    const now = new Date(); const orderDate = new Date(dateStr + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
    if (orderDate <= today) return true;
    if (LEAD_2_DAY_ITEMS.includes(n)) {
        if (orderDate.getTime() === tomorrow.getTime()) return true;
        if (orderDate.getTime() === dayAfter.getTime() && now.getHours() >= 13) return true;
    }
    if (orderDate.getTime() === tomorrow.getTime() && now.getHours() >= 13) return true;
    return false;
}

function checkFormLock() {
    const dateStr = document.getElementById('delivery-date').value;
    const supp = document.getElementById('supplier-select').value;
    const now = new Date(); const oDate = new Date(dateStr + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    let isPast = (oDate <= today) || (oDate.getTime() === tomorrow.getTime() && now.getHours() >= 13);
    let locked = isPast && supp !== 'GJ';
    const btn = document.getElementById('save-btn');
    if (locked && window.currentUser.role !== 'kitchen') btn.classList.add('btn-disabled'); 
    else btn.classList.remove('btn-disabled');
    activeProducts.forEach(p => {
        const input = document.getElementById(`qty-${p.name}`);
        if (input) isItemLocked(p.name) ? input.classList.add('locked-qty') : input.classList.remove('locked-qty');
    });
}

window.applyStandingToDaily = async function() {
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
            if (inp) { inp.value = item.quantity; if (item.comment) { const n = document.getElementById(`note-${item.name}`); n.value = item.comment; n.style.display = 'block'; } }
        });
        document.getElementById('order-comment').value = data.comment || "";
    } else {
        const matches = allStandingOrders.filter(s => s.venue_id === window.currentUser.venue && s.days_of_week.includes(targetDay) && s.delivery_slot === slot);
        matches.forEach(s => { const i = document.getElementById(`qty-${s.item_name}`); if (i) i.value = s.quantity; });
    }
    captureState(); checkFormLock();
};

function captureState() {
    const state = [];
    document.querySelectorAll('#product-list input').forEach(i => state.push(i.value));
    state.push(document.getElementById('order-comment').value);
    initialFormState = JSON.stringify(state);
    validateChanges();
}

window.validateChanges = function() {
    const state = [];
    document.querySelectorAll('#product-list input').forEach(i => state.push(i.value));
    state.push(document.getElementById('order-comment').value);
    const btn = document.getElementById('save-btn');
    if (JSON.stringify(state) !== initialFormState) btn.classList.remove('btn-disabled'); else btn.classList.add('btn-disabled');
};

window.submitOrder = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const items = [];
    document.querySelectorAll('#product-list .item-row').forEach(row => {
        const inp = row.querySelector('input[type="number"]');
        if(inp) items.push({ name: inp.dataset.name, quantity: parseInt(inp.value) || 0, comment: row.querySelector('.note-input').value });
    });
    const payload = { venue_id: window.currentUser.venue, delivery_date: dateStr, delivery_slot: slot, items, comment: document.getElementById('order-comment').value };
    if (currentDBOrder) await _supabase.from('orders').update(payload).eq('id', currentDBOrder.id);
    else await _supabase.from('orders').insert([payload]);
    alert("Saved!"); applyStandingToDaily();
};

window.generateConsolidatedReport = async function() {
    const dateStr = document.getElementById('admin-view-date').value;
    const targetDateObj = new Date(dateStr + "T00:00:00");
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][targetDateObj.getDay()];
    
    // FIX: 2nd Day Lead means 48h. For the 10/1 Loading Plan, we look at orders for 12/1.
    const leadDateObj = new Date(targetDateObj); leadDateObj.setDate(leadDateObj.getDate() + 2); 
    const leadDateStr = leadDateObj.toISOString().split('T')[0];
    const leadDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][leadDateObj.getDay()];

    const res = document.getElementById('consolidated-results');
    if (!res) return;
    res.innerHTML = "LOADING..."; res.classList.remove('hidden');

    try {
        const { data: allOrders } = await _supabase.from('orders').select('*').in('delivery_date', [dateStr, leadDateStr]);
        const { data: standings } = await _supabase.from('standing_orders').select('*');
        const { data: products } = await _supabase.from('products').select('name, supplier');
        const suppMap = {}; products.forEach(p => suppMap[p.name] = p.supplier || "GENERAL");

        const venueReport = {};
        const totalPrep = { "Matcha": 0, "Hojicha": 0, "Strawberry Puree": 0 };
        const leadPrep = {}; 
        const venues = ["WYN", "MCC", "WSQ", "DSQ", "GJ", "DSQK", "CK"];
        venues.forEach(v => { venueReport[v] = { "1st Delivery": { CK:[], DSQK:[], GJ:[], GENERAL:[], note:"", hasDaily: false }, "2nd Delivery": { CK:[], DSQK:[], GJ:[], GENERAL:[], note:"", hasDaily: false } }; });

        // 1. Daily Orders (Priority)
        allOrders.forEach(o => {
            if (o.delivery_date === dateStr && venueReport[o.venue_id]) {
                const sData = venueReport[o.venue_id][o.delivery_slot];
                sData.note = o.comment || ""; sData.hasDaily = true;
                o.items.forEach(i => {
                    const s = suppMap[i.name] || "GENERAL";
                    if (s === 'GJ' && o.delivery_slot === '1st Delivery') return;
                    if (i.quantity > 0) {
                        sData[s].push({ name: i.name, qty: i.quantity, note: i.comment || "" });
                        if (totalPrep.hasOwnProperty(i.name)) totalPrep[i.name] += i.quantity;
                    }
                });
            }
            if (o.delivery_date === leadDateStr) {
                o.items.forEach(i => { if (i.quantity > 0 && LEAD_2_DAY_ITEMS.includes(i.name)) leadPrep[i.name] = (leadPrep[i.name] || 0) + i.quantity; });
            }
        });

        // 2. Standing Orders (Fallback)
        standings.forEach(s => {
            const supp = suppMap[s.item_name] || "GENERAL";
            if (supp === 'GJ' && s.delivery_slot === '1st Delivery') return;
            if (s.days_of_week.includes(targetDay) && venueReport[s.venue_id]) {
                const sData = venueReport[s.venue_id][s.delivery_slot];
                if (!sData.hasDaily) {
                    sData[supp].push({ name: s.item_name, qty: s.quantity });
                    if (totalPrep.hasOwnProperty(s.item_name)) totalPrep[s.item_name] += s.quantity;
                }
            }
            if (s.days_of_week.includes(leadDay) && LEAD_2_DAY_ITEMS.includes(s.item_name)) {
                const venueHasDailyOnPrep = (allOrders || []).some(o => o.delivery_date === leadDateStr && o.venue_id === s.venue_id && o.delivery_slot === s.delivery_slot);
                if (!venueHasDailyOnPrep) leadPrep[s.item_name] = (leadPrep[s.item_name] || 0) + s.quantity;
            }
        });

        let html = `<div class="flex justify-between border-b-2 border-slate-800 pb-2 mb-4 uppercase text-[12px] font-black"><span>📦 Loading Plan: ${dateStr}</span><button onclick="window.print()" class="text-blue-600 underline">Print</button></div>`;
        html += `<div class="mb-6 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-3xl print:bg-white"><h2 class="text-xs font-black text-emerald-800 uppercase mb-3 italic">Immediate Liquid Prep (Today)</h2><div class="grid grid-cols-3 gap-4">`;
        for (const [n, q] of Object.entries(totalPrep)) html += `<div class="bg-white p-2 rounded-xl text-center border border-emerald-100"><p class="text-[9px] font-bold text-slate-400 uppercase">${n}</p><p class="text-lg font-black text-emerald-600">${q}</p></div>`;
        html += `</div></div>`;

        if (Object.keys(leadPrep).length > 0) {
            html += `<div class="mb-6 p-4 bg-orange-50 border-2 border-orange-200 rounded-3xl print:hidden"><h2 class="text-xs font-black text-orange-800 uppercase mb-2 italic">Advance Prep (For delivery on ${leadDateStr})</h2>`;
            for (const [n, q] of Object.entries(leadPrep)) html += `<div class="flex justify-between py-1 border-b border-orange-100 text-xs font-bold uppercase"><span>${n}</span><span>x${q}</span></div>`;
            html += `<p class="text-[8px] text-orange-400 mt-2 italic">* These items take 48h. Start them today to ship in 2 days.</p></div>`;
        }

        Object.keys(venueReport).sort().forEach(v => {
            const vD = venueReport[v];
            if (["1st Delivery", "2nd Delivery"].some(sl => vD[sl].CK.length > 0 || vD[sl].DSQK.length > 0 || vD[sl].GJ.length > 0 || vD[sl].GENERAL.length > 0 || vD[sl].note)) {
                html += `<div class="mb-8 p-5 bg-white border-2 border-slate-200 rounded-3xl shadow-sm print:shadow-none print:border-slate-300">
                            <h2 class="text-2xl font-black text-blue-900 border-b-4 border-blue-50 pb-1 mb-4 uppercase italic">${v}</h2>`;
                ["1st Delivery", "2nd Delivery"].forEach(sl => {
                    const sD = vD[sl];
                    if (sD.CK.length > 0 || sD.DSQK.length > 0 || sD.GJ.length > 0 || sD.GENERAL.length > 0 || sD.note) {
                        html += `<div class="mb-6 last:mb-0"><div class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-1 border-b border-slate-100">${sl}</div>`;
                        ["CK", "DSQK", "GJ", "GENERAL"].forEach(sup => {
                            if (sD[sup].length > 0) {
                                const c = sup === 'CK' ? 'text-blue-600' : sup === 'DSQK' ? 'text-orange-600' : 'text-emerald-600';
                                html += `<div class="mb-3 pl-3 border-l-4 border-slate-100"><p class="text-[9px] font-black uppercase mb-1 ${c}">Supplier: ${sup}</p>`;
                                sD[sup].forEach(i => { 
                                    html += `<div class="flex justify-between items-center py-1 border-b border-slate-50 text-sm font-bold text-slate-700">
                                                <div class="flex items-center gap-2"><input type="checkbox" class="w-4 h-4 rounded border-slate-300"><span>${i.name}</span></div>
                                                <span class="text-blue-900">x${i.qty}</span>
                                             </div>`; 
                                    if(i.note) html += `<p class="text-[10px] text-red-500 italic mb-1 ml-6">↳ ${i.note}</p>`; 
                                });
                                html += `</div>`;
                            }
                        });
                        if (sD.note) html += `<div class="mt-2 p-2 bg-yellow-50 rounded-xl text-[10px] text-yellow-800 font-bold border border-yellow-100 italic">Note: ${sD.note}</div>`;
                        html += `</div>`;
                    }
                });
                html += `</div>`;
            }
        });
        res.innerHTML = html;
    } catch (e) { console.error(e); res.innerHTML = "Error loading report."; }
};

window.editVenueOrder = function(v, d, s) {
    window.currentUser.venue = v; updateOverrideIndicator(v, true);
    document.getElementById('delivery-date').value = d; document.getElementById('delivery-slot').value = s;
    window.switchTab('daily'); loadProducts(); 
};

window.resetToKitchen = function() {
    window.currentUser.venue = originalKitchenVenue; updateOverrideIndicator(originalKitchenVenue, false);
    document.getElementById('welcome-msg').innerText = originalKitchenVenue;
    setTomorrowDate(); loadProducts();
};

async function loadStandingOrders() { const { data } = await _supabase.from('standing_orders').select('*'); allStandingOrders = data || []; renderStandingList(); }

function renderStandingList() {
    const cont = document.getElementById('standing-items-container'); 
    const inputArea = document.querySelector('#view-standing .bg-blue-900'); 
    if(!cont) return; 
    const isO = (window.currentUser.role === 'kitchen' && window.currentUser.venue !== originalKitchenVenue);
    if (inputArea) isO ? inputArea.classList.add('hidden') : inputArea.classList.remove('hidden');
    cont.innerHTML = ""; 
    const activeV = (window.currentUser.role === 'kitchen') ? originalKitchenVenue : window.currentUser.venue;
    const vStandings = allStandingOrders.filter(s => s.venue_id === activeV);
    if (vStandings.length === 0) { cont.innerHTML = `<p class="text-slate-400 font-bold py-10 uppercase text-[10px]">No standing orders for ${activeV}</p>`; return; }
    if (isO) cont.innerHTML = `<div class="bg-slate-100 p-4 rounded-2xl mb-4 text-[10px] font-bold text-slate-500 uppercase italic text-center">ℹ️ Standing editing disabled while adjusting others.</div>`;
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(day => {
        const dOrders = vStandings.filter(s => s.days_of_week.includes(day));
        if (dOrders.length > 0) {
            let dHtml = `<div class="mb-4 text-left"><h4 class="text-[11px] font-black text-blue-600 uppercase border-b mb-2 pb-1">${day}</h4>`;
            ["1st Delivery", "2nd Delivery"].forEach(sl => {
                const slOrders = dOrders.filter(o => o.delivery_slot === sl).sort(sortItemsByCustomOrder);
                if (slOrders.length > 0) {
                    dHtml += `<div class="pl-2 border-l-2 mb-2 border-slate-200"><p class="text-[9px] font-bold text-slate-400 uppercase italic mb-1">${sl}</p>`;
                    slOrders.forEach(s => { dHtml += `<div class="flex justify-between items-center bg-slate-50 p-2 rounded-xl border mb-1"><div><p class="font-bold text-slate-800 text-[12px] uppercase">${s.item_name} x${s.quantity}</p></div><button onclick="deleteStanding(${s.id})" class="text-red-500 font-black text-[9px] uppercase hover:underline p-2 ${isO ? 'hidden' : ''}">Delete</button></div>`; });
                    dHtml += `</div>`;
                }
            });
            cont.innerHTML += dHtml + `</div>`;
        }
    });
}

window.addStandingOrder = async function() {
    const i = document.getElementById('standing-item').value; const sl = document.getElementById('standing-slot').value;
    const qI = document.getElementById('standing-qty'); const q = parseInt(qI.value);
    const days = Array.from(document.querySelectorAll('.day-active')).map(b => b.dataset.day);
    if (!i || isNaN(q) || days.length === 0) return alert("Fill all info.");
    const targetV = (window.currentUser.role === 'kitchen') ? originalKitchenVenue : window.currentUser.venue;
    await _supabase.from('standing_orders').insert([{ venue_id: targetV, item_name: i, quantity: q, delivery_slot: sl, days_of_week: days.join(', ') }]);
    alert("Saved!"); qI.value = ""; document.querySelectorAll('.day-active').forEach(b => b.classList.remove('day-active')); loadStandingOrders();
};

window.deleteStanding = async function(id) { if(confirm("Remove?")) { await _supabase.from('standing_orders').delete().eq('id', id); loadStandingOrders(); } };
window.toggleDay = function(b) { b.classList.toggle('day-active'); };

window.exportOrdersToCSV = async function() {
    const { data } = await _supabase.from('orders').select('*').order('delivery_date', { ascending: false });
    let csv = "Date,Slot,Venue,Item,Qty,ItemNote,GeneralNote\n";
    (data || []).forEach(o => { o.items.forEach(i => { csv += `${o.delivery_date},${o.delivery_slot},${o.venue_id},${i.name},${i.quantity},${(i.comment||"").replace(/,/g," ")},${(o.comment||"").replace(/,/g," ")}\n`; }); });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement("a"); a.href = url; a.download = `Backup_${new Date().toISOString().split('T')[0]}.csv`; a.click();
};
