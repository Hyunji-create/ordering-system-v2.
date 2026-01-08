const PRODUCT_ORDER = ["Matcha", "Hojicha", "Strawberry Puree", "Chia Pudding", "Mango Puree", "Vanilla Syrup", "Simple Syrup", "Ice"];
const LEAD_2_DAY_ITEMS = ["Vanilla Syrup", "Simple Syrup", "Yuzu Juice"];

window.setTomorrowDate = function() {
    const tom = new Date(); tom.setDate(tom.getDate() + 1);
    const iso = tom.toISOString().split('T')[0];
    const delDate = document.getElementById('delivery-date');
    const admDate = document.getElementById('admin-view-date');
    if(delDate) delDate.value = iso;
    if(admDate) admDate.value = iso;
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

window.applyStandingToDaily = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(dateStr + "T00:00:00").getDay()];
    document.querySelectorAll('#product-list input[type="number"]').forEach(i => { i.value = "0"; i.classList.remove('auto-filled'); });
    document.querySelectorAll('.note-input').forEach(i => { i.value = ""; i.style.display = 'none'; });
    document.getElementById('order-comment').value = "";
    const { data } = await _supabase.from('orders').select('*').eq('venue_id', window.currentUser.venue).eq('delivery_date', dateStr).eq('delivery_slot', slot).maybeSingle();
    currentDBOrder = data;
    if (data) {
        data.items.forEach(item => {
            const inp = document.getElementById(`qty-${item.name}`);
            if (inp) {
                inp.value = item.quantity;
                const note = document.getElementById(`note-${item.name}`);
                if (item.comment && note) { note.value = item.comment; note.style.display = 'block'; }
            }
        });
        document.getElementById('order-comment').value = data.comment || "";
    } else {
        const matches = allStandingOrders.filter(s => s.venue_id === window.currentUser.venue && s.days_of_week.includes(targetDay) && s.delivery_slot === slot);
        matches.forEach(s => { const inp = document.getElementById(`qty-${s.item_name}`); if (inp) { inp.value = s.quantity; inp.classList.add('auto-filled'); } });
    }
    validateChanges(); checkFormLock();
};

window.submitOrder = async function() {
    const dateStr = document.getElementById('delivery-date').value;
    const slot = document.getElementById('delivery-slot').value;
    const items = [];
    document.querySelectorAll('#product-list .item-row').forEach(row => {
        const inp = row.querySelector('input[type="number"]');
        items.push({ name: inp.dataset.name, quantity: parseInt(inp.value) || 0, comment: row.querySelector('.note-input').value });
    });
    const payload = { venue_id: window.currentUser.venue, delivery_date: dateStr, delivery_slot: slot, items: items, comment: document.getElementById('order-comment').value };
    let res = currentDBOrder ? await _supabase.from('orders').update(payload).eq('id', currentDBOrder.id) : await _supabase.from('orders').insert([payload]);
    if (!res.error) { alert("Saved for " + window.currentUser.venue); applyStandingToDaily(); }
};

window.validateChanges = function() {
    const btn = document.getElementById('save-btn');
    if(!btn) return;
    btn.innerText = "Save Changes";
    btn.classList.remove('btn-disabled'); 
    if (window.currentUser.role === 'kitchen') btn.innerText = "Confirm & Save Final Order";
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
        if(btn) btn.classList.add('btn-disabled'); if(msg) msg.classList.remove('hidden'); 
    } else {
        if(msg) msg.classList.add('hidden');
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

function sortItemsByCustomOrder(a, b) {
    let idxA = PRODUCT_ORDER.indexOf(a.name);
    let idxB = PRODUCT_ORDER.indexOf(b.name);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
}
