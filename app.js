// MASTER PRODUCT SEQUENCE
const PRODUCT_ORDER = ["Matcha", "Hojicha", "Strawberry Puree", "Chia Pudding", "Mango Puree", "Vanilla Syrup", "Simple Syrup", "Ice"];

// USERS DATABASE
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

// LOGIN LOGIC
window.handleLogin = function() {
    const u = document.getElementById('username').value.toLowerCase().trim();
    const p = document.getElementById('password').value.trim();
    const found = USERS.find(x => x.id === u && x.pw === p);
    if (found) {
        window.currentUser = found;
        document.getElementById('login-card').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        document.getElementById('welcome-msg').innerText = found.venue;
        startApp();
    } else { alert("Login failed."); }
};

function startApp() {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    setTomorrowDate();
    populateSuppliers();
    loadStandingOrders();
}

// HELPERS
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

// TAB SWITCHING
window.switchTab = function(view) {
    document.getElementById('view-daily').classList.toggle('hidden', view !== 'daily');
    document.getElementById('view-standing').classList.toggle('hidden', view !== 'standing');
    document.getElementById('tab-daily').className = view === 'daily' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
    document.getElementById('tab-standing').className = view === 'standing' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
};

// PRODUCT LOADING
async function populateSuppliers() {
    document.getElementById('supplier-select').innerHTML = `<option value="CK">CK</option><option value="DSQ">DSQ</option><option value="GJ">GJ</option>`;
    loadProducts();
}

async function loadProducts() {
    const supplier = document.getElementById('supplier-select').value;
    const { data, error } = await _supabase.from('products').select('*').eq('supplier', supplier);
    if (data) {
        activeProducts = data.sort(sortItemsByCustomOrder);
        const list = document.getElementById('product-list');
        const drop = document.getElementById('standing-item');
        list.innerHTML = ""; drop.innerHTML = `<option value="">-- ITEM --</option>`;
        activeProducts.forEach(p => {
            const allowed = p.restricted_to ? p.restricted_to.split(',').map(v=>v.trim()) : [];
            if (p.restricted_to && !allowed.includes(currentUser.venue)) return;
            list.innerHTML += `
                <div class="item-row py-4 border-b">
                    <div class="flex justify-between items-center px-2">
                        <div class="text-left">
                            <p class="font-bold text-slate-800 uppercase text-[13px] leading-tight">${p.name}</p>
                            <button onclick="toggleNote('${p.name}')" class="text-[9px] font-black text-blue-500 uppercase mt-1">📝 Note</button>
                        </div>
                        <input type="number" oninput="validateChanges()" data-name="${p.name}" value="0" class="w-16 p-3 bg-slate-50 border-2 rounded-xl text-center font-black text-blue-600 outline-none">
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

// STANDING ORDERS
async function loadStandingOrders() {
    const { data } = await _supabase.from('standing_orders').select('*').eq('venue_id', currentUser.venue);
    allStandingOrders = data || [];
    renderStandingList();
    applyStandingToDaily();
}

function renderStandingList() {
    const cont = document.getElementById('standing-items-container'); 
    if(!cont) return;
    cont.innerHTML = "";
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(day => {
        const dayOrders = allStandingOrders.filter(s => s.days_of_week.includes(day));
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

window.addStandingOrder = async function() {
    const item = document.getElementById('standing-item').value, slot = document.getElementById('standing-slot').value, qty = parseInt(document.getElementById('standing-qty').value);
    const days = Array.from(document.querySelectorAll('.day-active')).map(b => b.dataset.day);
    if (!item || isNaN(qty) || days.length === 0) return alert("Fill all info.");
    await _supabase.from('standing_orders').insert([{ venue_id: currentUser.venue, item_name: item, quantity: qty, delivery_slot: slot, days_of_week: days.join(', ') }]);
    alert("Added!"); loadStandingOrders();
};

window.deleteStanding = async function(id) { if(confirm("Remove?")) { await _supabase.from('standing_orders').delete().eq('id', id); loadStandingOrders(); } };

window.toggleDay = function(btn) { btn.classList.toggle('day-active'); };

// DAILY ORDER LOGIC
function checkFormLock() {
    const dateStr = document.getElementById('delivery-date').value;
    const now = new Date();
    const orderDate = new Date(dateStr + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    let isLocked = (orderDate <= today) || (orderDate.getTime() === tomorrow.getTime() && now.getHours() >= 13);
    const btn = document.getElementById('save-btn'), msg = document.getElementById('lock-msg');
    const qtyInputs = document.querySelectorAll('#product-list input[type="number"]');
    
    if (isLocked) {
        btn.classList.add('btn-disabled');
        msg.classList.remove('hidden');
        qtyInputs.forEach(i => i.classList.add('locked-qty'));
    } else {
        msg.classList.add('hidden');
        qtyInputs.forEach(i => i.classList.remove('locked-qty'));
        validateChanges();
    }
    return isLocked;
}

window.applyStandingToDaily = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(dateStr + "T00:00:00").getDay()];

    document.querySelectorAll('#product-list input[type="number"]').forEach(i => { i.value = "0"; i.classList.remove('auto-filled'); });
    document.querySelectorAll('.note-input').forEach(i => { i.value = ""; i.style.display = 'none'; });

    const { data } = await _supabase.from('orders').select('*').eq('venue_id', currentUser.venue).eq('delivery_date', dateStr).eq('delivery_slot', slot).maybeSingle();
    currentDBOrder = data;

    if (data) {
        data.items.forEach(item => {
            const inp = Array.from(document.querySelectorAll('#product-list input[type="number"]')).find(i => i.dataset.name === item.name);
            if (inp) {
                inp.value = item.quantity;
                if (item.comment) {
                    const note = document.getElementById(`note-${item.name}`);
                    note.value = item.comment; note.style.display = 'block';
                }
            }
        });
    } else {
        const matches = allStandingOrders.filter(s => s.days_of_week.includes(targetDay) && s.delivery_slot === slot);
        matches.forEach(s => {
            const inp = Array.from(document.querySelectorAll('#product-list input[type="number"]')).find(i => i.dataset.name === s.item_name);
            if (inp) { inp.value = s.quantity; inp.classList.add('auto-filled'); }
        });
    }
    captureState();
};

function captureState() {
    const state = [];
    document.querySelectorAll('#product-list input').forEach(i => state.push(i.value));
    initialFormState = JSON.stringify(state);
    validateChanges();
}

window.validateChanges = function() {
    const state = [];
    document.querySelectorAll('#product-list input').forEach(i => state.push(i.value));
    const currentFormState = JSON.stringify(state);
    const btn = document.getElementById('save-btn');
    const isLocked = checkFormLock();

    if (currentFormState !== initialFormState) {
        btn.classList.remove('btn-disabled');
        btn.innerText = isLocked ? "Send Note Only" : "Save Changes";
    } else {
        btn.classList.add('btn-disabled');
        btn.innerText = "No Changes";
    }
};

window.submitOrder = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const items = [];
    document.querySelectorAll('#product-list .item-row').forEach(row => {
        const q = parseInt(row.querySelector('input[type="number"]').value) || 0;
        const name = row.querySelector('input[type="number"]').dataset.name;
        items.push({ name, quantity: q, comment: row.querySelector('.note-input').value });
    });

    const payload = { venue_id: currentUser.venue, delivery_date: dateStr, delivery_slot: slot, items };
    let res = currentDBOrder ? await _supabase.from('orders').update(payload).eq('id', currentDBOrder.id) : await _supabase.from('orders').insert([payload]);

    if (!res.error) { alert("Sent to Kitchen!"); applyStandingToDaily(); }
    else { alert("Error: " + res.error.message); }
};

// CONSOLIDATED REPORT
window.generateConsolidatedReport = async function() {
    const dateStr = document.getElementById('admin-view-date').value;
    const d = new Date(dateStr + "T00:00:00");
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    const res = document.getElementById('consolidated-results');
    res.innerHTML = "LOADING..."; res.classList.remove('hidden');

    try {
        const { data: oneOffs } = await _supabase.from('orders').select('*').eq('delivery_date', dateStr);
        const { data: standings } = await _supabase.from('standing_orders').select('*');
        
        const venueReport = {};
        const VENUES = ["WYN", "MCC", "WSQ", "DSQ", "GJ"];
        VENUES.forEach(v => venueReport[v] = { "1st Delivery": [], "2nd Delivery": [] });

        (standings || []).forEach(s => {
            if(s.days_of_week.includes(targetDay)) {
                if(venueReport[s.venue_id]) venueReport[s.venue_id][s.delivery_slot].push({ name: s.item_name, qty: s.quantity });
            }
        });

        (oneOffs || []).forEach(o => {
            if(venueReport[o.venue_id]) {
                venueReport[o.venue_id][o.delivery_slot] = o.items.map(i => ({ name: i.name, qty: i.quantity, note: i.comment }));
            }
        });

        let html = `<div class="flex justify-between border-b pb-2 mb-4 uppercase text-[10px] font-black text-blue-900"><span>Loading Plan (${dateStr})</span><button onclick="window.print()" class="underline">Print</button></div>`;
        
        VENUES.forEach(v => {
            const vData = venueReport[v];
            const hasOrders = vData["1st Delivery"].length > 0 || vData["2nd Delivery"].length > 0;
            if(hasOrders) {
                html += `<div class="mb-6 p-4 border-2 rounded-2xl bg-slate-50 text-left border-slate-100"><h3 class="font-black text-blue-800 text-lg border-b mb-3 italic">${v}</h3>`;
                ["1st Delivery", "2nd Delivery"].forEach(slot => {
                    const items = vData[slot].filter(i => i.qty > 0).sort(sortItemsByCustomOrder);
                    if(items.length > 0) {
                        html += `<div class="mb-3"><p class="text-[9px] font-black text-slate-400 uppercase italic mb-1 border-l-4 border-blue-400 pl-2">${slot}</p>`;
                        items.forEach(i => {
                            html += `<div class="flex justify-between py-1 text-sm font-bold border-b border-white"><span>${i.name}</span><span class="text-blue-600">x${i.qty}</span></div>`;
                            if(i.note) html += `<p class="text-[10px] text-red-600 font-bold italic mb-1 leading-tight">↳ ${i.note}</p>`;
                        });
                        html += `</div>`;
                    }
                });
                html += `</div>`;
            }
        });
        res.innerHTML = html || `<p class="text-center p-10 text-slate-400 font-bold">No orders for this date.</p>`;
    } catch (e) {
        res.innerHTML = "Error loading list. Check connection.";
        console.error(e);
    }
};

async function loadHistory() {
    // Only current venue history for activity tracking
    const { data } = await _supabase.from('orders').select('*').eq('venue_id', currentUser.venue).order('created_at', { ascending: false }).limit(5);
    const cont = document.getElementById('history-container');
    if(data && cont) {
        cont.innerHTML = data.map(o => `<div class="p-3 bg-slate-50 border rounded-xl mb-2 text-[10px] font-bold uppercase"><div class="flex justify-between text-blue-600 mb-1"><span>${o.delivery_date}</span><span>${o.delivery_slot}</span></div><p class="text-slate-500">${o.items.filter(i=>i.quantity>0).map(i=>`${i.name}(x${i.quantity})`).join(', ')}</p></div>`).join('');
    }
}
