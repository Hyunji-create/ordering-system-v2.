// reports.js - Loading Plan, CK Prep Totals, and Override Navigation

window.generateConsolidatedReport = async function() {
    const dateStr = document.getElementById('admin-view-date').value;
    const targetDateObj = new Date(dateStr + "T00:00:00");
    const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][targetDateObj.getDay()];
    
    // Calculate "Day After" for Upcoming 2-day lead items
    const nextDateObj = new Date(targetDateObj);
    nextDateObj.setDate(targetDateObj.getDate() + 1);
    const nextDateStr = nextDateObj.toISOString().split('T')[0];
    const nextDayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][nextDateObj.getDay()];

    const res = document.getElementById('consolidated-results');
    res.innerHTML = "LOADING..."; res.classList.remove('hidden');

    try {
        const { data: oneOffs } = await _supabase.from('orders').select('*').eq('delivery_date', dateStr);
        const { data: upcomingOneOffs } = await _supabase.from('orders').select('*').eq('delivery_date', nextDateStr);
        const { data: standings } = await _supabase.from('standing_orders').select('*');
        
        const venueReport = {};
        const totalCounts = {};
        const upcomingLeadTotals = {};
        
        // Initialize Totals
        PRODUCT_ORDER.forEach(p => totalCounts[p] = 0);
        LEAD_2_DAY_ITEMS.forEach(p => upcomingLeadTotals[p] = 0);

        ["WYN", "MCC", "WSQ", "DSQ", "GJ"].forEach(v => { 
            venueReport[v] = { "1st Delivery": {items:[], note:""}, "2nd Delivery": {items:[], note:""} }; 
        });

        // 1. Process CURRENT Day (Standings + Manual Overwrites)
        (standings || []).forEach(s => {
            if(s.days_of_week && s.days_of_week.includes(targetDay)) {
                if(venueReport[s.venue_id]) {
                    venueReport[s.venue_id][s.delivery_slot].items.push({ name: s.item_name, qty: s.quantity });
                    if(totalCounts.hasOwnProperty(s.item_name)) totalCounts[s.item_name] += s.quantity;
                }
            }
        });

        (oneOffs || []).forEach(o => {
            if(venueReport[o.venue_id]) {
                // Remove standings from totals before applying manual order
                venueReport[o.venue_id][o.delivery_slot].items.forEach(oldItem => { 
                    if(totalCounts.hasOwnProperty(oldItem.name)) totalCounts[oldItem.name] -= oldItem.qty; 
                });
                // Apply manual order
                venueReport[o.venue_id][o.delivery_slot].items = o.items.map(i => ({ name: i.name, qty: i.quantity, note: i.comment || "" }));
                if (o.comment) venueReport[o.venue_id][o.delivery_slot].note = o.comment;
                // Add manual quantities to totals
                o.items.forEach(i => { if(totalCounts.hasOwnProperty(i.name)) totalCounts[i.name] += i.quantity; });
            }
        });

        // 2. Process UPCOMING (Next Day) 2-Day Lead Items ONLY
        if (window.currentUser.role === 'kitchen') {
            (standings || []).forEach(s => {
                if(s.days_of_week && s.days_of_week.includes(nextDayName) && LEAD_2_DAY_ITEMS.includes(s.item_name)) {
                    upcomingLeadTotals[s.item_name] += s.quantity;
                }
            });
            (upcomingOneOffs || []).forEach(o => {
                o.items.forEach(i => {
                    if (LEAD_2_DAY_ITEMS.includes(i.name)) {
                        const matchStanding = (standings || []).find(s => s.venue_id === o.venue_id && s.delivery_slot === o.delivery_slot && s.item_name === i.name && s.days_of_week.includes(nextDayName));
                        if (matchStanding) upcomingLeadTotals[i.name] -= matchStanding.quantity;
                        upcomingLeadTotals[i.name] += i.quantity;
                    }
                });
            });
        }

        // --- GENERATE HTML ---
        let html = `<div class="flex justify-between border-b pb-2 mb-4 uppercase text-[10px] font-black text-blue-900"><span>Loading Plan (${dateStr})</span><button onclick="window.print()" class="underline">Print</button></div>`;

        // CK PREP BOX
        if (window.currentUser.role === 'kitchen') {
            html += `<div class="mb-6 p-4 border-2 border-blue-600 bg-blue-50 rounded-2xl text-left shadow-md">
                        <h3 class="font-black text-blue-900 text-lg border-b border-blue-200 pb-1 mb-3 uppercase italic">Total Prep (${dateStr})</h3>
                        <div class="grid grid-cols-1 gap-1 mb-6">`;
            PRODUCT_ORDER.forEach(p => {
                html += `<div class="flex justify-between py-1 text-sm font-bold border-b border-blue-100"><span>${p}</span><span class="text-blue-700">x ${totalCounts[p]}</span></div>`;
            });
            html += `</div>
                     <h3 class="font-black text-orange-600 text-lg border-b border-orange-200 pb-1 mb-3 uppercase italic">Upcoming Lead (${nextDateStr})</h3>
                     <div class="grid grid-cols-1 gap-1">`;
            LEAD_2_DAY_ITEMS.forEach(p => {
                html += `<div class="flex justify-between py-1 text-sm font-bold border-b border-orange-100"><span>${p}</span><span class="text-orange-600">x ${upcomingLeadTotals[p]}</span></div>`;
            });
            html += `</div></div>`;
        }

        // VENUE BREAKDOWN
        Object.keys(venueReport).sort().forEach(v => {
            const vData = venueReport[v];
            if(vData["1st Delivery"].items.length > 0 || vData["2nd Delivery"].items.length > 0 || vData["1st Delivery"].note || vData["2nd Delivery"].note) {
                html += `<div class="mb-6 p-4 border-2 rounded-2xl bg-white text-left border-slate-200 shadow-sm"><h3 class="font-black text-blue-800 text-lg border-b pb-1 mb-3 uppercase italic">${v}</h3>`;
                ["1st Delivery", "2nd Delivery"].forEach(slot => {
                    const activeItems = vData[slot].items.filter(i => i.qty > 0).sort(sortItemsByCustomOrder);
                    if(activeItems.length > 0 || vData[slot].note) {
                        html += `<div class="mb-4">
                                    <div class="flex justify-between items-center mb-1 border-l-4 border-blue-400 pl-2">
                                        <p class="text-[9px] font-black text-slate-400 italic">${slot}</p>
                                        ${window.currentUser.role === 'kitchen' ? `<button onclick="editVenueOrder('${v}', '${dateStr}', '${slot}')" class="text-[9px] font-black text-blue-600 underline uppercase">✏️ Adjust</button>` : ""}
                                    </div>`;
                        activeItems.forEach(i => {
                            html += `<div class="flex justify-between py-1 text-sm font-bold border-b border-slate-50"><span>${i.name}</span><span class="text-blue-600">x${i.qty}</span></div>`;
                            if(i.note) html += `<p class="text-[10px] text-red-600 italic mb-1 leading-tight">↳ ${i.note}</p>`;
                        });
                        if(vData[slot].note) html += `<div class="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800 font-bold italic">⚠️ ${vData[slot].note}</div>`;
                        html += `</div>`;
                    }
                });
                html += `</div>`;
            }
        });
        res.innerHTML = html || `<p class="text-center p-10 text-slate-400 font-bold">No orders found.</p>`;
    } catch (e) { console.error("Report Error:", e); }
};

// Override Function for Managers
window.editVenueOrder = function(venueId, dateStr, slot) {
    window.currentUser.venue = venueId;
    updateOverrideIndicator(venueId, true);
    document.getElementById('delivery-date').value = dateStr;
    document.getElementById('delivery-slot').value = slot;
    window.switchTab('daily');
    loadProducts();
    setTimeout(() => {
        document.getElementById('override-status-indicator').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 500);
};
