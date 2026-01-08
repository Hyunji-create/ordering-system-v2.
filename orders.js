// orders.js - Product Logic & Lead Times
window.PRODUCT_ORDER = ["Matcha", "Hojicha", "Strawberry Puree", "Chia Pudding", "Mango Puree", "Vanilla Syrup", "Simple Syrup", "Ice"];
window.LEAD_2_DAY_ITEMS = ["Vanilla Syrup", "Simple Syrup", "Yuzu Juice"];

window.setTomorrowDate = function() {
    const tom = new Date(); tom.setDate(tom.getDate() + 1);
    const iso = tom.toISOString().split('T')[0];
    if(document.getElementById('delivery-date')) document.getElementById('delivery-date').value = iso;
    if(document.getElementById('admin-view-date')) document.getElementById('admin-view-date').value = iso;
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
    if (window.LEAD_2_DAY_ITEMS.includes(itemName)) {
        if (orderDate.getTime() === tomorrow.getTime()) return true;
        if (orderDate.getTime() === dayAfter.getTime() && now.getHours() >= 13) return true;
    }
    if (orderDate.getTime() === tomorrow.getTime() && now.getHours() >= 13) return true;
    return false;
};

window.checkFormLock = function() {
    const dateStr = document.getElementById('delivery-date').value;
    const orderDate = new Date(dateStr + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    const now = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    
    let totalLocked = (orderDate <= today) || (orderDate.getTime() === tomorrow.getTime() && now.getHours() >= 13);
    const btn = document.getElementById('save-btn');
    const msg = document.getElementById('lock-msg');

    if (totalLocked && window.currentUser.role !== 'kitchen') { 
        if(btn) btn.classList.add('btn-disabled'); 
        if(msg) msg.classList.remove('hidden'); 
    } else {
        if(msg) msg.classList.add('hidden');
    }

    window.activeProducts.forEach(p => {
        const locked = window.isItemLocked(p.name);
        const input = document.getElementById(`qty-${p.name}`);
        const btns = document.querySelectorAll(`button[data-item="${p.name}"]`);
        if (input) {
            if (locked) {
                input.classList.add('locked-qty');
                btns.forEach(b => b.classList.add('opacity-30', 'pointer-events-none'));
            } else {
                input.classList.remove('locked-qty');
                btns.forEach(b => b.classList.remove('opacity-30', 'pointer-events-none'));
            }
        }
    });
};

window.applyStandingToDaily = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(dateStr + "T00:00:00").getDay()];

    const listContainer = document.getElementById('product-list');
    if (!listContainer) return;

    const { data } = await window._supabase.from('orders').select('*').eq('venue_id', window.currentUser.venue).eq('delivery_date', dateStr).eq('delivery_slot', slot).maybeSingle();
    window.currentDBOrder = data;

    document.querySelectorAll('#product-list input[type="number"]').forEach(i => i.value = "0");

    if (data) {
        data.items.forEach(item => {
            const inp = document.getElementById(`qty-${item.name}`);
            if (inp) inp.value = item.quantity;
        });
    } else {
        const matches = window.allStandingOrders.filter(s => s.venue_id === window.currentUser.venue && s.days_of_week.includes(targetDay) && s.delivery_slot === slot);
        matches.forEach(s => { 
            const inp = document.getElementById(`qty-${s.item_name}`); 
            if (inp) { inp.value = s.quantity; inp.classList.add('auto-filled'); } 
        });
    }
    window.checkFormLock();
};

window.loadProducts = async function() {
    const supplier = document.getElementById('supplier-select').value;
    const { data } = await window._supabase.from('products').select('*').eq('supplier', supplier);
    if (data) {
        window.activeProducts = data.sort((a, b) => {
            let idxA = window.PRODUCT_ORDER.indexOf(a.name);
            let idxB = window.PRODUCT_ORDER.indexOf(b.name);
            return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
        });
        const list = document.getElementById('product-list');
        list.innerHTML = ""; 
        window.activeProducts.forEach(p => {
            list.innerHTML += `
                <div class="item-row py-4 border-b">
                    <div class="flex justify-between items-center px-2">
                        <div class="text-left"><p class="font-bold text-slate-800 uppercase text-[13px]">${p.name}</p></div>
                        <div class="flex items-center gap-2">
                            <button onclick="window.adjustQty('${p.name}', -1)" class="qty-btn" data-item="${p.name}">-</button>
                            <input type="number" id="qty-${p.name}" data-name="${p.name}" value="0" class="w-12 h-11 border-2 rounded-xl text-center font-black">
                            <button onclick="window.adjustQty('${p.name}', 1)" class="qty-btn" data-item="${p.name}">+</button>
                        </div>
                    </div>
                </div>`;
        });
        window.applyStandingToDaily();
    }
};
