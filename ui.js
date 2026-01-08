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
            <div class="bg-red-600 text-white p-4 rounded-2xl flex justify-between items-center shadow-lg border-b-4 border-red-800 mb-4">
                <div class="text-left">
                    <p class="text-[9px] font-black uppercase tracking-widest opacity-80 mb-1">Override Mode Active</p>
                    <p class="text-lg font-black tracking-tighter uppercase leading-none">ACTING FOR: ${venueName}</p>
                </div>
                <button onclick="resetToKitchen()" class="bg-white text-red-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-md">Exit</button>
            </div>`;
    } else {
        indicator.classList.add('hidden');
    }
};

window.switchTab = function(view) {
    document.getElementById('view-daily').classList.toggle('hidden', view !== 'daily');
    document.getElementById('view-standing').classList.toggle('hidden', view !== 'standing');
    document.getElementById('tab-daily').className = view === 'daily' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
    document.getElementById('tab-standing').className = view === 'standing' ? 'tab-active py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white' : 'py-5 rounded-3xl font-black text-xs uppercase shadow-md bg-white text-slate-400';
};

window.showDashboard = function() {
    document.getElementById('login-card').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    updateHeader(window.currentUser.venue);
    if (typeof startApp === "function") startApp();
};
