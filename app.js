// app.js - Main Session Entry Point & Standing Order Logic

// Global Variables
let _supabase, initialFormState = "", currentDBOrder = null;
let allStandingOrders = [];
let activeProducts = [];
let originalKitchenVenue = ""; 

// 1. Session Persistence Logic (Runs when browser opens)
window.onload = function() {
    const savedUser = localStorage.getItem('kitchen_portal_user');
    if (savedUser) {
        window.currentUser = JSON.parse(savedUser);
        // Save the original venue so we can return after "Override Mode"
        if (window.currentUser.role === 'kitchen') {
            originalKitchenVenue = window.currentUser.venue;
        }
        showDashboard();
    }
};

// 2. Login Logic
window.handleLogin = function() {
    const u = document.getElementById('username').value.toLowerCase().trim();
    const p = document.getElementById('password').value.trim();
    const found = USERS.find(x => x.id === u && x.pw === p);
    
    if (found) {
        window.currentUser = JSON.parse(JSON.stringify(found));
        // Save to browser memory
        localStorage.setItem('kitchen_portal_user', JSON.stringify(window.currentUser));
        if (found.role === 'kitchen') originalKitchenVenue = found.venue;
        showDashboard();
    } else { 
        alert("Login failed. Check ID and Password."); 
    }
};

// 3. Logout Logic
window.handleLogout = function() {
    if(confirm("Logout from the portal?")) {
        localStorage.removeItem('kitchen_portal_user');
        location.reload();
    }
};

// 4. Start the Supabase connection and initial data fetch
function startApp() {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    setTomorrowDate();
    window.populateSuppliers();
    loadStandingOrders();
}

// 5. Exit Override Mode (Return to Manager view)
window.resetToKitchen = function() {
    window.currentUser.venue = originalKitchenVenue;
    updateHeader(originalKitchenVenue);
    updateOverrideIndicator(originalKitchenVenue, false);
    setTomorrowDate();
    loadProducts();
};

// 6. Standing Order Management
async function loadStandingOrders() {
    // Fetch ALL standing orders so CK can see totals for everyone
    const { data } = await _supabase.from('standing_orders').select('*');
    allStandingOrders = data || [];
    renderStandingList();
    applyStandingToDaily();
}

function renderStandingList() {
    const cont = document.getElementById('standing-items-container'); 
    if(!cont) return;
    cont.innerHTML = "";
    
    // Only show the standing orders for the venue currently being managed
    const venueStandings = allStandingOrders.filter(s => s.venue_id === window.currentUser.venue);
    
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(day => {
        const dayOrders = venueStandings.filter(s => s.days_of_week.includes(day));
        if (dayOrders.length > 0) {
            let dayHtml = `<div class="mb-4 text-left"><h4 class="text-[11px] font-black text-blue-600 uppercase border-b mb-2 pb-1">${day}</h4>`;
            ["1st Delivery", "2nd Delivery"].forEach(slot => {
                const slotOrders = dayOrders.filter(o => o.delivery_slot === slot).sort(sortItemsByCustomOrder);
                if (slotOrders.length > 0) {
                    dayHtml += `<div class="pl-2 border-l-2 mb-2 border-slate-200"><p class="text-[9px] font-bold text-slate-400 uppercase italic mb-1">${slot}</p>`;
                    slotOrders.forEach(s => {
                        dayHtml += `
                            <div class="flex justify-between items-center bg-slate-50 p-2 rounded-xl border mb-1">
                                <div><p class="font-bold text-slate-800 text-[12px] uppercase">${s.item_name} x${s.quantity}</p></div>
                                <button onclick="deleteStanding(${s.id})" class="text-red-500 font-black text-[9px] uppercase hover:underline">Delete</button>
                            </div>`;
                    });
                    dayHtml += `</div>`;
                }
            });
            cont.innerHTML += dayHtml + `</div>`;
        }
    });
}

window.toggleDay = function(btn) { 
    btn.classList.toggle('day-active'); 
};

window.addStandingOrder = async function() {
    const item = document.getElementById('standing-item').value;
    const slot = document.getElementById('standing-slot').value;
    const qtyInput = document.getElementById('standing-qty');
    const qty = parseInt(qtyInput.value);
    const days = Array.from(document.querySelectorAll('.day-active')).map(b => b.dataset.day);

    if (!item || isNaN(qty) || days.length === 0) return alert("Fill all info.");

    const { error } = await _supabase.from('standing_orders').insert([{ 
        venue_id: window.currentUser.venue, 
        item_name: item, 
        quantity: qty, 
        delivery_slot: slot, 
        days_of_week: days.join(', ') 
    }]);

    if(!error) { 
        alert("Schedule Updated!"); 
        qtyInput.value = ""; 
        document.querySelectorAll('.day-active').forEach(b => b.classList.remove('day-active')); 
        loadStandingOrders(); 
    }
};

window.deleteStanding = async function(id) { 
    if(confirm("Remove this standing order?")) { 
        await _supabase.from('standing_orders').delete().eq('id', id); 
        loadStandingOrders(); 
    } 
};
