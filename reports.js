window.generateConsolidatedReport = async function() {
    const dateStr = document.getElementById('admin-view-date').value;
    const targetDateObj = new Date(dateStr + "T00:00:00");
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][targetDateObj.getDay()];
    const nextDateObj = new Date(targetDateObj); nextDateObj.setDate(targetDateObj.getDate() + 1);
    const nextDateStr = nextDateObj.toISOString().split('T')[0];
    const nextDayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][nextDateObj.getDay()];

    const res = document.getElementById('consolidated-results');
    res.innerHTML = "LOADING..."; res.classList.remove('hidden');

    try {
        const { data: oneOffs } = await _supabase.from('orders').select('*').eq('delivery_date', dateStr);
        const { data: upcomingOneOffs } = await _supabase.from('orders').select('*').eq('delivery_date', nextDateStr);
        const { data: standings } = await _supabase.from('standing_orders').select('*');
        const venueReport = {}; const totalCounts = {}; const upcomingLeadTotals = {};
        PRODUCT_ORDER.forEach(p => totalCounts[p] = 0);
        LEAD_2_DAY_ITEMS.forEach(p => upcomingLeadTotals[p] = 0);
        ["WYN", "MCC", "WSQ", "DSQ", "GJ"].forEach(v => { venueReport[v] = { "1st Delivery": {items:[], note:""}, "2nd Delivery": {items:[], note:""} }; });

        (standings || []).forEach(s => {
            if(s.days_of_week && s.days_of_week.includes(targetDay)) {
                if(venueReport[s.venue_id]) {
                    venueReport[s.venue_id][s.delivery_slot].items.push({ name: s.item_name, qty: s.quantity });
                    if(totalCounts.hasOwnProperty(s.item_name)) totalCounts[s.item_name] += s.quantity;
                }
            }
            if(s.days_of_week && s.days_of_week.includes(nextDayName) && LEAD_2_DAY_ITEMS.includes(s.item_name)) upcomingLeadTotals[s.item_name] += s.quantity;
        });

        (oneOffs || []).forEach(o => {
            if(venueReport[o.venue_id]) {
                venueReport[o.venue_id][o.delivery_slot].items.forEach(oldItem => { if(totalCounts.hasOwnProperty(oldItem.name)) totalCounts[oldItem.name] -= oldItem.qty; });
                venueReport[o.venue_id][o.delivery_slot].items = o.items.map(i => ({ name: i.name, qty: i.quantity, note: i.comment || "" }));
                if (o.comment) venueReport[o.venue_id][o.delivery_slot].note = o.comment;
                o.items.forEach(i => { if(totalCounts.hasOwnProperty(i.name)) totalCounts[i.name] += i.quantity; });
            }
        });

        (upcomingOneOffs || []).forEach(o => { o.items.forEach(i => { if (LEAD_2_DAY_ITEMS.includes(i.name)) {
            const matchStanding = (standings || []).find(s => s.venue_id === o.venue_id && s.delivery_slot === o.delivery_slot && s.item_name === i.name && s.days_of_week.includes(nextDayName));
            if (matchStanding) upcomingLeadTotals[i.name] -= matchStanding.quantity;
            upcomingLeadTotals[i.name] += i.quantity;
        } }); });

        let html = `<div class="p-2 border-b uppercase text-[10px] font-bold">Loading Plan (${dateStr})</div>`;
        if (window.currentUser.role === 'kitchen') {
             html += `<div class="mb-4 p-4 bg-blue-50 rounded-xl"><b>TOTAL PREP:</b>`;
             PRODUCT_ORDER.forEach(p => { if(totalCounts[p]>0) html += `<div class="flex justify-between"><span>${p}</span><span>x${totalCounts[p]}</span></div>`; });
             html += `<br><b>UPCOMING (2-DAY):</b>`;
             LEAD_2_DAY_ITEMS.forEach(p => { if(upcomingLeadTotals[p]>0) html += `<div class="flex justify-between"><span>${p}</span><span>x${upcomingLeadTotals[p]}</span></div>`; });
             html += `</div>`;
        }
        Object.keys(venueReport).forEach(v => {
            html += `<div class="mb-4 border-b pb-2"><b>${v}</b>`;
            ["1st Delivery", "2nd Delivery"].forEach(slot => {
                if(venueReport[v][slot].items.length > 0) {
                    html += `<div class="flex justify-between text-xs"><span>${slot}</span><button onclick="editVenueOrder('${v}','${dateStr}','${slot}')" class="text-blue-600 underline">✏️ Adjust</button></div>`;
                    venueReport[v][slot].items.forEach(i => { if(i.qty > 0) html += `<div class="pl-2 text-xs">${i.name} x${i.qty}</div>`; });
                }
            });
            html += `</div>`;
        });
        res.innerHTML = html;
    } catch (e) { console.error(e); }
};

window.editVenueOrder = function(venueId, dateStr, slot) {
    window.currentUser.venue = venueId;
    updateOverrideIndicator(venueId, true);
    document.getElementById('delivery-date').value = dateStr;
    document.getElementById('delivery-slot').value = slot;
    window.switchTab('daily');
    loadProducts();
    setTimeout(() => document.getElementById('override-status-indicator').scrollIntoView({ behavior: 'smooth' }), 500);
};
