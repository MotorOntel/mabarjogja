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
  Award,
  Flame,
  UserCheck,
  UserX,
  Bell,
  Pin,
  Check,
  Sparkles,
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';

const TRAIT_OPTIONS = ['Sportif', 'On-Time', 'Komunikatif', 'Jujur Poin'];

export default function App() {
  // Session Pengguna Aktif
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('mabarjogja_prod_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Mode Auth: 'login' | 'register'
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

  // State Database Cloud (PostgreSQL)
  const [profiles, setProfiles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [friendships, setFriendships] = useState([]);
  const [directMessages, setDirectMessages] = useState([]);
  const [peerReviews, setPeerReviews] = useState([]);
  const [loadingCloud, setLoadingCloud] = useState(true);
  const [cloudError, setCloudError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Navigasi & Filter
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'mysessions' | 'friends' | 'gor' | 'admin' | 'account'
  const [sportFilter, setSportFilter] = useState('Semua');
  const [districtFilter, setDistrictFilter] = useState('Semua');
  const [urgentOnly, setUrgentOnly] = useState(false);

  // Modal, Chat & Notifikasi
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [modalTab, setModalTab] = useState('detail'); // 'detail' | 'chat'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteModalSession, setInviteModalSession] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [activeDmUsername, setActiveDmUsername] = useState(null);
  const [dmInput, setDmInput] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
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
      const [resProf, resSess, resBook, resMsg, resFriend, resDm, resRev] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('sessions').select('*').order('created_at', { ascending: false }),
        supabase.from('bookings').select('*').order('created_at', { ascending: true }),
        supabase.from('session_messages').select('*').order('created_at', { ascending: true }),
        supabase.from('friendships').select('*').order('created_at', { ascending: false }),
        supabase.from('direct_messages').select('*').order('created_at', { ascending: true }),
        supabase.from('peer_reviews').select('*').order('created_at', { ascending: false }),
      ]);

      if (resProf.error) throw resProf.error;
      if (resSess.error) throw resSess.error;

      setProfiles(resProf.data || []);
      setSessions(resSess.data || []);
      setBookings(resBook.data || []);
      setMessages(resMsg.data || []);
      setFriendships(resFriend.data || []);
      setDirectMessages(resDm.data || []);
      setPeerReviews(resRev.data || []);

      // Perbarui state profil user aktif jika ada perubahan reputasi/skill di DB
      if (user) {
        const freshMe = (resProf.data || []).find((p) => p.username === user.username);
        if (freshMe) {
          sessionStorage.setItem('mabarjogja_prod_user', JSON.stringify(freshMe));
          setUser(freshMe);
        }
      }
    } catch (err) {
      setCloudError(err.message || 'Gagal terhubung ke database Supabase.');
    } finally {
      setLoadingCloud(false);
    }
  };

  useEffect(() => {
    fetchAllCloudData();

    const channel = supabase
      .channel('mabarjogja-full-prod-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () =>
        fetchAllCloudData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () =>
        fetchAllCloudData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () =>
        fetchAllCloudData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () =>
        fetchAllCloudData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'peer_reviews' }, () =>
        fetchAllCloudData()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'session_messages' },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
          );
          if (user && payload.new.sender_username !== user.username) {
            setNotifications((prev) => [
              {
                id: payload.new.id,
                type: 'session_chat',
                title: `Pesan baru dari ${payload.new.sender_name}`,
                text: payload.new.message_text,
                sessionId: payload.new.session_id,
                read: false,
              },
              ...prev,
            ]);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        (payload) => {
          setDirectMessages((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
          );
          if (user && payload.new.receiver_username === user.username) {
            setNotifications((prev) => [
              {
                id: payload.new.id,
                type: 'dm',
                title: `DM baru dari @${payload.new.sender_username}`,
                text: payload.new.message_text,
                senderUsername: payload.new.sender_username,
                read: false,
              },
              ...prev,
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.username]);

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
        triggerToast('Username atau PIN salah!');
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
        triggerToast(
          error.code === '23505' ? 'Username sudah digunakan.' : `Gagal registrasi: ${error.message}`
        );
        setSubmitting(false);
        return;
      }

      sessionStorage.setItem('mabarjogja_prod_user', JSON.stringify(data));
      setUser(data);
      setActiveTab('catalog');
      triggerToast(`Akun @${data.username} berhasil dibuat di Cloud!`);
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

  // ================= MINOR SAFETY GUARDRAIL HELPER =================
  const isCrossAgeRestricted = (otherAge) => {
    if (!user || otherAge === undefined || otherAge === null) return false;
    const meMinor = Number(user.age) < 18;
    const otherMinor = Number(otherAge) < 18;
    return meMinor !== otherMinor;
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
      triggerToast(`Akun Admin @${cleanUsername} berhasil dibuat oleh Root.`);
    } catch (err) {
      triggerToast(`Gagal membuat admin: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (targetProfile) => {
    if (targetProfile.role === 'root') return;
    if (user.role === 'admin' && targetProfile.role === 'admin') {
      triggerToast('Hanya Root yang dapat menghapus akun Admin.');
      return;
    }

    setSubmitting(true);
    try {
      await supabase.from('bookings').delete().eq('user_username', targetProfile.username);
      await supabase.from('sessions').delete().eq('host_username', targetProfile.username);
      await supabase
        .from('friendships')
        .delete()
        .or(
          `requester_username.eq.${targetProfile.username},receiver_username.eq.${targetProfile.username}`
        );
      const { error } = await supabase.from('profiles').delete().eq('id', targetProfile.id);
      if (error) throw error;

      await fetchAllCloudData();
      triggerToast(`Akun @${targetProfile.username} berhasil dihapus permanen.`);
      if (targetProfile.username === user.username) handleLogout();
    } catch (err) {
      triggerToast(`Gagal menghapus user: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ================= SESSIONS, BOOKINGS & ANTI-GHOSTING =================
  const getSessionBookings = (sessionId) =>
    bookings.filter((b) => b.session_id === sessionId && b.status !== 'Batal');

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

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
      triggerToast(`Sesi "${session.venue_name}" dihapus permanen.`);
    } catch (err) {
      triggerToast(`Gagal menghapus sesi: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteSession = async (session) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ is_completed: true })
        .eq('id', session.id);
      if (error) throw error;

      // Tambah games_played untuk host dan peserta hadir
      const roster = getSessionBookings(session.id);
      const participants = [session.host_username, ...roster.map((r) => r.user_username)];
      for (const uname of participants) {
        const prof = profiles.find((p) => p.username === uname);
        if (prof) {
          await supabase
            .from('profiles')
            .update({ games_played: (prof.games_played || 0) + 1 })
            .eq('id', prof.id);
        }
      }

      await fetchAllCloudData();
      triggerToast('Sesi ditandai selesai! Silakan beri penilaian kehadiran, skill & sifat.');
    } catch (err) {
      triggerToast(`Gagal menyelesaikan sesi: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAttendance = async (bookingRow, newStatus) => {
    setSubmitting(true);
    try {
      await supabase.from('bookings').update({ status: newStatus }).eq('id', bookingRow.id);

      const targetProf = profiles.find((p) => p.username === bookingRow.user_username);
      if (targetProf) {
        const delta = newStatus === 'Hadir' ? 1 : newStatus === 'Ghosting' ? -12 : -2;
        const nextRate = Math.min(100, Math.max(20, (targetProf.attendance_rate || 100) + delta));
        await supabase
          .from('profiles')
          .update({ attendance_rate: nextRate })
          .eq('id', targetProf.id);
      }

      await fetchAllCloudData();
      triggerToast(`Status ${bookingRow.user_name} diperbarui menjadi ${newStatus}.`);
    } catch (err) {
      triggerToast(`Gagal memperbarui status: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Peer-Review Kuorum Skill & Penilaian Sifat Pasca-Main
  const handlePeerReview = async (sessionId, targetUsername, type, value) => {
    if (targetUsername === user.username) return;
    const already = peerReviews.some(
      (r) =>
        r.session_id === sessionId &&
        r.reviewer_username === user.username &&
        r.target_username === targetUsername &&
        (type === 'skill' ? r.skill_vote : r.trait_tag === value)
    );
    if (already) {
      triggerToast('Kamu sudah memberikan penilaian ini.');
      return;
    }

    setSubmitting(true);
    try {
      await supabase.from('peer_reviews').insert([
        {
          session_id: sessionId,
          reviewer_username: user.username,
          target_username: targetUsername,
          skill_vote: type === 'skill' ? value : null,
          trait_tag: type === 'trait' ? value : null,
        },
      ]);

      const targetProf = profiles.find((p) => p.username === targetUsername);
      if (targetProf) {
        if (type === 'skill' && value === 'Sesuai') {
          await supabase
            .from('profiles')
            .update({ skill_approvals: (targetProf.skill_approvals || 0) + 1 })
            .eq('id', targetProf.id);
        } else if (type === 'trait') {
          const currentTraits = targetProf.traits || {};
          const updatedTraits = {
            ...currentTraits,
            [value]: (currentTraits[value] || 0) + 1,
          };
          await supabase
            .from('profiles')
            .update({ traits: updatedTraits })
            .eq('id', targetProf.id);
        }
      }

      await fetchAllCloudData();
      triggerToast(`Penilaian ${type === 'skill' ? 'kuorum skill' : `sifat "${value}"`} terkirim!`);
    } catch (err) {
      triggerToast(`Gagal mengirim penilaian: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustOwnSkill = async (newTier) => {
    setSubmitting(true);
    try {
      await supabase
        .from('profiles')
        .update({ skill_level: newTier, skill_approvals: 0 })
        .eq('id', user.id);
      await fetchAllCloudData();
      triggerToast(`Tier diubah ke ${newTier} (Menunggu kuorum approval 3 pemain).`);
    } catch (err) {
      triggerToast(`Gagal mengubah tier: ${err.message}`);
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
        !s.is_completed &&
        (myActiveIds.includes(s.id) || s.host_username === user.username) &&
        s.id !== targetSession.id &&
        s.session_date.toLowerCase() === targetSession.session_date.toLowerCase() &&
        s.time_range === targetSession.time_range
    );
  };

  const handleJoinSession = async (session) => {
    if (session.host_username === user.username) return;
    const currentList = getSessionBookings(session.id);
    if (currentList.some((b) => b.user_username === user.username)) return;
    if (1 + currentList.length >= session.max_quota) {
      triggerToast('Kuota sesi penuh.');
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
      triggerToast(`Slot diamankan di ${session.venue_name}!`);
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
      await supabase.from('bookings').delete().eq('id', target.id);
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
      triggerToast('Jadwal berhasil dipublikasikan ke Cloud!');
      setShowCreateModal(false);
      setNewSession({ ...newSession, venue_name: '', pinned_note: '' });
    } catch (err) {
      triggerToast(`Gagal membuat jadwal: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePinnedNote = async (session) => {
    if (!pinInput.trim()) return;
    setSubmitting(true);
    try {
      await supabase
        .from('sessions')
        .update({ pinned_note: pinInput.trim() })
        .eq('id', session.id);
      setPinInput('');
      await fetchAllCloudData();
      triggerToast('Pengumuman host berhasil disematkan!');
    } catch (err) {
      triggerToast(`Gagal menyematkan: ${err.message}`);
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
            sender_role: selectedSession.host_username === user.username ? 'host' : user.role,
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

  // ================= FRIENDS, DECLINE REQUEST, PRIVATE DM & INVITE =================
  const handleSendFriendRequest = async (targetProfile) => {
    if (targetProfile.username === user.username) return;
    if (isCrossAgeRestricted(targetProfile.age)) {
      triggerToast('Diblokir oleh Pengaman Usia: Tidak dapat Add Friend lintas usia (<18 vs 18+).');
      return;
    }

    const exists = friendships.some(
      (f) =>
        (f.requester_username === user.username &&
          f.receiver_username === targetProfile.username) ||
        (f.receiver_username === user.username && f.requester_username === targetProfile.username)
    );
    if (exists) {
      triggerToast('Permintaan pertemanan sudah ada.');
      return;
    }

    setSubmitting(true);
    try {
      await supabase.from('friendships').insert([
        {
          requester_username: user.username,
          requester_name: user.full_name,
          requester_age: user.age,
          receiver_username: targetProfile.username,
          receiver_name: targetProfile.full_name,
          receiver_age: targetProfile.age,
          status: 'pending',
        },
      ]);
      await fetchAllCloudData();
      triggerToast(`Permintaan pertemanan dikirim ke @${targetProfile.username}.`);
    } catch (err) {
      triggerToast(`Gagal menambah teman: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptFriend = async (friendshipRow) => {
    setSubmitting(true);
    try {
      await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipRow.id);
      await fetchAllCloudData();
      triggerToast(`Sekarang berteman dengan @${friendshipRow.requester_username}!`);
    } catch (err) {
      triggerToast(`Gagal menerima: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeclineFriend = async (friendshipRow) => {
    setSubmitting(true);
    try {
      await supabase.from('friendships').delete().eq('id', friendshipRow.id);
      await fetchAllCloudData();
      triggerToast(`Permintaan pertemanan dari @${friendshipRow.requester_username} ditolak.`);
    } catch (err) {
      triggerToast(`Gagal menolak: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendDirectMessage = async (e, inviteSessionObj = null) => {
    if (e) e.preventDefault();
    const targetUsername = activeDmUsername;
    if (!targetUsername) return;
    const text = inviteSessionObj
      ? `Undangan Mabar: ${inviteSessionObj.venue_name} (${inviteSessionObj.session_date}, ${inviteSessionObj.time_range})`
      : dmInput.trim();
    if (!text) return;

    const targetProf = profiles.find((p) => p.username === targetUsername);
    if (targetProf && isCrossAgeRestricted(targetProf.age)) {
      triggerToast('Private DM lintas kelompok usia diblokir demi perlindungan anak.');
      return;
    }

    if (!inviteSessionObj) setDmInput('');
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .insert([
          {
            sender_username: user.username,
            receiver_username: targetUsername,
            message_text: text,
            invite_session_id: inviteSessionObj ? inviteSessionObj.id : null,
          },
        ])
        .select();
      if (error) throw error;
      if (data) {
        setDirectMessages((prev) =>
          prev.some((m) => m.id === data[0].id) ? prev : [...prev, data[0]]
        );
      }
      if (inviteSessionObj) {
        setInviteModalSession(null);
        triggerToast(`Undangan mabar dikirim ke @${targetUsername}!`);
      }
    } catch (err) {
      triggerToast(`Gagal mengirim DM: ${err.message}`);
    }
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (s.is_completed) return false;
      if (sportFilter !== 'Semua' && s.sport !== sportFilter) return false;
      if (districtFilter !== 'Semua' && s.district !== districtFilter) return false;
      if (urgentOnly && !s.is_urgent) return false;
      return true;
    });
  }, [sessions, sportFilter, districtFilter, urgentOnly]);

  const handleQuickMatch = () => {
    const available = sessions.filter(
      (s) =>
        !s.is_completed &&
        s.host_username !== user.username &&
        1 + getSessionBookings(s.id).length < s.max_quota
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
    triggerToast(`Quick Match: ${best.venue_name} (${best.district})!`);
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
                FULL PRODUCTION
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  cloudError ? 'bg-red-600' : 'bg-emerald-600 animate-pulse'
                }`}
              />
              <span>{cloudError ? 'Database Offline' : 'Supabase PostgreSQL Live'}</span>
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
              <span>Vercel Edge + Supabase PostgreSQL • Multi-User Real-Time</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
              Main bareng di Jogja, <span className="text-[#133E2B]">aman & tervalidasi.</span>
            </h1>
            <p className="text-[#5C5C58] text-base leading-relaxed max-w-xl">
              Platform matchmaking olahraga lokal Yogyakarta dengan kuorum approval skill,
              penilaian sportivitas pasca-main, chat grup & DM privat terlindungi filter usia
              minor, serta manajemen akses Root & Admin.
            </p>
            <div className="p-4 rounded-xl bg-white border border-[#E4E4E0] text-xs space-y-1 max-w-md">
              <div className="font-bold text-[#133E2B]">Kredensial Super Admin (Root):</div>
              <p className="text-[#5C5C58] font-mono">
                Username: <strong>root</strong> | PIN: <strong>2026</strong>
              </p>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E4E4E0] shadow-sm space-y-5">
              <div className="grid grid-cols-2 gap-1 bg-[#F7F7F5] p-1 rounded-xl border border-[#E4E4E0]">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    authMode === 'login' ? 'bg-white text-[#133E2B] shadow-xs' : 'text-[#5C5C58]'
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
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#E4E4E0]"
                      placeholder="username atau root"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">PIN Keamanan</label>
                    <input
                      type="password"
                      required
                      value={loginForm.pin_code}
                      onChange={(e) => setLoginForm({ ...loginForm, pin_code: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#E4E4E0]"
                      placeholder="PIN..."
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
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const myBookings = bookings.filter(
    (b) => b.user_username === user.username && b.status !== 'Batal'
  );
  const myOngoingSessions = sessions.filter(
    (s) =>
      !s.is_completed &&
      (s.host_username === user.username || myBookings.some((b) => b.session_id === s.id))
  );
  const myCompletedSessions = sessions.filter(
    (s) =>
      s.is_completed &&
      (s.host_username === user.username || myBookings.some((b) => b.session_id === s.id))
  );

  // Pertemanan
  const incomingRequests = friendships.filter(
    (f) => f.receiver_username === user.username && f.status === 'pending'
  );
  const acceptedFriends = friendships
    .filter(
      (f) =>
        f.status === 'accepted' &&
        (f.requester_username === user.username || f.receiver_username === user.username)
    )
    .map((f) => {
      const friendUsername =
        f.requester_username === user.username ? f.receiver_username : f.requester_username;
      return (
        profiles.find((p) => p.username === friendUsername) || {
          username: friendUsername,
          full_name:
            f.requester_username === user.username ? f.receiver_name : f.requester_name,
          age: f.requester_username === user.username ? f.receiver_age : f.requester_age,
          skill_level: 'Member',
        }
      );
    });

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#141413] font-sans pb-16">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#141413] text-white px-4 py-3 rounded-xl shadow-lg border border-neutral-700 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#E4E4E0] px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
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
                @{user.username} ({user.age} thn)
              </div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 bg-[#F7F7F5] p-1 rounded-lg border border-[#E4E4E0]">
            {[
              { id: 'catalog', label: 'Jelajah Jadwal' },
              {
                id: 'mysessions',
                label: `Sesi & Riwayat (${myOngoingSessions.length + myCompletedSessions.length})`,
              },
              {
                id: 'friends',
                label: `Teman & DM${incomingRequests.length ? ` (${incomingRequests.length})` : ''}`,
              },
              { id: 'gor', label: 'Portal GOR' },
              ...(isStaff
                ? [{ id: 'admin', label: user.role === 'root' ? 'Panel Root' : 'Panel Admin' }]
                : []),
              { id: 'account', label: 'Akun & Skill' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-white text-[#133E2B] shadow-xs border border-[#E4E4E0]'
                    : 'text-[#5C5C58] hover:text-[#141413]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 relative">
            {/* Lonceng Notifikasi Pesan Baru */}
            <button
              onClick={() => {
                setShowNotifDrawer(!showNotifDrawer);
                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
              }}
              className="relative p-2 rounded-lg border border-[#E4E4E0] bg-white hover:bg-[#F7F7F5] text-[#141413] cursor-pointer"
              title="Notifikasi Pesan"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D94E1F] text-white text-[10px] font-mono flex items-center justify-center">
                  {unreadNotifs}
                </span>
              )}
            </button>

            <button
              onClick={fetchAllCloudData}
              title="Sinkronkan Cloud"
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

            {/* Drawer Notifikasi */}
            {showNotifDrawer && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-xl border border-[#E4E4E0] shadow-xl p-3 z-50 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold pb-1.5 border-b border-[#E4E4E0]">
                  <span>Notifikasi Real-Time</span>
                  <button
                    onClick={() => setShowNotifDrawer(false)}
                    className="text-[#5C5C58] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-[#5C5C58] py-4 text-center">Belum ada notifikasi baru.</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-1.5">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setShowNotifDrawer(false);
                          if (n.type === 'session_chat') {
                            setSelectedSessionId(n.sessionId);
                            setModalTab('chat');
                          } else if (n.type === 'dm') {
                            setActiveTab('friends');
                            setActiveDmUsername(n.senderUsername);
                          }
                        }}
                        className="p-2 rounded-lg bg-[#F7F7F5] hover:bg-emerald-50 text-xs cursor-pointer"
                      >
                        <div className="font-semibold text-[#133E2B]">{n.title}</div>
                        <div className="text-[#5C5C58] truncate">{n.text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="lg:hidden flex border-b border-[#E4E4E0] bg-white px-4 py-2 gap-1.5 overflow-x-auto">
        {[
          { id: 'catalog', label: 'Jelajah' },
          { id: 'mysessions', label: 'Sesi & Riwayat' },
          { id: 'friends', label: `Teman (${incomingRequests.length})` },
          { id: 'gor', label: 'Portal GOR' },
          ...(isStaff ? [{ id: 'admin', label: 'Admin' }] : []),
          { id: 'account', label: 'Akun' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#133E2B] text-white'
                : 'bg-[#F7F7F5] text-[#5C5C58] border border-[#E4E4E0]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
                  Buat jadwal pertama Anda sekarang agar pemain lain di Yogyakarta dapat bergabung.
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
                          <button
                            onClick={() => setInviteModalSession(session)}
                            title="Invite Teman"
                            className="px-2.5 py-2 rounded-lg border border-[#E4E4E0] hover:bg-[#F7F7F5] text-xs font-semibold cursor-pointer"
                          >
                            + Invite
                          </button>
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
                            className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
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

          {/* Sidebar Kanan */}
          <aside className="lg:col-span-4 space-y-4">
            <div className="bg-white p-5 rounded-xl border border-[#E4E4E0] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-[#5C5C58]">
                  Quick Matchmaking
                </span>
                <Zap className="w-4 h-4 text-[#D94E1F]" />
              </div>
              <p className="text-xs text-[#5C5C58]">
                Otomatis carikan 1 slot tersisa sesuai tier <strong>{user.skill_level}</strong>.
              </p>
              <button
                onClick={handleQuickMatch}
                className="w-full py-2.5 px-4 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-neutral-800 cursor-pointer"
              >
                ⚡ Carikan Slot Otomatis
              </button>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#E4E4E0] space-y-3">
              <div className="text-xs font-mono uppercase tracking-wider text-[#5C5C58]">
                Reputasi & Validasi Komunitas
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm">{user.full_name}</div>
                  <div className="text-xs text-[#5C5C58] font-mono">
                    {isMinor ? 'Minor (<18) Protected' : '18+ Verified'} • {user.games_played || 0}x
                    main
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-lg font-bold text-[#133E2B]">
                    {user.attendance_rate || 100}%
                  </div>
                  <div className="text-[11px] text-[#5C5C58]">Hadir</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#133E2B] border border-emerald-200 text-[11px] font-semibold">
                  {(user.skill_approvals || 0) >= 3
                    ? `✓ Approved ${user.skill_level}`
                    : `⏳ Kuorum Skill (${user.skill_approvals || 0}/3)`}
                </span>
                {(user.games_played || 0) >= 5 && (
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold flex items-center gap-1">
                    <Flame className="w-3 h-3" /> Sering Main
                  </span>
                )}
              </div>
            </div>
          </aside>
        </main>
      )}

      {/* ================= TAB: SESI SAYA, ANTI-GHOSTING & RIWAYAT PENILAIAN ================= */}
      {activeTab === 'mysessions' && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
          {/* Jadwal Ongoing */}
          <div className="space-y-3">
            <h2 className="font-bold text-base">Jadwal Ongoing & Evaluasi Kehadiran</h2>
            {myOngoingSessions.length === 0 ? (
              <div className="bg-white p-6 rounded-xl border border-[#E4E4E0] text-center text-xs text-[#5C5C58]">
                Tidak ada jadwal ongoing saat ini.
              </div>
            ) : (
              myOngoingSessions.map((s) => {
                const isHost = s.host_username === user.username;
                const roster = bookings.filter((b) => b.session_id === s.id);
                return (
                  <div
                    key={s.id}
                    className="bg-white p-5 rounded-xl border border-[#E4E4E0] space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedSessionId(s.id);
                            setModalTab('chat');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#133E2B] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </button>
                        {isHost ? (
                          <>
                            <button
                              onClick={() => handleCompleteSession(s)}
                              disabled={submitting}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
                            >
                              ✓ Selesaikan Game
                            </button>
                            <button
                              onClick={() => handleDeleteSession(s)}
                              disabled={submitting}
                              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                            >
                              Hapus Sesi
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleCancelBooking(s)}
                            disabled={submitting}
                            className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 bg-red-50 text-xs font-semibold cursor-pointer"
                          >
                            Cancel Slot
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Panel Validasi Anti-Ghosting untuk Host */}
                    {isHost && roster.length > 0 && (
                      <div className="pt-3 border-t border-[#E4E4E0] space-y-2">
                        <div className="text-xs font-semibold text-[#5C5C58]">
                          Validasi Kehadiran Peserta (Anti-Ghosting):
                        </div>
                        {roster.map((b) => (
                          <div
                            key={b.id}
                            className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-[#F7F7F5] text-xs"
                          >
                            <span className="font-semibold">
                              {b.user_name} (@{b.user_username}) — Status: {b.status}
                            </span>
                            <div className="flex gap-1.5">
                              {['Hadir', 'Batal', 'Ghosting'].map((st) => (
                                <button
                                  key={st}
                                  onClick={() => handleMarkAttendance(b, st)}
                                  className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                                    b.status === st
                                      ? 'bg-[#133E2B] text-white'
                                      : 'bg-white border border-[#E4E4E0] text-[#141413]'
                                  }`}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Riwayat Sesi Selesai + Peer Approval Skill & Penilaian Sifat */}
          <div className="space-y-3">
            <h2 className="font-bold text-base">
              Riwayat Sesi Selesai (Kuorum Skill & Penilaian Sifat)
            </h2>
            {myCompletedSessions.length === 0 ? (
              <div className="bg-white p-6 rounded-xl border border-[#E4E4E0] text-center text-xs text-[#5C5C58]">
                Belum ada riwayat sesi yang selesai. Klik "✓ Selesaikan Game" pada sesi ongoing
                untuk membuka penilaian rekan main.
              </div>
            ) : (
              myCompletedSessions.map((s) => {
                const roster = bookings.filter((b) => b.session_id === s.id);
                const teammates = [
                  { username: s.host_username, name: s.host_name },
                  ...roster.map((r) => ({ username: r.user_username, name: r.user_name })),
                ].filter((t) => t.username !== user.username);

                return (
                  <div
                    key={s.id}
                    className="bg-white p-5 rounded-xl border border-[#E4E4E0] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-200 text-neutral-800">
                          SELESAI
                        </span>
                        <h3 className="font-bold text-base mt-1">
                          {s.venue_name} ({s.sport})
                        </h3>
                      </div>
                      <span className="text-xs font-mono text-[#5C5C58]">{s.session_date}</span>
                    </div>

                    {teammates.length === 0 ? (
                      <p className="text-xs text-[#5C5C58]">Tidak ada rekan lain pada sesi ini.</p>
                    ) : (
                      <div className="space-y-2.5 pt-2 border-t border-[#E4E4E0]">
                        {teammates.map((tm) => {
                          const tmProf = profiles.find((p) => p.username === tm.username);
                          return (
                            <div
                              key={tm.username}
                              className="p-3 rounded-xl bg-[#F7F7F5] border border-[#E4E4E0] space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold">
                                  {tm.name} (@{tm.username})
                                </span>
                                <span className="font-mono text-[#133E2B]">
                                  Kuorum Skill: {tmProf?.skill_approvals || 0}/3
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[#5C5C58] mr-1">Approve Skill:</span>
                                <button
                                  onClick={() =>
                                    handlePeerReview(s.id, tm.username, 'skill', 'Sesuai')
                                  }
                                  className="px-2.5 py-1 rounded bg-[#133E2B] text-white font-semibold cursor-pointer"
                                >
                                  ✓ Approve Sesuai Level
                                </button>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[#5C5C58] mr-1">Apresiasi Sifat:</span>
                                {TRAIT_OPTIONS.map((tr) => (
                                  <button
                                    key={tr}
                                    onClick={() => handlePeerReview(s.id, tm.username, 'trait', tr)}
                                    className="px-2 py-0.5 rounded bg-white border border-[#E4E4E0] hover:border-[#133E2B] font-medium cursor-pointer"
                                  >
                                    + {tr}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </main>
      )}

      {/* ================= TAB: TEMAN, ADD/TOLAK REQUEST & PRIVATE DM (MINOR SAFE) ================= */}
      {activeTab === 'friends' && (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            {/* Permintaan Pertemanan Masuk */}
            {incomingRequests.length > 0 && (
              <div className="bg-white p-4 rounded-xl border border-[#D94E1F] space-y-2.5">
                <div className="text-xs font-bold text-[#D94E1F]">
                  Permintaan Pertemanan Masuk ({incomingRequests.length})
                </div>
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F7F5] text-xs"
                  >
                    <div>
                      <div className="font-bold">{req.requester_name}</div>
                      <div className="font-mono text-[#5C5C58]">
                        @{req.requester_username} • {req.requester_age} thn
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleAcceptFriend(req)}
                        className="px-2.5 py-1 rounded bg-[#133E2B] text-white font-semibold cursor-pointer"
                      >
                        Terima
                      </button>
                      <button
                        onClick={() => handleDeclineFriend(req)}
                        className="px-2.5 py-1 rounded bg-red-50 border border-red-200 text-red-700 font-semibold cursor-pointer"
                      >
                        Tolak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Daftar Teman Aktif */}
            <div className="bg-white p-4 rounded-xl border border-[#E4E4E0] space-y-2.5">
              <div className="text-xs font-bold">Teman Mabar ({acceptedFriends.length})</div>
              {acceptedFriends.length === 0 ? (
                <p className="text-xs text-[#5C5C58]">
                  Belum ada teman. Tambahkan pemain dari daftar komunitas di bawah.
                </p>
              ) : (
                acceptedFriends.map((fr) => (
                  <div
                    key={fr.username}
                    onClick={() => setActiveDmUsername(fr.username)}
                    className={`p-3 rounded-lg border text-xs flex items-center justify-between cursor-pointer ${
                      activeDmUsername === fr.username
                        ? 'bg-emerald-50 border-[#133E2B]'
                        : 'bg-[#F7F7F5] border-[#E4E4E0]'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{fr.full_name}</div>
                      <div className="font-mono text-[#5C5C58]">
                        @{fr.username} • {fr.age} thn
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-white border border-[#E4E4E0] font-semibold">
                      Chat DM
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Direktori Pemain (Add Friend dengan Guardrail Usia Minor) */}
            <div className="bg-white p-4 rounded-xl border border-[#E4E4E0] space-y-2.5">
              <div className="text-xs font-bold">Temukan Pemain di Yogyakarta</div>
              {profiles
                .filter((p) => p.username !== user.username && p.role === 'user')
                .map((p) => {
                  const restricted = isCrossAgeRestricted(p.age);
                  const isFriend = acceptedFriends.some((af) => af.username === p.username);
                  return (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-lg bg-[#F7F7F5] text-xs flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold">
                          {p.full_name}{' '}
                          <span className="font-mono font-normal text-[#5C5C58]">
                            ({p.age} thn)
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-[#5C5C58]">
                          @{p.username} • {p.skill_level}
                        </div>
                      </div>
                      {restricted ? (
                        <span className="px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 font-mono text-[10px] flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Minor Guard
                        </span>
                      ) : isFriend ? (
                        <span className="text-emerald-700 font-semibold">Teman ✓</span>
                      ) : (
                        <button
                          onClick={() => handleSendFriendRequest(p)}
                          className="px-2.5 py-1 rounded bg-[#133E2B] text-white font-semibold cursor-pointer"
                        >
                          + Add Friend
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Ruang Private DM */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#E4E4E0] flex flex-col h-[520px]">
            {!activeDmUsername ? (
              <div className="flex-1 flex items-center justify-center text-xs text-[#5C5C58] p-6 text-center">
                Pilih teman di sebelah kiri untuk memulai Private Direct Message tanpa nomor HP.
              </div>
            ) : (
              <>
                <div className="px-5 py-3.5 border-b border-[#E4E4E0] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm">Private Chat: @{activeDmUsername}</div>
                    <div className="text-[11px] text-[#133E2B] font-mono">
                      Terverifikasi Kelompok Usia Aman
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                  {directMessages
                    .filter(
                      (m) =>
                        (m.sender_username === user.username &&
                          m.receiver_username === activeDmUsername) ||
                        (m.sender_username === activeDmUsername &&
                          m.receiver_username === user.username)
                    )
                    .map((m) => (
                      <div
                        key={m.id}
                        className={`p-3 rounded-xl text-xs max-w-[80%] ${
                          m.sender_username === user.username
                            ? 'ml-auto bg-[#133E2B] text-white'
                            : 'bg-[#F7F7F5] border border-[#E4E4E0]'
                        }`}
                      >
                        <div>{m.message_text}</div>
                        {m.invite_session_id && (
                          <button
                            onClick={() => {
                              setSelectedSessionId(m.invite_session_id);
                              setModalTab('detail');
                            }}
                            className="mt-2 px-2.5 py-1 rounded bg-white text-[#133E2B] font-semibold text-[11px] cursor-pointer"
                          >
                            Buka Jadwal Undangan →
                          </button>
                        )}
                      </div>
                    ))}
                </div>

                <form
                  onSubmit={(e) => handleSendDirectMessage(e, null)}
                  className="p-3.5 border-t border-[#E4E4E0] flex gap-2"
                >
                  <input
                    type="text"
                    value={dmInput}
                    onChange={(e) => setDmInput(e.target.value)}
                    placeholder="Tulis pesan pribadi..."
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#E4E4E0]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#133E2B] text-white text-xs font-semibold cursor-pointer"
                  >
                    Kirim
                  </button>
                </form>
              </>
            )}
          </div>
        </main>
      )}

      {/* ================= TAB: PORTAL GOR ================= */}
      {activeTab === 'gor' && (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
          <div className="bg-white p-6 rounded-xl border border-[#E4E4E0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-lg">Portal Mitra Pengelola GOR Yogyakarta</h2>
              <p className="text-xs text-[#5C5C58] mt-0.5">
                Publikasikan slot lapangan kosong mendadak (Urgent) langsung ke katalog live.
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
        </main>
      )}

      {/* ================= TAB: PANEL ROOT & ADMIN ================= */}
      {activeTab === 'admin' && isStaff && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-[#E4E4E0]">
              <div className="text-xs font-mono text-[#5C5C58]">TOTAL USER</div>
              <div className="text-3xl font-bold font-mono mt-1 text-[#133E2B]">
                {profiles.length}
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-[#E4E4E0]">
              <div className="text-xs font-mono text-[#5C5C58]">TOTAL SESI</div>
              <div className="text-3xl font-bold font-mono mt-1">{sessions.length}</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-[#E4E4E0]">
              <div className="text-xs font-mono text-[#5C5C58]">TOTAL PESAN CHAT</div>
              <div className="text-3xl font-bold font-mono mt-1 text-[#D94E1F]">
                {messages.length + directMessages.length}
              </div>
            </div>
          </div>

          {user.role === 'root' && (
            <form
              onSubmit={handleCreateAdmin}
              className="bg-white p-6 rounded-xl border border-[#E4E4E0] space-y-4"
            >
              <div className="flex items-center gap-2 text-[#133E2B] font-bold text-sm">
                <UserPlus className="w-4 h-4" />
                <span>Root Privilege: Create Akun Admin Baru</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Username Admin"
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
                  placeholder="PIN Admin"
                  value={newAdminForm.pin_code}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, pin_code: e.target.value })}
                  className="px-3 py-2 text-xs font-mono rounded-lg border border-[#E4E4E0]"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-4 rounded-lg bg-[#133E2B] text-white text-xs font-semibold cursor-pointer"
                >
                  + Create Admin
                </button>
              </div>
            </form>
          )}

          {/* Tabel User (Delete User) */}
          <div className="bg-white rounded-xl border border-[#E4E4E0] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E4E4E0] font-bold text-sm">
              Manajemen Pengguna (Delete User)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F7F5] border-b border-[#E4E4E0] font-mono text-[#5C5C58]">
                  <tr>
                    <th className="px-4 py-3">USERNAME</th>
                    <th className="px-4 py-3">NAMA</th>
                    <th className="px-4 py-3">ROLE</th>
                    <th className="px-4 py-3">USIA</th>
                    <th className="px-4 py-3 text-right">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E0]">
                  {profiles.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-mono font-semibold">@{p.username}</td>
                      <td className="px-4 py-3">{p.full_name}</td>
                      <td className="px-4 py-3 uppercase font-mono">{p.role}</td>
                      <td className="px-4 py-3 font-mono">{p.age} thn</td>
                      <td className="px-4 py-3 text-right">
                        {p.role !== 'root' && !(user.role === 'admin' && p.role === 'admin') && (
                          <button
                            onClick={() => handleDeleteUser(p)}
                            className="px-2.5 py-1 rounded bg-red-50 text-red-700 border border-red-200 font-semibold cursor-pointer"
                          >
                            Delete User
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Moderasi Sesi */}
          <div className="bg-white rounded-xl border border-[#E4E4E0] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E4E4E0] font-bold text-sm">
              Pemantauan & Moderasi Sesi
            </div>
            <div className="divide-y divide-[#E4E4E0]">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="p-4 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold">
                      {s.venue_name} ({s.district})
                    </div>
                    <div className="font-mono text-[#5C5C58]">
                      Host: @{s.host_username} • {s.session_date} {s.time_range}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedSessionId(s.id);
                        setModalTab('chat');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#E4E4E0] font-semibold cursor-pointer"
                    >
                      Pantau Chat
                    </button>
                    <button
                      onClick={() => handleDeleteSession(s)}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold cursor-pointer"
                    >
                      Hapus Sesi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ================= TAB: AKUN, KUORUM SKILL, SIFAT & DELETE USER ================= */}
      {activeTab === 'account' && (
        <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-4">
          <div className="bg-white p-6 rounded-xl border border-[#E4E4E0] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">{user.full_name}</h2>
                <p className="text-xs text-[#5C5C58] font-mono">
                  @{user.username} • {user.age} Tahun • Kehadiran {user.attendance_rate || 100}%
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg border border-[#E4E4E0] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>

            {/* Penyesuaian Tier & Status Kuorum */}
            <div className="p-4 rounded-xl bg-[#F7F7F5] border border-[#E4E4E0] space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold">Penyesuaian Level & Kuorum Approval (3 Pemain)</span>
                <span className="font-mono font-semibold text-[#133E2B]">
                  {user.skill_approvals || 0}/3 Approved
                </span>
              </div>
              <div className="flex gap-2">
                {['Beginner', 'Intermediate', 'Advanced'].map((tier) => (
                  <button
                    key={tier}
                    onClick={() => handleAdjustOwnSkill(tier)}
                    className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                      user.skill_level === tier
                        ? 'bg-[#133E2B] text-white'
                        : 'bg-white border border-[#E4E4E0]'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            {/* Akumulasi Penilaian Sifat */}
            <div className="space-y-2">
              <div className="text-xs font-bold">Lencana Sifat & Sportivitas (Dari Rekan Main):</div>
              <div className="flex flex-wrap gap-2">
                {TRAIT_OPTIONS.map((tr) => (
                  <span
                    key={tr}
                    className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-[#133E2B] font-semibold"
                  >
                    {tr}: {(user.traits && user.traits[tr]) || 0}x
                  </span>
                ))}
              </div>
            </div>

            {user.role !== 'root' && (
              <div className="pt-3 border-t border-[#E4E4E0] flex items-center justify-between">
                <span className="text-xs text-[#5C5C58]">Hapus akun dan seluruh data Anda:</span>
                <button
                  onClick={() => handleDeleteUser(user)}
                  className="px-3.5 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Akun Saya</span>
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
                      Peringatan Bentrok: Kamu sudah punya jadwal pada{' '}
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
                  <div className="text-xs font-semibold mb-1.5">Peserta & Aksi Sosial:</div>
                  <div className="space-y-1.5">
                    {getSessionBookings(selectedSession.id).map((b) => {
                      const restricted = isCrossAgeRestricted(b.user_age);
                      return (
                        <div
                          key={b.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-[#F7F7F5] text-xs"
                        >
                          <span>
                            {b.user_name} ({b.user_age} thn)
                          </span>
                          {b.user_username !== user.username &&
                            (restricted ? (
                              <span className="text-[10px] font-mono text-amber-700">
                                🔒 Minor Guard
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  handleSendFriendRequest({
                                    username: b.user_username,
                                    full_name: b.user_name,
                                    age: b.user_age,
                                  })
                                }
                                className="px-2 py-0.5 rounded bg-white border border-[#E4E4E0] font-semibold cursor-pointer"
                              >
                                + Add Friend
                              </button>
                            ))}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedSession.host_username === user.username || isStaff ? (
                  <button
                    onClick={() => handleDeleteSession(selectedSession)}
                    className="w-full py-2.5 px-4 rounded-lg bg-red-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Sesi Permanen</span>
                  </button>
                ) : getSessionBookings(selectedSession.id).some(
                    (b) => b.user_username === user.username
                  ) ? (
                  <button
                    onClick={() => handleCancelBooking(selectedSession)}
                    className="w-full py-2.5 px-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold cursor-pointer"
                  >
                    Batalkan Keikutsertaan
                  </button>
                ) : (
                  <button
                    onClick={() => handleJoinSession(selectedSession)}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#133E2B] text-white text-xs font-semibold cursor-pointer"
                  >
                    Amankan Slot & Simpan ke Cloud
                  </button>
                )}
              </div>
            ) : (
              <div className="p-5 flex flex-col h-96 space-y-2.5">
                {selectedSession.pinned_note && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    <strong>Pinned Host:</strong> {selectedSession.pinned_note}
                  </div>
                )}

                {selectedSession.host_username === user.username && (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="Sematkan info lapangan / QRIS..."
                      className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-[#E4E4E0]"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdatePinnedNote(selectedSession)}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Pin className="w-3 h-3" /> Pin
                    </button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {messages
                    .filter((m) => m.session_id === selectedSession.id)
                    .map((m) => (
                      <div
                        key={m.id}
                        className={`p-2.5 rounded-xl text-xs max-w-[82%] ${
                          m.sender_username === user.username
                            ? 'ml-auto bg-[#133E2B] text-white'
                            : 'bg-[#F7F7F5] border border-[#E4E4E0]'
                        }`}
                      >
                        <div className="font-semibold text-[10px] opacity-80 mb-0.5">
                          {m.sender_name} ({m.sender_role.toUpperCase()})
                        </div>
                        <div>{m.message_text}</div>
                      </div>
                    ))}
                </div>

                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Tulis pesan grup..."
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#E4E4E0]"
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

      {/* ================= MODAL INVITE TEMAN KE SESI ================= */}
      {inviteModalSession && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-[#E4E4E0] p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Invite Teman ke {inviteModalSession.venue_name}</h3>
              <button onClick={() => setInviteModalSession(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {acceptedFriends.length === 0 ? (
              <p className="text-xs text-[#5C5C58]">
                Kamu belum memiliki teman terdaftar untuk diundang.
              </p>
            ) : (
              <div className="space-y-2">
                {acceptedFriends.map((fr) => (
                  <div
                    key={fr.username}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F7F5] text-xs"
                  >
                    <span>
                      {fr.full_name} (@{fr.username})
                    </span>
                    <button
                      onClick={() => {
                        setActiveDmUsername(fr.username);
                        handleSendDirectMessage(null, inviteModalSession);
                      }}
                      className="px-2.5 py-1 rounded bg-[#133E2B] text-white font-semibold cursor-pointer"
                    >
                      Kirim Invite
                    </button>
                  </div>
                ))}
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
              className="w-full py-2.5 px-4 rounded-lg bg-[#133E2B] text-white text-xs font-semibold cursor-pointer"
            >
              {submitting ? 'Menyimpan...' : 'Publikasikan ke Cloud'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}