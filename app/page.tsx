"use client";

import { useState, useEffect } from "react";
import { 
  Check, Flame, Plus, LogOut, User, Trophy, 
  BarChart3, Calendar, Home, ChevronLeft, ChevronRight, X, Loader2,
  Trash2, Pencil, Zap, RefreshCcw, Minus, TrendingUp
} from "lucide-react";

// --- TYPES ---
type Habit = { 
  id: string; 
  name: string; 
  emoji: string; 
  weeklyTarget: number; 
  dailyTarget: number; 
};
type Log = { habitId: string; date: string; status: string };
type ViewMode = "home" | "calendar" | "stats" | "add" | "edit";

export default function ProHabitTracker() {
  // --- STATE ---
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [view, setView] = useState<ViewMode>("home");
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [popupDate, setPopupDate] = useState<string | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");

  const [habitForm, setHabitForm] = useState({ id: "", name: "", emoji: "🔥", weeklyTarget: 7, dailyTarget: 1 });

  const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL;

  // --- HELPER: FORMAT TANGGAL PINTAR ---
  // Fungsi ini memaksa semua tanggal jadi format YYYY-MM-DD yang bersih
  const cleanDateStr = (input: string | Date) => {
    if (!input) return "";
    const str = input.toString();
    // Jika format ISO (2024-02-20T...), ambil depannya saja
    if (str.includes("T")) return str.substring(0, 10);
    // Jika format sudah YYYY-MM-DD, biarkan
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
    // Fallback: konversi manual
    const d = new Date(input);
    if (isNaN(d.getTime())) return str; // Jika error, kembalikan aslinya
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [todayStr, setTodayStr] = useState("");

  useEffect(() => {
    setTodayStr(cleanDateStr(new Date()));
  }, []);

  useEffect(() => {
    const savedId = localStorage.getItem("nextgas_uid");
    const savedName = localStorage.getItem("nextgas_uname");
    if (savedId && savedName) {
      setUserId(savedId);
      setUsername(savedName);
      fetchData(savedId);
    }
  }, []);

  // --- API FUNCTIONS ---
  const fetchData = async (uid: string) => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${GAS_URL}?userId=${uid}`);
      const data = await res.json();
      
      setHabits(data.habits || []);
      
      // BERSIHKAN TANGGAL SAAT DATA MASUK
      // Ini kunci agar grafik terbaca!
      const cleanedLogs = (data.logs || []).map((l: any) => ({
        ...l,
        date: cleanDateStr(l.date)
      }));
      
      setLogs(cleanedLogs);
    } catch (e) { console.error(e); } finally { setIsSyncing(false); }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true); setAuthError("");
    try {
      const res = await fetch(GAS_URL!, { method: "POST", body: JSON.stringify({ action: authMode, ...authForm }) });
      const data = await res.json();
      if (data.status === "success") {
        localStorage.setItem("nextgas_uid", data.userId);
        localStorage.setItem("nextgas_uname", data.username);
        setUserId(data.userId); setUsername(data.username); 
        await fetchData(data.userId); 
      } else { setAuthError(data.message); }
    } catch (e) { setAuthError("Gagal koneksi server."); } finally { setIsSyncing(false); }
  };

  const handleLogout = () => {
    setIsSyncing(true);
    setTimeout(() => {
      localStorage.clear();
      setUserId(null); setUsername(null); setHabits([]); setLogs([]); 
      setView("home"); setAuthForm({ username: "", password: "" });
      setIsSyncing(false);
    }, 500);
  };

  const handleSaveHabit = async () => {
    if (!habitForm.name) return;
    setIsSubmitting(true);
    const isEdit = !!habitForm.id;
    const action = isEdit ? "edit_habit" : "create_habit";

    if (isEdit) {
      setHabits(habits.map(h => h.id === habitForm.id ? { ...habitForm } : h));
    } else {
      const tempId = "temp-" + Date.now(); 
      setHabits([...habits, { ...habitForm, id: tempId }]);
    }
    setView("home");

    await fetch(GAS_URL!, {
      method: "POST",
      body: JSON.stringify({ action, userId, habitId: habitForm.id, ...habitForm })
    });
    
    fetchData(userId!); 
    setIsSubmitting(false);
  };

  const handleDeleteHabit = async () => {
    if (!confirm("Yakin hapus habit ini?")) return;
    setIsSubmitting(true);
    setHabits(habits.filter(h => h.id !== habitForm.id));
    setLogs(logs.filter(l => l.habitId !== habitForm.id)); 
    setView("home");
    await fetch(GAS_URL!, { method: "POST", body: JSON.stringify({ action: "delete_habit", userId, habitId: habitForm.id }) });
    setIsSubmitting(false);
  };

  const incrementHabit = async (habitId: string, dailyTarget: number) => {
    const currentCount = logs.filter(l => l.habitId === habitId && l.date === todayStr).length;
    if (currentCount >= dailyTarget) return;

    setLogs([...logs, { habitId, date: todayStr, status: "Done" }]);
    await fetch(GAS_URL!, { method: "POST", body: JSON.stringify({ action: "track", userId, habitId, date: todayStr }) });
  };

  const decrementHabit = async (habitId: string) => {
    const currentCount = logs.filter(l => l.habitId === habitId && l.date === todayStr).length;
    if (currentCount <= 0) return;

    const newLogs = [...logs];
    const indexToRemove = newLogs.map(l => l.habitId === habitId && l.date === todayStr).lastIndexOf(true);
    
    if (indexToRemove !== -1) {
      newLogs.splice(indexToRemove, 1);
      setLogs(newLogs);
      await fetch(GAS_URL!, { method: "POST", body: JSON.stringify({ action: "undo_track", userId, habitId, date: todayStr }) });
    }
  };

  // --- HELPERS (Updated Logic) ---
  const calculateStreak = () => {
    const uniqueDates = [...new Set(logs.map(l => l.date))].sort((a, b) => b.localeCompare(a));
    if (uniqueDates.length === 0) return 0;

    let streak = 0;
    const today = cleanDateStr(new Date());
    
    // Cek hari ini
    let hasToday = uniqueDates.includes(today);
    
    // Cek kemarin (jika hari ini belum isi, streak jangan putus dulu)
    if (!hasToday) {
       const yesterday = new Date();
       yesterday.setDate(yesterday.getDate() - 1);
       if (!uniqueDates.includes(cleanDateStr(yesterday))) return 0;
    }

    // Hitung mundur
    let checkDate = new Date();
    // Kalau hari ini kosong, start cek dari kemarin
    if (!hasToday) checkDate.setDate(checkDate.getDate() - 1);

    while (true) {
      const dStr = cleanDateStr(checkDate);
      if (uniqueDates.includes(dStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const getWeeklyProgress = (habitId: string, weeklyTarget: number) => {
    const startOfWeek = new Date();
    const day = startOfWeek.getDay() || 7; 
    startOfWeek.setDate(startOfWeek.getDate() - day + 1);
    
    let daysCompleted = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const checkDate = cleanDateStr(d);
      if (logs.some(l => l.habitId === habitId && l.date === checkDate)) {
        daysCompleted++;
      }
    }
    return Math.min((daysCompleted / weeklyTarget) * 100, 100);
  };

  const getLogsForDate = (dateStr: string) => {
    const dayLogs = logs.filter(l => l.date === dateStr);
    const uniqueHabitIds = Array.from(new Set(dayLogs.map(l => l.habitId)));
    return uniqueHabitIds.map(id => {
      return habits.find(h => h.id === id);
    }).filter(Boolean);
  };

  // --- STATS GENERATOR (Fixed) ---
  const getLast7DaysData = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = cleanDateStr(d);
      
      const count = logs.filter(l => l.date === dateStr).length;
      
      days.push({ 
        day: d.toLocaleDateString('id-ID', { weekday: 'short' }), 
        count,
        date: dateStr
      });
    }
    return days;
  };

  // --- LOADING COMPONENT ---
  const LoadingModal = () => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 p-8 rounded-3xl flex flex-col items-center border border-slate-700 shadow-2xl">
        <Loader2 className="animate-spin text-blue-500 w-12 h-12 mb-4" />
        <p className="text-white font-bold text-lg">Sinkronisasi Data...</p>
      </div>
    </div>
  );

  // --- LOGIN UI ---
  if (!userId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans relative">
        {isSyncing && <LoadingModal />}
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"><Flame className="text-white w-8 h-8" /></div>
            <h1 className="text-2xl font-bold text-white">NextGAS Pro</h1>
            <p className="text-slate-400 text-sm mt-2">Bangun konsistensi setiap hari.</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <input type="text" required placeholder="Username" className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500" value={authForm.username} onChange={(e) => setAuthForm({...authForm, username: e.target.value})} />
            <input type="password" required placeholder="Password" className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500" value={authForm.password} onChange={(e) => setAuthForm({...authForm, password: e.target.value})} />
            {authError && <div className="text-red-400 text-xs p-3 bg-red-900/20 rounded-lg text-center">{authError}</div>}
            <button type="submit" disabled={isSyncing} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg flex justify-center gap-2">
              {authMode === "login" ? "Masuk" : "Buat Akun"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500 cursor-pointer hover:text-white" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>{authMode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Login"}</p>
        </div>
      </div>
    );
  }

  // --- MAIN APP ---
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-28 relative">
      {isSyncing && <LoadingModal />}
      
      <div className="max-w-md mx-auto min-h-screen relative bg-slate-950 shadow-2xl overflow-hidden">
        
        <header className="p-6 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0 z-20 border-b border-white/5">
          <div><h1 className="font-bold text-lg capitalize">{username}</h1><p className="text-xs text-slate-400">Keep going!</p></div>
          <button onClick={handleLogout} className="p-2 bg-slate-800 rounded-full hover:bg-red-900/50 text-slate-400 hover:text-red-400 transition-colors"><LogOut size={16} /></button>
        </header>

        <div className="p-6 space-y-6 min-h-[80vh]">
          
          {/* HOME VIEW */}
          {view === "home" && (
            <>
              {/* STREAK CARD DI HOME (NEW FEATURE) */}
              <div className="bg-gradient-to-br from-blue-900/50 to-slate-900 border border-blue-500/20 p-4 rounded-2xl flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-400">
                    <Flame size={20} fill="currentColor" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold leading-none">{calculateStreak()}</h2>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Hari Streak</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{new Date().toLocaleDateString('id-ID', { weekday: 'long' })}</p>
                  <p className="text-xs font-bold text-slate-200">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}</p>
                </div>
              </div>

              <div className="flex justify-between items-center mt-6">
                <h2 className="font-bold text-lg">Rutinitas</h2>
                <button onClick={() => fetchData(userId!)} className="p-1.5 bg-slate-800 rounded-full text-slate-400 hover:text-white"><RefreshCcw size={14}/></button>
              </div>

              <div className="space-y-4">
                {habits.map((habit) => {
                  const dailyCount = logs.filter(l => l.habitId === habit.id && l.date === todayStr).length;
                  const isFull = dailyCount >= habit.dailyTarget;
                  const progress = getWeeklyProgress(habit.id, habit.weeklyTarget);
                  
                  return (
                    <div key={habit.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl relative overflow-hidden group">
                      <div className="flex justify-between items-center relative z-10">
                        {/* Area Edit */}
                        <div className="flex items-center gap-4 cursor-pointer" onClick={() => { setHabitForm(habit); setView("edit"); }}>
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-colors ${isFull ? "bg-green-500/20 text-green-400" : "bg-slate-800"}`}>{habit.emoji}</div>
                          <div>
                            <h3 className={`font-bold ${isFull && "text-slate-400"}`}>{habit.name}</h3>
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                               <span>Target: {habit.dailyTarget}x/hari</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {dailyCount > 0 && (
                             <button onClick={() => decrementHabit(habit.id)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 flex items-center justify-center">
                               <Minus size={14} />
                             </button>
                          )}
                          
                          <button 
                            onClick={() => incrementHabit(habit.id, habit.dailyTarget)} 
                            disabled={isFull}
                            className={`w-12 h-10 rounded-full flex items-center justify-center border-2 transition-all gap-1 text-sm font-bold
                              ${isFull 
                                ? "bg-green-500 border-green-500 text-black cursor-default" 
                                : "border-slate-600 hover:border-blue-500 active:scale-95"
                              }`}
                          >
                            {isFull ? <Check size={18} /> : <span>{dailyCount}/{habit.dailyTarget}</span>}
                          </button>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 h-1 bg-slate-800 w-full"><div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
                    </div>
                  );
                })}
              </div>
              {habits.length === 0 && !isSyncing && <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-3xl text-slate-500">Belum ada habit. Tekan + untuk buat.</div>}
            </>
          )}

          {/* ADD/EDIT VIEW */}
          {(view === "add" || view === "edit") && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between mb-6">
                 <h2 className="text-xl font-bold">{view === "add" ? "Habit Baru" : "Edit Habit"}</h2>
                 <button onClick={() => setView("home")}><X className="text-slate-400"/></button>
              </div>
              <div className="space-y-4">
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Nama</label><input className="w-full p-4 bg-black/30 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500" placeholder="Contoh: Minum Air" value={habitForm.name} onChange={e => setHabitForm({...habitForm, name: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Target Harian: <span className="text-blue-400 text-lg ml-2">{habitForm.dailyTarget}x</span></label><input type="range" min="1" max="10" className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" value={habitForm.dailyTarget} onChange={e => setHabitForm({...habitForm, dailyTarget: parseInt(e.target.value)})} /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Frekuensi Mingguan: <span className="text-white text-lg ml-2">{habitForm.weeklyTarget} Hari</span></label><input type="range" min="1" max="7" className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" value={habitForm.weeklyTarget} onChange={e => setHabitForm({...habitForm, weeklyTarget: parseInt(e.target.value)})} /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Ikon</label><div className="grid grid-cols-5 gap-2">{["🔥", "🏃", "💪", "📚", "💧", "🧘", "💰", "🎨", "🧠", "🤲"].map(emoji => (<button key={emoji} onClick={() => setHabitForm({...habitForm, emoji})} className={`p-3 rounded-xl text-xl transition-all ${habitForm.emoji === emoji ? "bg-blue-600 scale-110" : "bg-slate-800 hover:bg-slate-700"}`}>{emoji}</button>))}</div></div>
                <div className="flex gap-3 pt-4">{view === "edit" && (<button onClick={handleDeleteHabit} className="p-4 bg-red-900/30 text-red-400 font-bold rounded-xl hover:bg-red-900/50 border border-red-900/50"><Trash2 size={20} /></button>)}<button onClick={handleSaveHabit} disabled={!habitForm.name || isSubmitting} className="flex-1 py-4 bg-blue-600 font-bold rounded-xl hover:bg-blue-500 disabled:opacity-50">{isSubmitting ? "Menyimpan..." : "Simpan"}</button></div>
              </div>
            </div>
          )}

           {/* CALENDAR VIEW */}
           {view === "calendar" && (
            <div className="animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <button onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() - 1)))} className="p-2 bg-slate-800 rounded-lg"><ChevronLeft size={20} /></button>
                <h2 className="font-bold text-lg">{selectedDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</h2>
                <button onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() + 1)))} className="p-2 bg-slate-800 rounded-lg"><ChevronRight size={20} /></button>
              </div>
              <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-500 uppercase">{['Sn','Sl','Rb','Km','Jm','Sb','Mg'].map(d => <div key={d}>{d}</div>)}</div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: (new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay() || 7) - 1 }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                  const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i + 1);
                  const dStr = cleanDateStr(d); 
                  const intensity = logs.filter(l => l.date === dStr).length;
                  return (
                    <button key={i} onClick={() => intensity > 0 && setPopupDate(dStr)} disabled={intensity === 0} className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs border transition-all ${dStr === todayStr ? "border-blue-500" : "border-transparent"} ${intensity > 0 ? "bg-green-500/20 text-green-400 font-bold hover:bg-green-500/30 cursor-pointer" : "bg-slate-900 text-slate-500 cursor-default"}`}>
                      {i + 1}
                      {intensity > 0 && <div className="w-1 h-1 bg-green-500 rounded-full mt-1"></div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STATS VIEW */}
          {view === "stats" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="font-bold text-xl">Statistik</h2>
              
              {/* WEEKLY TREND CHART */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="text-blue-500 w-5 h-5" />
                  <h3 className="font-bold text-sm text-slate-200">Aktivitas 7 Hari Terakhir</h3>
                </div>
                <div className="flex items-end justify-between h-32 gap-2">
                  {getLast7DaysData().map((item, idx) => {
                    const maxVal = Math.max(5, ...getLast7DaysData().map(d => d.count));
                    const height = (item.count / maxVal) * 100;
                    const isToday = item.date === todayStr;
                    return (
                      <div key={idx} className="flex flex-col items-center gap-2 flex-1 group">
                        <div className="w-full relative h-full flex items-end bg-slate-800/50 rounded-lg overflow-hidden">
                          <div className={`w-full transition-all duration-500 ${isToday ? "bg-blue-500" : "bg-slate-600 group-hover:bg-slate-500"}`} style={{ height: `${height}%` }}></div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase ${isToday ? "text-blue-400" : "text-slate-500"}`}>{item.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* HABIT FREQUENCY CHART */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                 <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="text-green-500 w-5 h-5" />
                  <h3 className="font-bold text-sm text-slate-200">Frekuensi Habit</h3>
                </div>
                <div className="space-y-4">
                  {[...habits]
                    .sort((a,b) => {
                      const countA = logs.filter(l => l.habitId === a.id).length;
                      const countB = logs.filter(l => l.habitId === b.id).length;
                      return countB - countA;
                    })
                    .map(h => {
                      const count = logs.filter(l => l.habitId === h.id).length;
                      const maxCount = Math.max(1, ...habits.map(hb => logs.filter(l => l.habitId === hb.id).length));
                      const width = (count / maxCount) * 100;
                      return (
                        <div key={h.id} className="relative">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="flex items-center gap-2 font-medium">{h.emoji} {h.name}</span>
                            <span className="text-slate-400">{count}x</span>
                          </div>
                          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${width}%` }}/></div>
                        </div>
                      )
                    })}
                  {habits.length === 0 && <p className="text-xs text-slate-500 text-center">Belum ada data habit.</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM NAV */}
        {view !== "add" && view !== "edit" && (
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900/90 backdrop-blur-lg border-t border-white/5 p-4 flex justify-around items-center z-40">
            <button onClick={() => setView("home")} className={`flex flex-col items-center gap-1 ${view === "home" ? "text-blue-400" : "text-slate-500"}`}><Home size={24} strokeWidth={view==="home"?2.5:2} /><span className="text-[10px] font-bold">Home</span></button>
            <button onClick={() => { setHabitForm({id:"",name:"",emoji:"🔥",weeklyTarget:7, dailyTarget:1}); setView("add"); }} className="bg-blue-600 text-white p-4 rounded-full -mt-8 shadow-lg shadow-blue-900/50 hover:scale-105 transition-transform border-4 border-slate-950"><Plus size={24} strokeWidth={3} /></button>
            <button onClick={() => setView("calendar")} className={`flex flex-col items-center gap-1 ${view === "calendar" ? "text-blue-400" : "text-slate-500"}`}><Calendar size={24} strokeWidth={view==="calendar"?2.5:2} /><span className="text-[10px] font-bold">History</span></button>
            <button onClick={() => setView("stats")} className={`flex flex-col items-center gap-1 ${view === "stats" ? "text-blue-400" : "text-slate-500"}`}><BarChart3 size={24} strokeWidth={view==="stats"?2.5:2} /><span className="text-[10px] font-bold">Stats</span></button>
          </div>
        )}

        {/* POPUP CALENDAR */}
        {popupDate && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
              <button onClick={() => setPopupDate(null)} className="absolute right-4 top-4 text-slate-400 hover:text-white"><X size={20}/></button>
              <div className="text-center mb-6"><h3 className="text-xl font-bold text-white">{new Date(popupDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</h3><p className="text-sm text-slate-400">Activity Log</p></div>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {getLogsForDate(popupDate).map((habit: any) => {
                  const count = logs.filter(l => l.habitId === habit.id && l.date === popupDate).length;
                  return (
                  <div key={habit.id} className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center text-xl">{habit.emoji}</div>
                    <div className="flex-1"><p className="font-bold text-sm text-slate-200">{habit.name}</p><p className="text-xs text-green-400 flex items-center gap-1"><Check size={12}/> Done {count} times</p></div>
                  </div>
                )})}
              </div>
              <button onClick={() => setPopupDate(null)} className="w-full mt-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors">Tutup</button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}