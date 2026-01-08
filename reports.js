// reports.js - Loading Plan & CK Prep List

window.generateConsolidatedReport = async function() {
    const dateStr = document.getElementById('admin-view-date').value;
    const res = document.getElementById('consolidated-results');
    res.innerHTML = "LOADING..."; res.classList.remove('hidden');

    try {
        const { data: oneOffs } = await _supabase.from('orders').select('*').eq('delivery_date', dateStr);
        const { data: standings } = await _supabase.from('standing_orders').select('*');
        
        let html = `<div class="p-2 border-b uppercase text-[10px] font-bold tracking-widest">Loading Plan (${dateStr})</div>`;
        
        // ... (Include your breakdown logic here as built before) ...
        
        res.innerHTML = html;
    } catch (e) { console.error(e); }
};

window.editVenueOrder = function(venueId, dateStr, slot) {
    window.currentUser.venue = venueId;
    window.updateOverrideIndicator(venueId, true);
    document.getElementById('delivery-date').value = dateStr;
    document.getElementById('delivery-slot').value = slot;
    window.switchTab('daily');
    window.loadProducts();
    setTimeout(() => {
        const el = document.getElementById('override-status-indicator');
        if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 500);
};
