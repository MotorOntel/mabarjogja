import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
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
  Trash2,
  UserPlus,
  ShieldAlert,
  Users,
  WifiOff,
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';

export default function App() {
  // Session Pengguna Aktif (Disimpan di sessionStorage per tab)
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('mabarjogja_prod_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Mode Auth di Landing Page: 'login' | 'register'
  const [authMode, setAuthMode] = useState('login');
  const [loginForm, setLoginForm] = useState({ username: '', pin_code: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '',
    full_name: '',
    pin_code: '',
    age: 21,
    skill_level: 'Intermediate',
    hide_whatsapp: true,
  });

  // State Database PostgreSQL Live
  const [profiles, setProfiles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loadingCloud, setLoadingCloud] = useState(true);
  const [cloudError, setCloudError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Navigasi & Filter
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'mysessions' | 'admin' | 'account'
  const [sportFilter, setSportFilter] = useState('Semua');
  const [districtFilter, setDistrictFilter] = useState('Semua');
  const [urgentOnly, setUrgentOnly] = useState(false);

  // Modal & Chat
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [modalTab, setModalTab] = useState('detail');
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
    pinned_note: '',
  });

  // Form Root Create Admin
  const [newAdminForm, setNewAdminForm] = useState({
    username: '',
    full_name: '',
    pin_code: '',
  });

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Sinkronisasi Penuh dengan Supabase PostgreSQL
  const fetchAllCloudData = async () => {
    setLoadingCloud(true);
    setCloudError(null);
    try {
      const [resProf, resSess, resBook, resMsg] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('sessions').select('*').order('created_at', { ascending: false }),
        supabase.from('bookings').select('*').order('created_at', { ascending: true }),
        supabase.from('session_messages').select('*').order('created_at', { ascending: true }),
      ]);

      if (resProf.error) throw resProf.error;
      if (resSess.error) throw resSess.error;
      if (resBook.error) throw resBook.error;
      if (resMsg.error) throw resMsg.error;

      setProfiles(resProf.data || []);
      setSessions(resSess.data || []);
      setBookings(resBook.data || []);
      setMessages(resMsg.data || []);
    } catch (err) {
      setCloudError(err.message || 'Gagal terhubung ke database Supabase.');
    } finally {
      setLoadingCloud(false);
    }
  };

  useEffect(() => {
    fetchAllCloudData();

    const channel = supabase
      .channel('mabarjogja-prod-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () =>
        fetchAllCloudData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () =>
        fetchAllCloudData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () =>
        fetchAllCloudData()
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'session_messages' }, (payload) => {
        setMessages((prev) =>
          prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ================= AUTH: LOGIN & CREATE USER =================
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', loginForm.username.trim().toLowerCase())
        .eq('pin_code', loginForm.pin_code.trim())
        .single();

      if (error || !data) {
        triggerToast('Username atau PIN salah! Periksa kembali kredensial Anda.');
        setSubmitting(false);
        return;
      }

      sessionStorage.setItem('mabarjogja_prod_user', JSON.stringify(data));
      setUser(data);
      setActiveTab(data.role === 'root' || data.role === 'admin' ? 'admin' : 'catalog');
      triggerToast(`Login berhasil sebagai ${data.full_name} (${data.role.toUpperCase()}).`);
    } catch (err) {
      triggerToast(`Error login: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterUser = async (e) => {
    e.preventDefault();
    const cleanUsername = registerForm.username.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanUsername || !registerForm.full_name.trim() || !registerForm.pin_code.trim()) return;

    setSubmitting(true);
    try {
      const payload = {
        username: cleanUsername,
        full_name: registerForm.full_name.trim(),
        pin_code: registerForm.pin_code.trim(),
        role: 'user',
        age: Number(registerForm.age),
        hide_whatsapp: registerForm.hide_whatsapp,
        skill_level: registerForm.skill_level,
      };

      const { data, error } = await supabase.from('profiles').insert([payload]).select().single();
      if (error) {
        if (error.code === '23505') {
          triggerToast('Username sudah dipakai pengguna lain. Gunakan username lain.');
        } else {
          throw error;
        }
        setSubmitting(false);
        return;
      }

      sessionStorage.setItem('mabarjogja_prod_user', JSON.stringify(data));
      setUser(data);
      setActiveTab('catalog');
      triggerToast(`Akun baru @${data.username} berhasil dibuat & disimpan di Cloud!`);
    } catch (err) {
      triggerToast(`Gagal registrasi: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('mabarjogja_prod_user');
    setUser(null);
    setSelectedSessionId(null);
  };

  // ================= ROOT & ADMIN ACTIONS =================
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (user?.role !== 'root') return;
    const cleanUsername = newAdminForm.username.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanUsername || !newAdminForm.full_name.trim() || !newAdminForm.pin_code.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('profiles').insert([
        {
          username: cleanUsername,
          full_name: newAdminForm.full_name.trim(),
          pin_code: newAdminForm.pin_code.trim(),
          role: 'admin',
          age: 23,
          skill_level: 'Advanced',
        },
      ]);

      if (error) throw error;
      setNewAdminForm({ username: '', full_name: '', pin_code: '' });
      await fetchAllCloudData();
      triggerToast(`Akun Admin baru (@${cleanUsername}) berhasil dibuat oleh Root!`);
    } catch (err) {
      triggerToast(`Gagal membuat admin: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (targetProfile) => {
    if (targetProfile.role === 'root') {
      triggerToast('Akun ROOT tidak dapat dihapus.');
      return;
    }
    if (user.role === 'admin' && targetProfile.role === 'admin') {
      triggerToast('Admin tidak dapat menghapus sesama Admin. Hanya Root yang berhak.');
      return;
    }

    setSubmitting(true);
    try {
      // Hapus booking & sesi milik user tersebut terlebih dahulu agar bersih
      await supabase.from('bookings').delete().eq('user_username', targetProfile.username);
      await supabase.from('sessions').delete().eq('host_username', targetProfile.username);
      const { error } = await supabase.from('profiles').delete().eq('id', targetProfile.id);

      if (error) throw error;
      await fetchAllCloudData();
      triggerToast(`Akun @${targetProfile.username} berhasil dihapus permanen dari Cloud.`);

      // Jika user menghapus akunnya sendiri
      if (targetProfile.username === user.username) {
        handleLogout();
      }
    } catch (err) {
      triggerToast(`Gagal menghapus pengguna: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ================= SESSION & BOOKING ACTIONS =================
  const getSessionBookings = (sessionId) =>
    bookings.filter((b) => b.session_id === sessionId && b.status !== 'Batal');

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

  // Hapus Sesi (Oleh Host Pemilik Jadwal, Admin, atau Root)
  const handleDeleteSession = async (session) => {
    const canDelete =
      session.host_username === user.username || user.role === 'admin' || user.role === 'root';
    if (!canDelete) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('sessions').delete().eq('id', session.id);
      if (error) throw error;

      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      if (selectedSessionId === session.id) setSelectedSessionId(null);
      triggerToast(`Sesi "${session.venue_name}" telah dihapus permanen oleh ${user.full_name}.`);
    } catch (err) {
      triggerToast(`Gagal menghapus sesi: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const checkScheduleConflict = (targetSession) => {
    if (!user || !targetSession) return null;
    const myActiveIds = bookings
      .filter((b) => b.user_username === user.username && b.status === 'Terdaftar')
      .map((b) => b.session_id);

    return sessions.find(
      (s) =>
        (myActiveIds.includes(s.id) || s.host_username === user.username) &&
        s.id !== targetSession.id &&
        s.session_date.toLowerCase() === targetSession.session_date.toLowerCase() &&
        s.time_range === targetSession.time_range
    );
  };

  const handleJoinSession = async (session) => {
    if (session.host_username === user.username) {
      triggerToast('Kamu adalah Host pembuat jadwal ini.');
      return;
    }
    const currentList = getSessionBookings(session.id);
    if (currentList.some((b) => b.user_username === user.username)) {
      triggerToast('Kamu sudah terdaftar di sesi ini.');
      return;
    }
    if (1 + currentList.length >= session.max_quota) {
      triggerToast('Kuota sesi sudah penuh.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert([
          {
            session_id: session.id,
            user_username: user.username,
            user_name: user.full_name,
            user_age: user.age,
            status: 'Terdaftar',
          },
        ])
        .select();

      if (error) throw error;
      if (data) setBookings((prev) => [...prev, data[0]]);
      triggerToast(`Berhasil mengamankan slot di ${session.venue_name}!`);
      setModalTab('chat');
    } catch (err) {
      triggerToast(`Gagal bergabung: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async (session) => {
    const target = bookings.find(
      (b) =>
        b.session_id === session.id &&
        b.user_username === user.username &&
        b.status === 'Terdaftar'
    );
    if (!target) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', target.id);
      if (error) throw error;
      setBookings((prev) => prev.filter((b) => b.id !== target.id));
      triggerToast(`Partisipasi di ${session.venue_name} dibatalkan.`);
    } catch (err) {
      triggerToast(`Gagal membatalkan: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!newSession.venue_name.trim()) return;
    setSubmitting(true);

    const payload = {
      sport: newSession.sport,
      venue_name: newSession.venue_name.trim(),
      district: newSession.district,
      session_date: newSession.session_date.trim(),
      time_range: newSession.time_range.trim(),
      skill_level: newSession.skill_level,
      max_quota: Number(newSession.max_quota),
      fee_per_person: Number(newSession.fee_per_person),
      host_username: user.username,
      host_name: user.full_name,
      host_rate: user.attendance_rate || 100,
      is_urgent: newSession.is_urgent,
      pinned_note: newSession.pinned_note.trim() || null,
    };

    try {
      const { data, error } = await supabase.from('sessions').insert([payload]).select();
      if (error) throw error;
      if (data) setSessions((prev) => [data[0], ...prev]);
      triggerToast('Jadwal mabar berhasil dipublikasikan ke Cloud!');
      setShowCreateModal(false);
      setNewSession({ ...newSession, venue_name: '', pinned_note: '' });
    } catch (err) {
      triggerToast(`Gagal membuat jadwal: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedSession) return;
    const text = chatInput.trim();
    setChatInput('');

    try {
      const { data, error } = await supabase
        .from('session_messages')
        .insert([
          {
            session_id: selectedSession.id,
            sender_username: user.username,
            sender_name: user.full_name,
            sender_role:
              selectedSession.host_username === user.username ? 'host' : user.role,
            message_text: text,
          },
        ])
        .select();

      if (error) throw error;
      if (data) {
        setMessages((prev) => (prev.some((m) => m.id === data[0].id) ? prev : [...prev, data[0]]));
      }
    } catch (err) {
      triggerToast(`Gagal mengirim pesan: ${err.message}`);
    }
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (sportFilter !== 'Semua' && s.sport !== sportFilter) return false;
      if (districtFilter !== 'Semua' && s.district !== districtFilter) return false;
      if (urgentOnly && !s.is_urgent) return false;
      return true;
    });
  }, [sessions, sportFilter, districtFilter, urgentOnly]);

  const handleQuickMatch = () => {
    const available = sessions.filter(
      (s) =>
        s.host_username !== user.username && 1 + getSessionBookings(s.id).length < s.max_quota
    );
    if (available.length === 0) {
      triggerToast('Belum ada slot terbuka dari pengguna lain.');
      return;
    }
    const best =
      available.find((s) => s.skill_level === user.skill_level || s.skill_level === 'All Level') ||
      available[0];
    setSelectedSessionId(best.id);
    setModalTab('detail');
    triggerToast(`Slot cocok ditemukan: ${best.venue_name}!`);
  };

  // ================= HALAMAN LANDING & LOGIN / CREATE USER =================
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
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[#133E2B]">
                PRODUCTION v2.0
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  cloudError ? 'bg-red-600' : 'bg-emerald-600 animate-pulse'
                }`}
              />
              <span>{cloudError ? 'Database Offline' : 'Supabase Live Ready'}</span>
            </div>
          </div>
        </header>

        {cloudError && (
          <div className="max-w-6xl mx-auto px-6 pt-6">
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2.5">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>{cloudError}</span>
            </div>
          </div>
        )}

        <main className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E4E4E0] text-xs font-medium text-[#133E2B]">
              <Database className="w-3.5 h-3.5" />
              <span>Multi-Role Cloud System • Root, Admin & User</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
              Main bareng di Jogja, <span className="text-[#133E2B]">terkelola & aman.</span>
            </h1>
            <p className="text-[#5C5C58] text-base leading-relaxed max-w-xl">
              Sistem produksi penuh di atas Vercel & Supabase PostgreSQL. Dukung registrasi akun
              pengguna baru, manajemen jadwal oleh Host, serta panel pemantauan sistem oleh Root &
              Admin.
            </p>
            <div className="p-4 rounded-xl bg-white border border-[#E4E4E0] text-xs space-y-1 max-w-md">
              <div className="font-bold text-[#133E2B]">Info Akses Super Admin (Root):</div>
              <p className="text-[#5C5C58] font-mono">
                Username: <strong>root</strong> | PIN: <strong>2026</strong> (Untuk membuat akun
                Admin & memantau seluruh pengguna/sesi).
              </p>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E4E4E0] shadow-sm space-y-5">
              {/* Toggle Login vs Create User */}
              <div className="grid grid-cols-2 gap-1 bg-[#F7F7F5] p-1 rounded-xl border border-[#E4E4E0]">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-white text-[#133E2B] shadow-xs'
                      : 'text-[#5C5C58]'
                  }`}
                >
                  Masuk Akun
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-white text-[#133E2B] shadow-xs'
                      : 'text-[#5C5C58]'
                  }`}
                >
                  + Daftar User Baru
                </button>
              </div>

              {authMode === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#E4E4E0] focus:outline-none focus:border-[#133E2B]"
                      placeholder="contoh: fikri atau root"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">PIN Keamanan</label>
                    <input
                      type="password"
                      required
                      value={loginForm.pin_code}
                      onChange={(e) => setLoginForm({ ...loginForm, pin_code: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#E4E4E0] focus:outline-none focus:border-[#133E2B]"
                      placeholder="Masukkan PIN..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || Boolean(cloudError)}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#133E2B] hover:bg-[#0e2f20] disabled:opacity-50 text-white font-semibold text-sm cursor-pointer"
                  >
                    {submitting ? 'Memverifikasi...' : 'Masuk ke Aplikasi →'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegisterUser} className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Username Unik</label>
                      <input
                        type="text"
                        required
                        value={registerForm.username}
                        onChange={(e) =>
                          setRegisterForm({ ...registerForm, username: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#E4E4E0]"
                        placeholder="fikri24"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Buat PIN</label>
                      <input
                        type="password"
                        required
                        value={registerForm.pin_code}
                        onChange={(e) =>
                          setRegisterForm({ ...registerForm, pin_code: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#E4E4E0]"
                        placeholder="1234"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      required
                      value={registerForm.full_name}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, full_name: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#E4E4E0]"
                      placeholder="Fikri Rahman"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Usia (Tahun)</label>
                      <input
                        type="number"
                        min={13}
                        max={75}
                        required
                        value={registerForm.age}
                        onChange={(e) => setRegisterForm({ ...registerForm, age: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#E4E4E0]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Level Awal</label>
                      <select
                        value={registerForm.skill_level}
                        onChange={(e) =>
                          setRegisterForm({ ...registerForm, skill_level: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-[#E4E4E0] bg-white"
                      >
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || Boolean(cloudError)}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#133E2B] hover:bg-[#0e2f20] disabled:opacity-50 text-white font-semibold text-xs cursor-pointer"
                  >
                    {submitting ? 'Mendaftarkan...' : 'Buat Akun & Masuk →'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ================= APLIKASI UTAMA =================
  const isStaff = user.role === 'root' || user.role === 'admin';
  const isMinor = Number(user.age) < 18;
  const myBookings = bookings.filter(
    (b) => b.user_username === user.username && b.status === 'Terdaftar'
  );
  const mySessionsList = sessions.filter(
    (s) => s.host_username === user.username || myBookings.some((b) => b.session_id === s.id)
  );

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#141413] font-sans pb-16">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#141413] text-white px-4 py-3 rounded-xl shadow-lg border border-neutral-700 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
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
              <div className="font-bold text-base leading-none flex items-center gap-2">
                <span>MabarJogja</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase ${
                    user.role === 'root'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : user.role === 'admin'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-emerald-50 text-[#133E2B] border border-emerald-200'
                  }`}
                >
                  {user.role}
                </span>
              </div>
              <div className="text-[11px] font-mono text-[#5C5C58] mt-0.5">
                @{user.username} • {sessions.length} Sesi Live
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-[#F7F7F5] p-1 rounded-lg border border-[#E4E4E0]">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-white text-[#133E2B] shadow-xs border border-[#E4E4E0]'
                  : 'text-[#5C5C58]'
              }`}
            >
              Jelajah Jadwal
            </button>
            <button
              onClick={() => setActiveTab('mysessions')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                activeTab === 'mysessions'
                  ? 'bg-white text-[#133E2B] shadow-xs border border-[#E4E4E0]'
                  : 'text-[#5C5C58]'
              }`}
            >
              Sesi Saya ({mySessionsList.length})
            </button>
            {isStaff && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-white text-[#D94E1F] shadow-xs border border-[#E4E4E0]'
                    : 'text-[#D94E1F]'
                }`}
              >
                Panel {user.role === 'root' ? 'Root & Admin' : 'Pemantauan Admin'}
              </button>
            )}
            <button
              onClick={() => setActiveTab('account')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                activeTab === 'account'
                  ? 'bg-white text-[#133E2B] shadow-xs border border-[#E4E4E0]'
                  : 'text-[#5C5C58]'
              }`}
            >
              Akun
            </button>
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#133E2B] text-white text-xs font-semibold hover:bg-[#0e2f20] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Jadwal</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================= TAB: PANEL PEMANTAUAN ROOT & ADMIN ================= */}
      {activeTab === 'admin' && isStaff && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
          {/* Statistik Monitoring */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-[#E4E4E0]">
              <div className="text-xs font-mono text-[#5C5C58]">TOTAL PENGGUNA TERDAFTAR</div>
              <div className="text-3xl font-bold font-mono mt-1 text-[#133E2B]">
                {profiles.length}
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-[#E4E4E0]">
              <div className="text-xs font-mono text-[#5C5C58]">TOTAL SESI AKTIF</div>
              <div className="text-3xl font-bold font-mono mt-1 text-[#141413]">
                {sessions.length}
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-[#E4E4E0]">
              <div className="text-xs font-mono text-[#5C5C58]">TOTAL PESAN CHAT CLOUD</div>
              <div className="text-3xl font-bold font-mono mt-1 text-[#D94E1F]">
                {messages.length}
              </div>
            </div>
          </div>

          {/* KHUSUS ROOT: Create Akun Admin Baru */}
          {user.role === 'root' && (
            <form
              onSubmit={handleCreateAdmin}
              className="bg-white p-6 rounded-xl border border-[#E4E4E0] space-y-4"
            >
              <div className="flex items-center gap-2 text-[#133E2B]">
                <UserPlus className="w-5 h-5" />
                <h2 className="font-bold text-base">Root Privilege: Buat Akun Admin Baru</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Username Admin (misal: admin_jogja)"
                  value={newAdminForm.username}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, username: e.target.value })}
                  className="px-3 py-2 text-xs font-mono rounded-lg border border-[#E4E4E0]"
                />
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap Admin"
                  value={newAdminForm.full_name}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, full_name: e.target.value })}
                  className="px-3 py-2 text-xs rounded-lg border border-[#E4E4E0]"
                />
                <input
                  type="text"
                  required
                  placeholder="PIN Login Admin"
                  value={newAdminForm.pin_code}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, pin_code: e.target.value })}
                  className="px-3 py-2 text-xs font-mono rounded-lg border border-[#E4E4E0]"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-4 rounded-lg bg-[#133E2B] text-white text-xs font-semibold hover:bg-[#0e2f20] cursor-pointer"
                >
                  + Create Akun Admin
                </button>
              </div>
            </form>
          )}

          {/* Tabel Manajemen Pengguna (Delete User) */}
          <div className="bg-white rounded-xl border border-[#E4E4E0] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E4E0] flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Users className="w-4 h-4 text-[#133E2B]" />
                <span>Manajemen Pengguna & Hak Akses</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F7F5] border-b border-[#E4E4E0] font-mono text-[#5C5C58]">
                  <tr>
                    <th className="px-4 py-3">USERNAME</th>
                    <th className="px-4 py-3">NAMA LENGKAP</th>
                    <th className="px-4 py-3">ROLE</th>
                    <th className="px-4 py-3">USIA</th>
                    <th className="px-4 py-3">SKILL</th>
                    <th className="px-4 py-3 text-right">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E0]">
                  {profiles.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-mono font-semibold">@{p.username}</td>
                      <td className="px-4 py-3">{p.full_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[11px] uppercase ${
                            p.role === 'root'
                              ? 'bg-red-100 text-red-800'
                              : p.role === 'admin'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          {p.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{p.age} thn</td>
                      <td className="px-4 py-3">{p.skill_level}</td>
                      <td className="px-4 py-3 text-right">
                        {p.role !== 'root' && !(user.role === 'admin' && p.role === 'admin') && (
                          <button
                            onClick={() => handleDeleteUser(p)}
                            disabled={submitting}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-semibold cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete User</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pemantauan & Moderasi Sesi */}
          <div className="bg-white rounded-xl border border-[#E4E4E0] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E4E0] flex items-center gap-2 font-bold text-sm">
              <ShieldAlert className="w-4 h-4 text-[#D94E1F]" />
              <span>Pemantauan Seluruh Sesi & Moderasi</span>
            </div>
            <div className="divide-y divide-[#E4E4E0]">
              {sessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#5C5C58]">
                  Belum ada sesi aktif di database.
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-sm">
                        {s.venue_name} ({s.district}) — {s.sport}
                      </div>
                      <div className="text-[#5C5C58] font-mono mt-0.5">
                        Host: @{s.host_username} • {s.session_date} {s.time_range} • Peserta:{' '}
                        {1 + getSessionBookings(s.id).length}/{s.max_quota}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedSessionId(s.id);
                          setModalTab('chat');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-[#E4E4E0] hover:bg-[#F7F7F5] font-semibold cursor-pointer"
                      >
                        Pantau Chat
                      </button>
                      <button
                        onClick={() => handleDeleteSession(s)}
                        disabled={submitting}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Sesi</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      )}

      {/* ================= TAB: KATALOG JADWAL ================= */}
      {activeTab === 'catalog' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-5">
            <div className="bg-white p-4 rounded-xl border border-[#E4E4E0] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5C5C58]">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter Olahraga & Kecamatan Yogyakarta</span>
                </div>
                <button
                  onClick={() => setUrgentOnly(!urgentOnly)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer ${
                    urgentOnly
                      ? 'bg-[#D94E1F] text-white border-[#D94E1F]'
                      : 'bg-white text-[#D94E1F] border-[#E4E4E0]'
                  }`}
                >
                  ⚡ Slot Mendadak
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

            {filteredSessions.length === 0 ? (
              <div className="bg-white p-12 rounded-xl border border-[#E4E4E0] text-center space-y-3">
                <div className="font-bold text-base">Belum Ada Jadwal Mabar Aktif</div>
                <p className="text-xs text-[#5C5C58] max-w-md mx-auto">
                  Silakan klik tombol di bawah untuk membuat jadwal baru yang langsung tersimpan di
                  database cloud.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2.5 rounded-lg bg-[#133E2B] text-white text-xs font-semibold cursor-pointer"
                >
                  + Buat Jadwal Pertama
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSessions.map((session) => {
                  const joinedList = getSessionBookings(session.id);
                  const filledCount = Math.min(session.max_quota, 1 + joinedList.length);
                  const remaining = Math.max(0, session.max_quota - filledCount);
                  const isHost = session.host_username === user.username;
                  const isJoined = joinedList.some((b) => b.user_username === user.username);

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
                          <span
                            className={`font-mono font-semibold ${
                              session.is_urgent ? 'text-[#D94E1F]' : 'text-[#5C5C58]'
                            }`}
                          >
                            Sisa {remaining} slot
                          </span>
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
                            Host: @{session.host_username}
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
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {(isHost || isStaff) && (
                            <button
                              onClick={() => handleDeleteSession(session)}
                              title="Hapus Sesi"
                              className="p-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedSessionId(session.id);
                              setModalTab('chat');
                            }}
                            className="p-2 rounded-lg border border-[#E4E4E0] hover:bg-[#F7F7F5] text-[#141413] cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSessionId(session.id);
                              setModalTab('detail');
                            }}
                            className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                              isHost || isJoined
                                ? 'bg-emerald-50 text-[#133E2B] border border-[#133E2B]'
                                : 'bg-[#133E2B] text-white hover:bg-[#0e2f20]'
                            }`}
                          >
                            {isHost ? 'Kelola' : isJoined ? 'Terdaftar ✓' : 'Ikut →'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="lg:col-span-4 space-y-4">
            <div className="bg-white p-5 rounded-xl border border-[#E4E4E0] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-[#5C5C58]">
                  Quick Matchmaking
                </span>
                <Zap className="w-4 h-4 text-[#D94E1F]" />
              </div>
              <button
                onClick={handleQuickMatch}
                className="w-full py-2.5 px-4 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-neutral-800 cursor-pointer"
              >
                ⚡ Carikan Slot Otomatis
              </button>
            </div>
          </aside>
        </main>
      )}

      {/* ================= TAB: SESI SAYA (OWNER HOST BISA HAPUS SESI) ================= */}
      {activeTab === 'mysessions' && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-4">
          <div className="bg-white p-5 rounded-xl border border-[#E4E4E0]">
            <h2 className="font-bold text-lg">Jadwal Saya (Host & Peserta)</h2>
            <p className="text-xs text-[#5C5C58] mt-1">
              Sebagai Host pembuat jadwal, Anda dapat menghapus sesi secara permanen kapan saja.
            </p>
          </div>

          {mySessionsList.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-[#E4E4E0] text-center text-xs text-[#5C5C58]">
              Belum ada jadwal yang Anda buat atau ikuti.
            </div>
          ) : (
            <div className="space-y-3">
              {mySessionsList.map((s) => {
                const isHost = s.host_username === user.username;
                const sessionMsgs = messages.filter((m) => m.session_id === s.id);
                return (
                  <div
                    key={s.id}
                    className="bg-white p-5 rounded-xl border border-[#E4E4E0] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-[#133E2B] text-white font-semibold">
                          {isHost ? 'OWNER HOST' : 'PESERTA'}
                        </span>
                        <span className="font-mono text-[#5C5C58]">
                          {s.session_date} • {s.time_range}
                        </span>
                      </div>
                      <h3 className="font-bold text-base mt-1">
                        {s.venue_name} ({s.district})
                      </h3>
                      <p className="text-xs text-[#5C5C58] mt-0.5">
                        {1 + getSessionBookings(s.id).length}/{s.max_quota} pemain •{' '}
                        {sessionMsgs.length} pesan chat
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedSessionId(s.id);
                          setModalTab('chat');
                        }}
                        className="px-3.5 py-2 rounded-lg bg-[#133E2B] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Buka Chat</span>
                      </button>

                      {isHost ? (
                        <button
                          onClick={() => handleDeleteSession(s)}
                          disabled={submitting}
                          className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Sesi</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCancelBooking(s)}
                          disabled={submitting}
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

      {/* ================= TAB: AKUN & DELETE USER ================= */}
      {activeTab === 'account' && (
        <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-4">
          <div className="bg-white p-6 rounded-xl border border-[#E4E4E0] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">{user.full_name}</h2>
                <p className="text-xs text-[#5C5C58] font-mono">
                  @{user.username} • Role: {user.role.toUpperCase()} • Usia: {user.age} Tahun
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg border border-[#E4E4E0] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#F7F7F5] cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F7F5] border border-[#E4E4E0] space-y-1.5 text-xs">
              <div className="font-semibold flex items-center gap-1.5 text-[#133E2B]">
                <Lock className="w-3.5 h-3.5" />
                <span>Status Privasi & Keamanan Minor</span>
              </div>
              <p className="text-[#5C5C58]">
                {isMinor
                  ? 'Akun di bawah 18 tahun (<18): komunikasi dibatasi hanya pada ruang grup terbuka.'
                  : 'Akun terverifikasi dewasa (18+).'}
              </p>
            </div>

            {user.role !== 'root' && (
              <div className="pt-3 border-t border-[#E4E4E0] flex items-center justify-between">
                <span className="text-xs text-[#5C5C58]">
                  Ingin menghapus akun dan seluruh data Anda secara permanen?
                </span>
                <button
                  onClick={() => handleDeleteUser(user)}
                  disabled={submitting}
                  className="px-3.5 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Akun Saya</span>
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ================= MODAL DETAIL & CHAT SESI ================= */}
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
                onClick={() => setSelectedSessionId(null)}
                className="p-1.5 rounded-lg hover:bg-[#F7F7F5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex border-b border-[#E4E4E0] bg-[#F7F7F5] px-5 pt-2 gap-2">
              <button
                onClick={() => setModalTab('detail')}
                className={`px-3 py-2 text-xs font-semibold border-b-2 cursor-pointer ${
                  modalTab === 'detail'
                    ? 'border-[#133E2B] text-[#133E2B]'
                    : 'border-transparent text-[#5C5C58]'
                }`}
              >
                Rincian ({1 + getSessionBookings(selectedSession.id).length}/
                {selectedSession.max_quota})
              </button>
              <button
                onClick={() => setModalTab('chat')}
                className={`px-3 py-2 text-xs font-semibold border-b-2 cursor-pointer ${
                  modalTab === 'chat'
                    ? 'border-[#133E2B] text-[#133E2B]'
                    : 'border-transparent text-[#5C5C58]'
                }`}
              >
                Chat Live ({messages.filter((m) => m.session_id === selectedSession.id).length})
              </button>
            </div>

            {modalTab === 'detail' ? (
              <div className="p-5 space-y-4">
                {checkScheduleConflict(selectedSession) && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      Peringatan Bentrok: Kamu sudah punya jadwal lain pada{' '}
                      <strong>{selectedSession.session_date}</strong> jam{' '}
                      <strong>{selectedSession.time_range}</strong>.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-[#F7F7F5] p-3.5 rounded-xl border border-[#E4E4E0]">
                  <div>
                    <div className="text-[#5C5C58]">WAKTU</div>
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
                    <span className="px-2.5 py-1 rounded-md bg-[#133E2B] text-white text-xs">
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

                {selectedSession.host_username === user.username || isStaff ? (
                  <button
                    onClick={() => handleDeleteSession(selectedSession)}
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Sesi Ini Secara Permanen</span>
                  </button>
                ) : getSessionBookings(selectedSession.id).some(
                    (b) => b.user_username === user.username
                  ) ? (
                  <button
                    onClick={() => handleCancelBooking(selectedSession)}
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold cursor-pointer"
                  >
                    Batalkan Keikutsertaan
                  </button>
                ) : (
                  <button
                    onClick={() => handleJoinSession(selectedSession)}
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#133E2B] text-white text-xs font-semibold hover:bg-[#0e2f20] cursor-pointer"
                  >
                    Amankan Slot & Simpan ke Cloud
                  </button>
                )}
              </div>
            ) : (
              <div className="p-5 flex flex-col h-96">
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {messages.filter((m) => m.session_id === selectedSession.id).length === 0 ? (
                    <div className="text-center text-xs text-[#5C5C58] py-10">
                      Belum ada pesan di ruang diskusi ini.
                    </div>
                  ) : (
                    messages
                      .filter((m) => m.session_id === selectedSession.id)
                      .map((m) => (
                        <div
                          key={m.id}
                          className={`p-2.5 rounded-xl text-xs max-w-[82%] ${
                            m.sender_username === user.username
                              ? 'ml-auto bg-[#133E2B] text-white'
                              : 'bg-[#F7F7F5] border border-[#E4E4E0] text-[#141413]'
                          }`}
                        >
                          <div className="font-semibold text-[10px] opacity-80 mb-0.5">
                            {m.sender_name} ({m.sender_role.toUpperCase()})
                          </div>
                          <div>{m.message_text}</div>
                        </div>
                      ))
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Tulis pesan..."
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
              <h3 className="font-bold text-base">Buat Jadwal Open Play</h3>
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
                placeholder="Contoh: GOR Klebengan"
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

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-semibold mb-1">Level</label>
                <select
                  value={newSession.skill_level}
                  onChange={(e) => setNewSession({ ...newSession, skill_level: e.target.value })}
                  className="w-full px-2 py-2 text-xs rounded-lg border border-[#E4E4E0] bg-white"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="All Level">All Level</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Kuota</label>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={newSession.max_quota}
                  onChange={(e) => setNewSession({ ...newSession, max_quota: e.target.value })}
                  className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-[#E4E4E0]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Patungan (Rp)</label>
                <input
                  type="number"
                  step={1000}
                  value={newSession.fee_per_person}
                  onChange={(e) =>
                    setNewSession({ ...newSession, fee_per_person: e.target.value })
                  }
                  className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-[#E4E4E0]"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={newSession.is_urgent}
                onChange={(e) => setNewSession({ ...newSession, is_urgent: e.target.checked })}
                className="accent-[#D94E1F]"
              />
              <span>Tandai sebagai Slot Mendadak (Urgent)</span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-[#133E2B] text-white text-xs font-semibold hover:bg-[#0e2f20] cursor-pointer"
            >
              {submitting ? 'Menyimpan...' : 'Publikasikan ke Cloud'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}