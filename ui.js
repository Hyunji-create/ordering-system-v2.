// ui.js - Tab and Header management

window.updateHeader = function(venueName) {
    const msg = document.getElementById('welcome-msg');
    if (msg) msg.innerHTML = `<span class="text-blue-600">●</span> ${venueName}`;
};

window.updateOverrideIndicator = function(venueName, isOverride = false) {
    const indicator = document.getElementById('override-status-indicator');
    if (!indicator) return;
    if (isOverride) {
        indicator.classList.remove('hidden');
        indicator.innerHTML = `
            <div class="bg-red-600 text-white p-4 rounded-2xl flex justify-between items-center shadow-lg mb-4">
                <div class="text-left">
                    <p class="text-[9px] font-black uppercase opacity-80">Override Active</p>
                    <p class="text-lg font-black uppercase">ACTING FOR: ${venueName}</p>
                </div>
                <button onclick="window.resetToKitchen()" class="bg-white text-red-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase">Exit</button>
            </div>`;
    } else {
        indicator.classList.add('hidden');
    }
};

window.switchTab = function(view) {
    document.getElementById('view-daily').classList.toggle('hidden', view !== 'daily');
    document.getElementById('view-standing').classList.toggle('hidden', view !== 'standing');
    
    document.getElementById('tab-daily').className = view === 'daily' 
        ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' 
        : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
        
    document.getElementById('tab-standing').className = view === 'standing' 
        ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' 
        : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
};

window.showDashboard = function() {
    document.getElementById('login-card').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    window.updateHeader(window.currentUser.venue);
    // VITAL: Trigger the main app start
    if (window.startApp) window.startApp();
};
