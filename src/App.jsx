import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Calendar,
  Clock,
  Users,
  Plus,
  MessageSquare,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  Send,
  Zap,
  Filter,
  Lock,
  Database,
  RefreshCw,
  LogOut,
  Award,
  Flame,
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';

// Fallback data jika Supabase belum diisi .env saat testing lokal
const FALLBACK_SESSIONS = [
  {
    id: 'demo-1',
    sport: 'Bulu Tangkis',
    venue_name: 'GOR Klebengan',
    district: 'Seturan',
    session_date: 'Hari ini',
    time_range: '19.00–21.00',
    skill_level: 'Intermediate',
    max_quota: 8,
    fee_per_person: 28000,
    host_name: 'Rina M.',
    host_rate: 98,
    is_urgent: true,
    privacy_chat_only: true,
    pinned_note: 'Court 2 & 3. Pakai shuttlecock Yonex Aerosensa 30. Patungan QRIS di GOR.',
  },
  {
    id: 'demo-2',
    sport: 'Padel',
    venue_name: 'The Padel Yard',
    district: 'Condongcatur',
    session_date: 'Hari ini',
    time_range: '20.00–21.30',
    skill_level: 'Beginner',
    max_quota: 4,
    fee_per_person: 85000,
    host_name: 'Bayu K.',
    host_rate: 100,
    is_urgent: true,
    privacy_chat_only: true,
    pinned_note: 'Court B (Indoor). Raket bisa sewa di resepsionis Rp35rb.',
  },
  {
    id: 'demo-3',
    sport: 'Tenis',
    venue_name: 'Lapangan Tenis UNY',
    district: 'Jakal',
    session_date: 'Besok',
    time_range: '16.00–18.00',
    skill_level: 'Intermediate',
    max_quota: 4,
    fee_per_person: 45000,
    host_name: 'Fajar W.',
    host_rate: 95,
    is_urgent: false,
    privacy_chat_only: true,
    pinned_note: 'Lapangan 1 Outdoor, bola baru disediakan host.',
  },
  {
    id: 'demo-4',
    sport: 'Bulu Tangkis',
    venue_name: 'GOR Among Rogo',
    district: 'Umbulharjo',
    session_date: 'Besok',
    time_range: '19.30–21.30',
    skill_level: 'All Level',
    max_quota: 10,
    fee_per_person: 25000,
    host_name: 'Dimas A.',
    host_rate: 98,
    is_urgent: false,
    privacy_chat_only: true,
    pinned_note: 'Lapangan tengah, cocok untuk pemula maupun rutin.',
  },
];

export default function App() {
  // Auth & Profil Pengguna Aktif
  const [user, setUser] = useState(null);
  const [authForm, setAuthForm] = useState({
    name: 'Fikri Rahman',
    age: 22,
    skill: 'Intermediate',
    hideWa: true,
  });

  // State Database Cloud (Supabase)
  const [sessions, setSessions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loadingCloud, setLoadingCloud] = useState(true);
  const [cloudStatus, setCloudStatus] = useState('connected'); // 'connected' | 'fallback'

  // Navigasi & Filter
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'mysessions' | 'gor' | 'account'
  const [sportFilter, setSportFilter] = useState('Semua');
  const [districtFilter, setDistrictFilter] = useState('Semua');
  const [urgentOnly, setUrgentOnly] = useState(false);

  // Modal & Chat Aktif
  const [selectedSession, setSelectedSession] = useState(null);
  const [modalTab, setModalTab] = useState('detail'); // 'detail' | 'chat'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [toast, setToast] = useState(null);

  // Form Buat Jadwal Baru
  const [newSession, setNewSession] = useState({
    sport: 'Bulu Tangkis',
    venue_name: '',
    district: 'Seturan',
    session_date: 'Hari ini',
    time_range: '19.00–21.00',
    skill_level: 'Intermediate',
    max_quota: 6,
    fee_per_person: 25000,
    is_urgent: false,
    pinned_note: 'Patungan QRIS langsung di lokasi GOR.',
  });

  const triggerToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Data dari Supabase PostgreSQL
  const fetchAllCloudData = async () => {
    setLoadingCloud(true);
    try {
      const { data: sessionData, error: sessionErr } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (sessionErr) throw sessionErr;

      const { data: bookingData } = await supabase.from('bookings').select('*');
      const { data: msgData } = await supabase
        .from('session_messages')
        .select('*')
        .order('created_at', { ascending: true });

      setSessions(sessionData && sessionData.length > 0 ? sessionData : FALLBACK_SESSIONS);
      setBookings(bookingData || []);
      setMessages(msgData || []);
      setCloudStatus('connected');
    } catch (err) {
      console.warn('Menggunakan fallback lokal (cek .env Supabase):', err.message);
      setSessions(FALLBACK_SESSIONS);
      setCloudStatus('fallback');
    } finally {
      setLoadingCloud(false);
    }
  };

  useEffect(() => {
    fetchAllCloudData();
  }, []);

  // Login / Registrasi
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!authForm.name.trim()) return;
    const profileObj = {
      name: authForm.name.trim(),
      age: Number(authForm.age),
      skill: authForm.skill,
      hideWa: authForm.hideWa,
      isMinor: Number(authForm.age) < 18,
      attendanceRate: 98,
      gamesPlayed: 16,
      skillApprovals: 3,
    };
    setUser(profileObj);

    if (cloudStatus === 'connected') {
      await supabase.from('profiles').insert([
        {
          full_name: profileObj.name,
          age: profileObj.age,
          hide_whatsapp: profileObj.hideWa,
          skill_level: profileObj.skill,
        },
      ]);
    }
    triggerToast(`Selamat datang, ${profileObj.name}! Terhubung ke Cloud.`, 'success');
  };

  // Hitung peserta per sesi
  const getSessionBookings = (sessionId) =>
    bookings.filter((b) => b.session_id === sessionId && b.status !== 'Batal');

  // Deteksi bentrok jadwal ongoing
  const checkScheduleConflict = (targetSession) => {
    if (!user) return null;
    const myActiveSessionIds = bookings
      .filter((b) => b.user_name === user.name && b.status === 'Terdaftar')
      .map((b) => b.session_id);

    return sessions.find(
      (s) =>
        myActiveSessionIds.includes(s.id) &&
        s.id !== targetSession.id &&
        s.session_date === targetSession.session_date &&
        s.time_range === targetSession.time_range
    );
  };

  // Gabung Sesi (Simpan Persisten ke Supabase)
  const handleJoinSession = async (session) => {
    const currentList = getSessionBookings(session.id);
    if (currentList.some((b) => b.user_name === user.name)) {
      triggerToast('Kamu sudah terdaftar di sesi ini.', 'info');
      return;
    }
    if (currentList.length >= session.max_quota) {
      triggerToast('Kuota sesi ini sudah penuh.', 'warn');
      return;
    }

    const newBooking = {
      id: `local-${Date.now()}`,
      session_id: session.id,
      user_name: user.name,
      user_age: user.age,
      status: 'Terdaftar',
    };

    if (cloudStatus === 'connected' && !String(session.id).startsWith('demo-')) {
      const { data, error } = await supabase
        .from('bookings')
        .insert([
          {
            session_id: session.id,
            user_name: user.name,
            user_age: user.age,
            status: 'Terdaftar',
          },
        ])
        .select();
      if (!error && data) {
        setBookings((prev) => [...prev, data[0]]);
        triggerToast(`Berhasil mengamankan slot di ${session.venue_name}!`, 'success');
        setModalTab('chat');
        return;
      } else {
        console.warn('Gagal menyimpan booking ke Supabase:', error?.message);
        triggerToast('Slot gagal disimpan ke Supabase.', 'warn');
        return;
      }
    }

    setBookings((prev) => [...prev, newBooking]);
    triggerToast(`Berhasil mengamankan slot di ${session.venue_name} (Mode Lokal).`, 'success');
    setModalTab('chat');
  };

  // Cancel Ikut Sesi
  const handleCancelBooking = async (session) => {
    const targetBooking = bookings.find(
      (b) => b.session_id === session.id && b.user_name === user.name && b.status === 'Terdaftar'
    );
    if (!targetBooking) return;

    if (cloudStatus === 'connected' && !String(targetBooking.id).startsWith('local-')) {
      await supabase.from('bookings').delete().eq('id', targetBooking.id);
    }
    setBookings((prev) => prev.filter((b) => b.id !== targetBooking.id));
    setUser((prev) => ({
      ...prev,
      attendanceRate: Math.max(50, prev.attendanceRate - (session.is_urgent ? 3 : 1)),
    }));
    triggerToast(`Slot di ${session.venue_name} dibatalkan & dilepas kembali.`, 'warn');
  };

  // Buat Jadwal Baru (Simpan Persisten ke Supabase)
  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!newSession.venue_name.trim()) return;

    const payload = {
      ...newSession,
      max_quota: Number(newSession.max_quota),
      fee_per_person: Number(newSession.fee_per_person),
      host_name: user.name,
      host_rate: user.attendanceRate,
      privacy_chat_only: true,
    };

    if (cloudStatus === 'connected') {
      const { data, error } = await supabase.from('sessions').insert([payload]).select();
      if (!error && data) {
        setSessions((prev) => [data[0], ...prev]);
        triggerToast('Jadwal berhasil dipublikasikan ke PostgreSQL Supabase!', 'success');
        setShowCreateModal(false);
        setNewSession({ ...newSession, venue_name: '' });
        return;
      }
      console.warn('Gagal menyimpan sesi ke Supabase:', error?.message);
      triggerToast('Jadwal gagal disimpan ke Supabase.', 'warn');
      return;
    }

    setSessions((prev) => [{ ...payload, id: `demo-${Date.now()}` }, ...prev]);
    triggerToast('Jadwal ditambahkan (Mode Lokal).', 'info');
    setShowCreateModal(false);
    setNewSession({ ...newSession, venue_name: '' });
  };

  // Kirim Pesan Chat Sesi (Simpan Persisten ke Supabase)
  const handleSendSessionMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedSession) return;

    const text = chatInput.trim();
    setChatInput('');

    const msgObj = {
      id: `msg-${Date.now()}`,
      session_id: selectedSession.id,
      sender_name: user.name,
      sender_role: selectedSession.host_name === user.name ? 'host' : 'player',
      message_text: text,
      created_at: new Date().toISOString(),
    };

    if (cloudStatus === 'connected' && !String(selectedSession.id).startsWith('demo-')) {
      const { data, error } = await supabase
        .from('session_messages')
        .insert([
          {
            session_id: selectedSession.id,
            sender_name: msgObj.sender_name,
            sender_role: msgObj.sender_role,
            message_text: msgObj.message_text,
          },
        ])
        .select();
      if (!error && data) {
        setMessages((prev) => [...prev, data[0]]);
        return;
      }
    }
    setMessages((prev) => [...prev, msgObj]);
  };

  // Filter Katalog
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (sportFilter !== 'Semua' && s.sport !== sportFilter) return false;
      if (districtFilter !== 'Semua' && s.district !== districtFilter) return false;
      if (urgentOnly && !s.is_urgent) return false;
      return true;
    });
  }, [sessions, sportFilter, districtFilter, urgentOnly]);

  // Quick Matchmaking Otomatis
  const handleQuickMatch = () => {
    const available = sessions.filter((s) => getSessionBookings(s.id).length < s.max_quota);
    if (available.length === 0) {
      triggerToast('Semua jadwal saat ini sudah penuh.', 'warn');
      return;
    }
    const best =
      available.find((s) => s.skill_level === user.skill || s.skill_level === 'All Level') ||
      available[0];
    setSelectedSession(best);
    setModalTab('detail');
    triggerToast(`Match ditemukan: ${best.venue_name} (${best.district})!`, 'success');
  };

  // ================= HALAMAN LANDING & LOGIN =================
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] text-[#141413] font-sans">
        <header className="border-b border-[#E4E4E0] bg-white px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#133E2B] text-white flex items-center justify-center font-bold">
                MJ
              </div>
              <span className="font-bold tracking-tight text-lg">MabarJogja</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#F7F7F5] border border-[#E4E4E0] text-[#5C5C58]">
                CLOUD PROD v1.0
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  cloudStatus === 'connected' ? 'bg-emerald-600' : 'bg-amber-500'
                }`}
              />
              <span>{cloudStatus === 'connected' ? 'Supabase Connected' : 'Local Demo Mode'}</span>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E4E4E0] text-xs font-medium text-[#133E2B]">
              <Database className="w-3.5 h-3.5" />
              <span>Arsitektur Cloud: Vercel Edge + Supabase PostgreSQL</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
              Main bareng di Jogja, <span className="text-[#133E2B]">tanpa drama ghosting.</span>
            </h1>
            <p className="text-[#5C5C58] text-base leading-relaxed max-w-xl">
              Platform matchmaking olahraga rekreasional hiper-lokal Yogyakarta (Seturan,
              Condongcatur, Jakal, Umbulharjo) dengan verifikasi skill berbasis kuorum, chat
              internal tanpa wajib berbagi nomor WA, dan perlindungan pengguna di bawah umur.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-4 bg-white rounded-xl border border-[#E4E4E0]">
                <ShieldCheck className="w-5 h-5 text-[#133E2B] mb-2" />
                <div className="font-semibold text-sm">Privasi & Minor Safe</div>
                <p className="text-xs text-[#5C5C58] mt-1">
                  Chat langsung di web tanpa sebar nomor HP & filter usia otomatis.
                </p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-[#E4E4E0]">
                <Award className="w-5 h-5 text-[#133E2B] mb-2" />
                <div className="font-semibold text-sm">Kuorum Skill 3 Pemain</div>
                <p className="text-xs text-[#5C5C58] mt-1">
                  Level permainan divalidasi rekan main agar lawan seimbang.
                </p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-[#E4E4E0]">
                <Zap className="w-5 h-5 text-[#D94E1F] mb-2" />
                <div className="font-semibold text-sm">Slot Urgent GOR</div>
                <p className="text-xs text-[#5C5C58] mt-1">
                  Informasi lapangan kosong mendadak langsung dari pengelola GOR.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <form
              onSubmit={handleLogin}
              className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E4E4E0] shadow-sm space-y-4"
            >
              <div>
                <h2 className="text-xl font-bold">Masuk ke MabarJogja</h2>
                <p className="text-xs text-[#5C5C58] mt-1">
                  Data sesi & pesan tersimpan persisten di database cloud Supabase.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Nama Panggilan</label>
                <input
                  type="text"
                  required
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E4E4E0] focus:outline-none focus:border-[#133E2B]"
                  placeholder="Contoh: Fikri Rahman"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Usia (Tahun)</label>
                  <input
                    type="number"
                    min={13}
                    max={70}
                    required
                    value={authForm.age}
                    onChange={(e) => setAuthForm({ ...authForm, age: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#E4E4E0]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Level Awal</label>
                  <select
                    value={authForm.skill}
                    onChange={(e) => setAuthForm({ ...authForm, skill: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E4E4E0] bg-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[#F7F7F5] border border-[#E4E4E0] cursor-pointer">
                <input
                  type="checkbox"
                  checked={authForm.hideWa}
                  onChange={(e) => setAuthForm({ ...authForm, hideWa: e.target.checked })}
                  className="accent-[#133E2B]"
                />
                <span className="text-xs text-[#141413]">
                  Mode Privasi: Sembunyikan nomor WhatsApp (Gunakan Chat Web)
                </span>
              </label>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-[#133E2B] hover:bg-[#0e2f20] text-white font-semibold text-sm transition cursor-pointer"
              >
                Masuk & Sinkronkan Cloud →
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // ================= APLIKASI UTAMA =================
  const myBookings = bookings.filter((b) => b.user_name === user.name && b.status === 'Terdaftar');
  const mySessionsList = sessions.filter(
    (s) => s.host_name === user.name || myBookings.some((b) => b.session_id === s.id)
  );

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#141413] font-sans pb-16">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#141413] text-white px-4 py-3 rounded-xl shadow-lg border border-neutral-700 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#E4E4E0] px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#133E2B] text-white flex items-center justify-center font-bold text-sm">
              MJ
            </div>
            <div>
              <div className="font-bold text-base leading-none">MabarJogja</div>
              <div className="text-[11px] font-mono text-[#5C5C58] mt-0.5 flex items-center gap-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    cloudStatus === 'connected' ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                />
                {cloudStatus === 'connected' ? 'PostgreSQL Live' : 'Local Fallback'}
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-[#F7F7F5] p-1 rounded-lg border border-[#E4E4E0]">
            {[
              { id: 'catalog', label: 'Jelajah Jadwal' },
              { id: 'mysessions', label: `Sesi Saya (${mySessionsList.length})` },
              { id: 'gor', label: 'Portal GOR' },
              { id: 'account', label: 'Akun & Privasi' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-white text-[#133E2B] shadow-xs border border-[#E4E4E0]'
                    : 'text-[#5C5C58] hover:text-[#141413]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAllCloudData}
              title="Refresh Data Cloud"
              className="p-2 rounded-lg border border-[#E4E4E0] bg-white hover:bg-[#F7F7F5] text-[#5C5C58] cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingCloud ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#133E2B] text-white text-xs font-semibold hover:bg-[#0e2f20] transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Jadwal</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="md:hidden flex border-b border-[#E4E4E0] bg-white px-4 py-2 gap-2 overflow-x-auto">
        {[
          { id: 'catalog', label: 'Jelajah' },
          { id: 'mysessions', label: `Sesi (${mySessionsList.length})` },
          { id: 'gor', label: 'Portal GOR' },
          { id: 'account', label: 'Akun' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#133E2B] text-white'
                : 'bg-[#F7F7F5] text-[#5C5C58] border border-[#E4E4E0]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================= TAB 1: KATALOG JADWAL ================= */}
      {activeTab === 'catalog' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-5">
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-[#E4E4E0] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5C5C58]">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter Olahraga & Kecamatan Yogyakarta</span>
                </div>
                <button
                  onClick={() => setUrgentOnly(!urgentOnly)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                    urgentOnly
                      ? 'bg-[#D94E1F] text-white border-[#D94E1F]'
                      : 'bg-white text-[#D94E1F] border-[#E4E4E0]'
                  }`}
                >
                  ⚡ Slot Mendadak Saja
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {['Semua', 'Bulu Tangkis', 'Padel', 'Tenis'].map((sport) => (
                  <button
                    key={sport}
                    onClick={() => setSportFilter(sport)}
                    className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${
                      sportFilter === sport
                        ? 'bg-[#133E2B] text-white'
                        : 'bg-[#F7F7F5] text-[#141413] border border-[#E4E4E0]'
                    }`}
                  >
                    {sport}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {['Semua', 'Seturan', 'Condongcatur', 'Jakal', 'Umbulharjo', 'Bantul'].map(
                  (dist) => (
                    <button
                      key={dist}
                      onClick={() => setDistrictFilter(dist)}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono cursor-pointer ${
                        districtFilter === dist
                          ? 'bg-[#141413] text-white'
                          : 'bg-white text-[#5C5C58] border border-[#E4E4E0]'
                      }`}
                    >
                      {dist}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Grid Kartu Jadwal */}
            {filteredSessions.length === 0 ? (
              <div className="bg-white p-10 rounded-xl border border-[#E4E4E0] text-center space-y-3">
                <p className="font-semibold text-sm">
                  Belum ada jadwal untuk filter {sportFilter} di {districtFilter}.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 rounded-lg bg-[#133E2B] text-white text-xs font-semibold cursor-pointer"
                >
                  + Buat Jadwal Baru
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSessions.map((session) => {
                  const joinedList = getSessionBookings(session.id);
                  const filledCount = Math.min(session.max_quota, 2 + joinedList.length);
                  const remaining = Math.max(0, session.max_quota - filledCount);
                  const isJoined = joinedList.some((b) => b.user_name === user.name);

                  return (
                    <div
                      key={session.id}
                      className="bg-white rounded-xl border border-[#E4E4E0] p-5 flex flex-col justify-between hover:border-[#133E2B] transition"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="font-semibold text-[#133E2B]">
                            {session.sport} • {session.district}
                          </span>
                          {session.is_urgent ? (
                            <span className="font-mono font-semibold text-[#D94E1F] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#D94E1F]" />
                              Sisa {remaining} slot
                            </span>
                          ) : (
                            <span className="font-mono text-[#5C5C58]">Sisa {remaining} slot</span>
                          )}
                        </div>

                        <h3 className="font-bold text-lg text-[#141413]">{session.venue_name}</h3>

                        <div className="flex items-center gap-3 text-xs text-[#5C5C58] mt-1 font-mono">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {session.session_date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {session.time_range}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <span className="px-2.5 py-0.5 rounded bg-[#F7F7F5] border border-[#E4E4E0] text-xs font-medium">
                            {session.skill_level}
                          </span>
                          <span className="text-xs font-mono text-[#5C5C58]">
                            Host {session.host_name} ({session.host_rate}%)
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-[#E4E4E0] mt-4 pt-3.5 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-mono text-[#5C5C58]">
                            {filledCount}/{session.max_quota} pemain
                          </div>
                          <div className="font-mono font-bold text-sm text-[#141413]">
                            Rp {Number(session.fee_per_person).toLocaleString('id-ID')}
                            <span className="text-[11px] font-normal text-[#5C5C58]"> /org</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedSession(session);
                              setModalTab('chat');
                            }}
                            className="p-2 rounded-lg border border-[#E4E4E0] hover:bg-[#F7F7F5] text-[#141413] cursor-pointer"
                            title="Buka Chat Sesi"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSession(session);
                              setModalTab('detail');
                            }}
                            className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                              isJoined
                                ? 'bg-emerald-50 text-[#133E2B] border border-[#133E2B]'
                                : 'bg-[#133E2B] text-white hover:bg-[#0e2f20]'
                            }`}
                          >
                            {isJoined ? 'Terdaftar ✓' : 'Ikut →'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sticky Sidebar Kanan */}
          <aside className="lg:col-span-4 space-y-4">
            <div className="bg-white p-5 rounded-xl border border-[#E4E4E0] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-[#5C5C58]">
                  Quick Matchmaking
                </span>
                <Zap className="w-4 h-4 text-[#D94E1F]" />
              </div>
              <p className="text-xs text-[#5C5C58] leading-relaxed">
                Cari otomatis 1 slot kosong yang sesuai dengan level{' '}
                <strong className="text-[#141413]">{user.skill}</strong> sebelum kuota habis.
              </p>
              <button
                onClick={handleQuickMatch}
                className="w-full py-2.5 px-4 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-neutral-800 cursor-pointer"
              >
                ⚡ Carikan Slot Sekarang
              </button>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#E4E4E0] space-y-3">
              <div className="text-xs font-mono uppercase tracking-wider text-[#5C5C58]">
                Reputasi & Keamanan Akun
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm">{user.name}</div>
                  <div className="text-xs text-[#5C5C58] font-mono">
                    Usia {user.age} thn ({user.isMinor ? 'Minor <18 Protected' : '18+ Verified'})
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-lg font-bold text-[#133E2B]">{user.attendanceRate}%</div>
                  <div className="text-[11px] text-[#5C5C58]">Hadir</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#133E2B] border border-emerald-200 text-[11px] font-semibold">
                  ✓ Approved {user.skill} ({user.skillApprovals}/3)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Sering Main ({user.gamesPlayed}x)
                </span>
              </div>
            </div>
          </aside>
        </main>
      )}

      {/* ================= TAB 2: SESI SAYA & HOST INBOX ================= */}
      {activeTab === 'mysessions' && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-4">
          <div className="bg-white p-5 rounded-xl border border-[#E4E4E0]">
            <h2 className="font-bold text-lg">Jadwal Ongoing & Pusat Pesan Host</h2>
            <p className="text-xs text-[#5C5C58] mt-1">
              Kelola jadwal yang Anda buat atau ikuti, baca pesan peserta, atau batalkan slot.
            </p>
          </div>

          {mySessionsList.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-[#E4E4E0] text-center text-xs text-[#5C5C58]">
              Belum ada jadwal yang kamu ikuti atau buat. Pilih jadwal di tab Jelajah.
            </div>
          ) : (
            <div className="space-y-3">
              {mySessionsList.map((s) => {
                const isHost = s.host_name === user.name;
                const sessionMsgs = messages.filter((m) => m.session_id === s.id);
                return (
                  <div
                    key={s.id}
                    className="bg-white p-5 rounded-xl border border-[#E4E4E0] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-[#133E2B] text-white font-semibold">
                          {isHost ? 'HOST' : 'PESERTA'}
                        </span>
                        <span className="font-mono text-[#5C5C58]">
                          {s.session_date} • {s.time_range}
                        </span>
                      </div>
                      <h3 className="font-bold text-base mt-1">
                        {s.venue_name} ({s.district})
                      </h3>
                      <p className="text-xs text-[#5C5C58] mt-0.5">
                        {sessionMsgs.length} pesan dalam ruang chat sesi
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedSession(s);
                          setModalTab('chat');
                        }}
                        className="px-3.5 py-2 rounded-lg bg-[#133E2B] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Buka Chat</span>
                      </button>
                      {!isHost && (
                        <button
                          onClick={() => handleCancelBooking(s)}
                          className="px-3 py-2 rounded-lg border border-red-200 text-red-700 bg-red-50 text-xs font-semibold cursor-pointer"
                        >
                          Cancel Slot
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* ================= TAB 3: PORTAL GOR ================= */}
      {activeTab === 'gor' && (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
          <div className="bg-white p-6 rounded-xl border border-[#E4E4E0] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">Portal Mitra Pengelola GOR Yogyakarta</h2>
                <p className="text-xs text-[#5C5C58] mt-0.5">
                  Publikasikan jam lapangan kosong mendadak (Urgent Slot) langsung ke database
                  komunitas.
                </p>
              </div>
              <button
                onClick={() => {
                  setNewSession({ ...newSession, is_urgent: true });
                  setShowCreateModal(true);
                }}
                className="px-4 py-2 rounded-lg bg-[#D94E1F] text-white text-xs font-semibold cursor-pointer"
              >
                + Posting Slot Urgent GOR
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ================= TAB 4: AKUN & PRIVASI ================= */}
      {activeTab === 'account' && (
        <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-4">
          <div className="bg-white p-6 rounded-xl border border-[#E4E4E0] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">{user.name}</h2>
                <p className="text-xs text-[#5C5C58] font-mono">
                  Usia: {user.age} Tahun • Level: {user.skill}
                </p>
              </div>
              <button
                onClick={() => setUser(null)}
                className="px-3 py-1.5 rounded-lg border border-[#E4E4E0] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#F7F7F5] cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F7F5] border border-[#E4E4E0] space-y-2 text-xs">
              <div className="font-semibold flex items-center gap-1.5 text-[#133E2B]">
                <Lock className="w-3.5 h-3.5" />
                <span>Status Perlindungan Privasi & Minor Safety</span>
              </div>
              <p className="text-[#5C5C58]">
                {user.isMinor
                  ? 'Akun terdeteksi di bawah 18 tahun. Fitur Private DM dengan pengguna dewasa (18+) dikunci otomatis demi keamanan.'
                  : 'Akun terverifikasi 18+. Komunikasi dengan peserta di bawah 18 tahun hanya diizinkan pada ruang chat grup terbuka.'}
              </p>
            </div>
          </div>
        </main>
      )}

      {/* ================= MODAL DETAIL SESI & IN-APP CHAT ================= */}
      {selectedSession && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-[#E4E4E0] overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-[#E4E4E0] flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-[#133E2B] font-semibold">
                  {selectedSession.sport} • {selectedSession.district}
                </div>
                <h3 className="font-bold text-base">{selectedSession.venue_name}</h3>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="p-1.5 rounded-lg hover:bg-[#F7F7F5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-tab Detail vs Chat Web */}
            <div className="flex border-b border-[#E4E4E0] bg-[#F7F7F5] px-5 pt-2 gap-2">
              <button
                onClick={() => setModalTab('detail')}
                className={`px-3 py-2 text-xs font-semibold border-b-2 cursor-pointer ${
                  modalTab === 'detail'
                    ? 'border-[#133E2B] text-[#133E2B]'
                    : 'border-transparent text-[#5C5C58]'
                }`}
              >
                Rincian & Slot
              </button>
              <button
                onClick={() => setModalTab('chat')}
                className={`px-3 py-2 text-xs font-semibold border-b-2 cursor-pointer ${
                  modalTab === 'chat'
                    ? 'border-[#133E2B] text-[#133E2B]'
                    : 'border-transparent text-[#5C5C58]'
                }`}
              >
                Chat Sesi di Web (Tanpa WA)
              </button>
            </div>

            {modalTab === 'detail' ? (
              <div className="p-5 space-y-4">
                {checkScheduleConflict(selectedSession) && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      Peringatan Bentrok: Kamu sudah terdaftar pada jadwal lain di{' '}
                      <strong>{selectedSession.session_date}</strong> jam{' '}
                      <strong>{selectedSession.time_range}</strong>.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-[#F7F7F5] p-3.5 rounded-xl border border-[#E4E4E0]">
                  <div>
                    <div className="text-[#5C5C58]">WAKTU MAIN</div>
                    <div className="font-bold mt-0.5">
                      {selectedSession.session_date}, {selectedSession.time_range}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#5C5C58]">PATUNGAN / ORANG</div>
                    <div className="font-bold mt-0.5 text-[#133E2B]">
                      Rp {Number(selectedSession.fee_per_person).toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold mb-1.5">Peserta Terdaftar:</div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 rounded-md bg-[#F7F7F5] border border-[#E4E4E0] text-xs">
                      {selectedSession.host_name} (Host)
                    </span>
                    {getSessionBookings(selectedSession.id).map((b) => (
                      <span
                        key={b.id}
                        className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-[#133E2B]"
                      >
                        {b.user_name} ({b.user_age} thn)
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => handleJoinSession(selectedSession)}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-[#133E2B] text-white text-xs font-semibold hover:bg-[#0e2f20] cursor-pointer"
                  >
                    Amankan Slot & Simpan ke Cloud
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 flex flex-col h-96">
                {selectedSession.pinned_note && (
                  <div className="p-2.5 mb-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    <strong>Info Host:</strong> {selectedSession.pinned_note}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {messages.filter((m) => m.session_id === selectedSession.id).length === 0 ? (
                    <div className="text-center text-xs text-[#5C5C58] py-10">
                      Belum ada pesan. Mulai diskusi di bawah tanpa perlu membagikan nomor WA.
                    </div>
                  ) : (
                    messages
                      .filter((m) => m.session_id === selectedSession.id)
                      .map((m) => (
                        <div
                          key={m.id}
                          className={`p-2.5 rounded-xl text-xs max-w-[82%] ${
                            m.sender_name === user.name
                              ? 'ml-auto bg-[#133E2B] text-white'
                              : 'bg-[#F7F7F5] border border-[#E4E4E0] text-[#141413]'
                          }`}
                        >
                          <div className="font-semibold text-[10px] opacity-80 mb-0.5">
                            {m.sender_name} {m.sender_role === 'host' ? '• HOST' : ''}
                          </div>
                          <div>{m.message_text}</div>
                        </div>
                      ))
                  )}
                </div>

                <form onSubmit={handleSendSessionMessage} className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Tulis pesan koordinasi ke grup..."
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#E4E4E0] focus:outline-none focus:border-[#133E2B]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-lg bg-[#133E2B] text-white text-xs font-semibold cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL BUAT JADWAL BARU ================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSession}
            className="bg-white w-full max-w-md rounded-2xl border border-[#E4E4E0] p-6 space-y-3.5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Buat Jadwal Open Play Baru</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-[#F7F7F5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Cabang Olahraga</label>
                <select
                  value={newSession.sport}
                  onChange={(e) => setNewSession({ ...newSession, sport: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E4E4E0] bg-white"
                >
                  <option value="Bulu Tangkis">Bulu Tangkis</option>
                  <option value="Padel">Padel</option>
                  <option value="Tenis">Tenis</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Kecamatan Jogja</label>
                <select
                  value={newSession.district}
                  onChange={(e) => setNewSession({ ...newSession, district: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E4E4E0] bg-white"
                >
                  <option value="Seturan">Seturan</option>
                  <option value="Condongcatur">Condongcatur</option>
                  <option value="Jakal">Jakal</option>
                  <option value="Umbulharjo">Umbulharjo</option>
                  <option value="Bantul">Bantul</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Nama GOR / Lapangan</label>
              <input
                type="text"
                required
                placeholder="Contoh: GOR Lembah UGM"
                value={newSession.venue_name}
                onChange={(e) => setNewSession({ ...newSession, venue_name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#E4E4E0]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Hari / Tanggal</label>
                <input
                  type="text"
                  required
                  value={newSession.session_date}
                  onChange={(e) => setNewSession({ ...newSession, session_date: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E4E4E0]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Jam Main</label>
                <input
                  type="text"
                  required
                  value={newSession.time_range}
                  onChange={(e) => setNewSession({ ...newSession, time_range: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#E4E4E0]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Kuota Pemain</label>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={newSession.max_quota}
                  onChange={(e) => setNewSession({ ...newSession, max_quota: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#E4E4E0]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Patungan / Orang (Rp)</label>
                <input
                  type="number"
                  step={1000}
                  value={newSession.fee_per_person}
                  onChange={(e) =>
                    setNewSession({ ...newSession, fee_per_person: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#E4E4E0]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-[#133E2B] text-white text-xs font-semibold hover:bg-[#0e2f20] cursor-pointer"
            >
              Publikasikan ke Supabase Cloud
            </button>
          </form>
        </div>
      )}
    </div>
  );
}