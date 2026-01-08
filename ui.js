// ui.js - Tab, Header, and Status Management

// 1. Manage the Main Header (The very top of the app)
window.updateHeader = function(venueName) {
    const msg = document.getElementById('welcome-msg');
    if (msg) {
        msg.innerHTML = `<span class="text-blue-600">●</span> ${venueName}`;
    }
};

// 2. Manage the Override Indicator (The red banner above the ordering list)
window.updateOverrideIndicator = function(venueName, isOverride = false) {
    const indicator = document.getElementById('override-status-indicator');
    if (!indicator) return;

    if (isOverride) {
        indicator.classList.remove('hidden');
        indicator.innerHTML = `
            <div class="bg-red-600 text-white p-4 rounded-2xl flex justify-between items-center shadow-lg border-b-4 border-red-800 mb-4">
                <div class="text-left">
                    <p class="text-[9px] font-black uppercase tracking-widest opacity-80 mb-1">Override Mode Active</p>
                    <div class="flex items-center gap-2">
                        <span class="relative flex h-3 w-3">
                          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span class="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                        </span>
                        <p class="text-lg font-black tracking-tighter uppercase leading-none">ACTING FOR: ${venueName}</p>
                    </div>
                </div>
                <button onclick="resetToKitchen()" class="bg-white text-red-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-transform">Exit</button>
            </div>`;
    } else {
        indicator.classList.add('hidden');
    }
};

// 3. Tab Switching Logic
window.switchTab = function(view) {
    const dailyView = document.getElementById('view-daily');
    const standingView = document.getElementById('view-standing');
    const tabDaily = document.getElementById('tab-daily');
    const tabStanding = document.getElementById('tab-standing');

    if (dailyView && standingView) {
        dailyView.classList.toggle('hidden', view !== 'daily');
        standingView.classList.toggle('hidden', view !== 'standing');
    }

    if (tabDaily && tabStanding) {
        tabDaily.className = view === 'daily' 
            ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' 
            : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
        
        tabStanding.className = view === 'standing' 
            ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' 
            : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
    }
};

// 4. Show/Hide Dashboard based on login
window.showDashboard = function() {
    const loginCard = document.getElementById('login-card');
    const dashboard = document.getElementById('dashboard');
    const welcomeMsg = document.getElementById('welcome-msg');

    if (loginCard) loginCard.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
    if (welcomeMsg) welcomeMsg.innerText = window.currentUser.venue;
    
    // Trigger the actual app data load
    if (typeof startApp === "function") startApp();
};
