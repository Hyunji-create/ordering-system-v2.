// orders.js - Product Logic, Lead Times, and Database Saving

const PRODUCT_ORDER = ["Matcha", "Hojicha", "Strawberry Puree", "Chia Pudding", "Mango Puree", "Vanilla Syrup", "Simple Syrup", "Ice"];
const LEAD_2_DAY_ITEMS = ["Vanilla Syrup", "Simple Syrup", "Yuzu Juice"];

// Make this visible to app.js
window.setTomorrowDate = function() {
    const tom = new Date(); 
    tom.setDate(tom.getDate() + 1);
    const iso = tom.toISOString().split('T')[0];
    
    const deliveryInput = document.getElementById('delivery-date');
    const adminInput = document.getElementById('admin-view-date');
    
    if (deliveryInput) deliveryInput.value = iso;
    if (adminInput) adminInput.value = iso;
};

window.isItemLocked = function(itemName) {
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

window.populateSuppliers = function() {
    const select = document.getElementById('supplier-select');
    if(select && !select.innerHTML) {
        select.innerHTML = `<option value="CK">CK</option><option value="DSQ">DSQ</option><option value="GJ">GJ</option>`;
    }
    loadProducts();
};

window.loadProducts = async function() {
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
};

window.submitOrder = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const items = [];
    
    document.querySelectorAll('#product-list .item-row').forEach(row => {
        const inp = row.querySelector('input[type="number"]');
        items.push({ 
            name: inp.dataset.name, 
            quantity: parseInt(inp.value) || 0, 
            comment: row.querySelector('.note-input').value 
        });
    });
    
    const payload = { 
        venue_id: window.currentUser.venue, 
        delivery_date: dateStr, 
        delivery_slot: slot, 
        items: items, 
        comment: document.getElementById('order-comment').value 
    };

    let res = currentDBOrder ? 
        await _supabase.from('orders').update(payload).eq('id', currentDBOrder.id) : 
        await _supabase.from('orders').insert([payload]);

    if (!res.error) { 
        alert("Order Saved Successfully for " + window.currentUser.venue); 
        applyStandingToDaily(); 
    } else {
        alert("Error saving: " + res.error.message);
    }
};

window.checkFormLock = function() {
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
};

window.toggleNote = function(name) {
    const el = document.getElementById(`note-${name}`);
    if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
};
