// orders.js - Product Logic, Lead Times, and Database Saving
const PRODUCT_ORDER = ["Matcha", "Hojicha", "Strawberry Puree", "Chia Pudding", "Mango Puree", "Vanilla Syrup", "Simple Syrup", "Ice"];
const LEAD_2_DAY_ITEMS = ["Vanilla Syrup", "Simple Syrup", "Yuzu Juice"];

window.setTomorrowDate = function() {
    const tom = new Date(); 
    tom.setDate(tom.getDate() + 1);
    const iso = tom.toISOString().split('T')[0];
    if(document.getElementById('delivery-date')) document.getElementById('delivery-date').value = iso;
    if(document.getElementById('admin-view-date')) document.getElementById('admin-view-date').value = iso;
};

window.populateSuppliers = function() {
    const select = document.getElementById('supplier-select');
    if(select && !select.innerHTML) {
        select.innerHTML = `<option value="CK">CK</option><option value="DSQ">DSQ</option><option value="GJ">GJ</option>`;
    }
    window.loadProducts();
};

window.loadProducts = async function() {
    const supplier = document.getElementById('supplier-select').value;
    const { data } = await _supabase.from('products').select('*').eq('supplier', supplier);
    
    if (data) {
        activeProducts = data.sort((a, b) => {
            let idxA = PRODUCT_ORDER.indexOf(a.name);
            let idxB = PRODUCT_ORDER.indexOf(b.name);
            return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
        });
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
        window.applyStandingToDaily();
    }
};

window.applyStandingToDaily = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(dateStr + "T00:00:00").getDay()];
    
    document.querySelectorAll('#product-list input[type="number"]').forEach(i => { i.value = "0"; i.classList.remove('auto-filled'); });
    document.getElementById('order-comment').value = "";

    const { data } = await _supabase.from('orders').select('*').eq('venue_id', window.currentUser.venue).eq('delivery_date', dateStr).eq('delivery_slot', slot).maybeSingle();
    currentDBOrder = data;

    if (data) {
        data.items.forEach(item => {
            const inp = document.getElementById(`qty-${item.name}`);
            if (inp) inp.value = item.quantity;
        });
        document.getElementById('order-comment').value = data.comment || "";
    } else {
        const matches = allStandingOrders.filter(s => s.venue_id === window.currentUser.venue && s.days_of_week.includes(targetDay) && s.delivery_slot === slot);
        matches.forEach(s => { 
            const inp = document.getElementById(`qty-${s.item_name}`); 
            if (inp) { inp.value = s.quantity; inp.classList.add('auto-filled'); } 
        });
    }
    window.checkFormLock();
};
