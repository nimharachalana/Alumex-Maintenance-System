'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ALL_STATIONS, MASTER_DATA, StationMaster } from '@/lib/master-data';
import { evaluateLockout, LOCKOUT_DURATION_MS, LockoutStatus } from '@/lib/lockout';
import { offlineDb, OfflineInspection } from '@/lib/offline-db';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import {
  Wrench,
  ShieldCheck,
  Camera,
  Lock,
  Clock,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Printer,
  Upload,
  Eye,
  EyeOff,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  Search,
  ClipboardList,
  History,
  QrCode,
  User,
  KeyRound,
  ChevronRight
} from 'lucide-react';

interface CurrentUser {
  role: 'tech' | 'admin';
  epf?: string;
  name?: string;
}

export default function PlantMaintenancePortal() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authRole, setAuthRole] = useState<'tech' | 'admin'>('tech');
  const [epfInput, setEpfInput] = useState('EPF-4820');
  const [passInput, setPassInput] = useState('tech123');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Profile & Password Change State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);

  // Floor Scanner & Checklist states
  const [techActiveTab, setTechActiveTab] = useState<'scanner' | 'checklist' | 'history'>('scanner');
  const [currentStation, setCurrentStation] = useState<StationMaster | null>(null);
  const [checklistValues, setChecklistValues] = useState<{ [key: number]: { status: string; defectNote: string } }>({});
  const [currentSubmission, setCurrentSubmission] = useState<any>(null);
  const [lockoutStatus, setLockoutStatus] = useState<LockoutStatus>({
    isLocked: false,
    remainingMs: LOCKOUT_DURATION_MS,
    remainingMins: 30,
    remainingSecs: 0,
    formattedTime: '30m 00s'
  });

  // Offline & Sync states
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [inspectionsStore, setInspectionsStore] = useState<any[]>([]);

  // Modals & Tools
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerAlert, setScannerAlert] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedCellAudit, setSelectedCellAudit] = useState<any>(null);

  // Admin filter states
  const [adminMonth, setAdminMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [adminPlantFilter, setAdminPlantFilter] = useState<'ALL' | 'EXTRUSION' | 'VPC'>('ALL');

  const html5ScannerRef = useRef<any>(null);

  // 1. Initial Setup & Network Listeners
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      toast.info('Network reconnected. Syncing records...');
      syncOfflineInspections();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Working offline. Records will save to local IndexedDB.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Auto-restore session from localStorage if present
    const saved = localStorage.getItem('alumex_next_session');
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch (e) {}
    }

    // Load initial inspections from IndexedDB or Supabase API
    loadStoredInspections();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Load inspections from IndexedDB & Supabase API
  async function loadStoredInspections() {
    try {
      if (offlineDb) {
        const localList = await offlineDb.inspections.toArray();
        setInspectionsStore(localList);
        const unsynced = localList.filter((item) => !item.isSynced);
        setPendingSyncCount(unsynced.length);
      }

      // Fetch from Supabase API if online
      if (navigator.onLine) {
        const res = await fetch(`/api/inspections?month=${adminMonth}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setInspectionsStore((prev) => {
              const map = new Map();
              prev.forEach((p) => map.set(p.id, p));
              json.data.forEach((srv: any) => {
                map.set(srv.id, {
                  id: srv.id,
                  stationId: srv.stationId,
                  stationName: srv.station?.name || '',
                  plant: srv.station?.plant || 'EXTRUSION',
                  date: srv.inspectionDate,
                  day: srv.day,
                  month: srv.month,
                  epf: srv.epf,
                  submittedAt: srv.submittedAt,
                  lastModifiedAt: srv.lastModifiedAt,
                  records: srv.items.map((i: any) => ({
                    item: i.checkpoint?.itemName || '',
                    equipment: i.checkpoint?.equipmentName || '',
                    look_for: i.checkpoint?.lookForCriteria || '',
                    status: i.status || 'OK',
                    defectNote: i.defectNote || ''
                  })),
                  isSynced: true
                });
              });
              return Array.from(map.values());
            });
          }
        }
      }
    } catch (err) {
      console.warn('Inspection load error:', err);
    }
  }

  // 3. Auto-sync offline queued inspections to Supabase server
  async function syncOfflineInspections() {
    if (!offlineDb || !navigator.onLine) return;
    try {
      const pending = await offlineDb.inspections.where('isSynced').equals(0).toArray();
      let syncedCount = 0;
      for (const item of pending) {
        const res = await fetch('/api/inspections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });
        if (res.ok) {
          await offlineDb.inspections.update(item.id, { isSynced: true });
          syncedCount++;
        }
      }
      if (syncedCount > 0) {
        toast.success(`Synced ${syncedCount} offline record(s) to cloud database!`);
      }
      loadStoredInspections();
    } catch (e) {
      console.warn('Sync failed:', e);
    }
  }

  // 4. Strict 30-Minute Lockout Countdown (No one can change after 30 mins)
  useEffect(() => {
    if (!currentSubmission || !currentSubmission.submittedAt) {
      setLockoutStatus({
        isLocked: false,
        remainingMs: LOCKOUT_DURATION_MS,
        remainingMins: 30,
        remainingSecs: 0,
        formattedTime: '30m 00s'
      });
      return;
    }

    const interval = setInterval(() => {
      // Strict lockout: pass false so even admin is locked out after 30 mins
      const status = evaluateLockout(currentSubmission.submittedAt, false);
      setLockoutStatus(status);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSubmission]);

  // 5. Auth Handlers
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epf: epfInput.trim(),
          password: passInput.trim(),
          role: authRole
        })
      });

      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        localStorage.setItem('alumex_next_session', JSON.stringify(data.user));
        toast.success(`Signed in as ${data.user.name || data.user.epf}!`);
      } else {
        setLoginError(data.error || 'Invalid credentials');
        toast.error(data.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setLoginError('Server authentication error');
      toast.error('Network or server error during sign in');
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    stopCameraScanner();
    setCurrentUser(null);
    setCurrentStation(null);
    localStorage.removeItem('alumex_next_session');
    toast.info('Logged out from portal.');
  }

  // 6. Change Password Handler (Profile Maintenance)
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser?.epf) return;

    if (newPasswordInput !== confirmPasswordInput) {
      toast.error('New passwords do not match');
      return;
    }

    setPasswordChangeLoading(true);
    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epf: currentUser.epf,
          currentPassword: currentPasswordInput,
          newPassword: newPasswordInput
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Password changed successfully!');
        setShowProfileModal(false);
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
      } else {
        toast.error(data.error || 'Failed to update password');
      }
    } catch (err) {
      toast.error('Network error while updating password');
    } finally {
      setPasswordChangeLoading(false);
    }
  }

  // 7. Camera QR Scanner for Machine Control Panels
  async function startCameraScanner() {
    setScannerAlert('');
    setScannerActive(true);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (!html5ScannerRef.current) {
        html5ScannerRef.current = new Html5Qrcode('floor-qr-reader');
      }

      await html5ScannerRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText: string) => {
          handleScannedTag(decodedText.trim());
        },
        () => {}
      );
    } catch (err: any) {
      setScannerActive(false);
      setScannerAlert('Camera permission denied. Please allow camera or upload photo of the panel QR code.');
      toast.error('Camera access blocked. Please check browser camera permissions.');
    }
  }

  function stopCameraScanner() {
    if (html5ScannerRef.current) {
      html5ScannerRef.current
        .stop()
        .catch(() => {})
        .then(() => {
          html5ScannerRef.current?.clear();
          html5ScannerRef.current = null;
          setScannerActive(false);
        });
    } else {
      setScannerActive(false);
    }
  }

  async function handleQRFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('floor-qr-reader');
      const text = await scanner.scanFile(file, true);
      handleScannedTag(text.trim());
    } catch (err) {
      toast.error('Could not detect a QR tag in this photo. Please take a clear photo of the panel tag.');
    }
  }

  function handleScannedTag(tag: string) {
    stopCameraScanner();
    const found = ALL_STATIONS.find(
      (s) => s.qr.toLowerCase() === tag.toLowerCase() || s.id.toLowerCase() === tag.toLowerCase()
    );

    if (found) {
      openStationChecklist(found);
      setTechActiveTab('checklist');
    } else {
      setScannerAlert(`Scanned code "${tag}" is not a recognized machine panel tag.`);
      toast.error(`Invalid QR tag: ${tag}`);
    }
  }

  // 8. Load Station Checklist & Check 30-Min Lockout
  function openStationChecklist(st: StationMaster) {
    setCurrentStation(st);
    setTechActiveTab('checklist');
    const today = new Date().toISOString().slice(0, 10);

    // Look for existing submission for this station today
    const existing = inspectionsStore.find(
      (s) => s.stationId === st.id && s.date === today
    );

    setCurrentSubmission(existing || null);

    const initialVals: any = {};
    st.items.forEach((item, idx) => {
      let savedVal = 'OK';
      let savedDefectNote = '';
      if (existing?.records?.[idx]) {
        const s = existing.records[idx].status;
        savedVal = s === '√' || s === 'OK' ? 'OK' : s === 'X' || s === 'DEFECT' ? 'DEFECT' : 'STANDBY';
        savedDefectNote = existing.records[idx].defectNote || existing.records[idx].reading || '';
      }
      initialVals[idx] = { status: savedVal, defectNote: savedDefectNote };
    });

    setChecklistValues(initialVals);
    toast.success(`Station Identified: ${st.code}. ${st.name}`);
  }

  // 9. Submit Station Inspection (Dual-Save: IndexedDB + Supabase)
  async function submitInspection() {
    if (!currentStation) return;

    // Strict 30-minute lockout validation check
    if (currentSubmission?.submittedAt) {
      const elapsed = Date.now() - currentSubmission.submittedAt;
      if (elapsed > LOCKOUT_DURATION_MS) {
        toast.error('Submission Rejected: 30 minutes have elapsed. Records are permanently locked.');
        return;
      }
    }

    const todayDate = new Date().toISOString().slice(0, 10);
    const subId = currentSubmission?.id || `INS-${currentStation.id}-${todayDate}`;

    const records = currentStation.items.map((it, idx) => ({
      item: it.it,
      equipment: it.eq,
      look_for: it.lf,
      status: checklistValues[idx]?.status || 'OK',
      defectNote: checklistValues[idx]?.defectNote || ''
    }));

    const originalTime = currentSubmission?.submittedAt || Date.now();

    const inspectionPayload: OfflineInspection = {
      id: subId,
      stationId: currentStation.id,
      stationName: currentStation.name,
      plant: currentStation.plantKey,
      date: todayDate,
      day: new Date().getDate(),
      month: todayDate.slice(0, 7),
      epf: currentUser?.epf || currentSubmission?.epf || 'EPF-TECH',
      submittedAt: originalTime,
      lastModifiedAt: Date.now(),
      records,
      isSynced: false
    };

    // 1. ALWAYS Save locally into IndexedDB immediately (100% Offline Functional)
    if (offlineDb) {
      await offlineDb.inspections.put(inspectionPayload);
    }

    // 2. If online, sync directly to Supabase server
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/inspections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inspectionPayload)
        });
        if (res.ok) {
          inspectionPayload.isSynced = true;
          if (offlineDb) {
            await offlineDb.inspections.update(subId, { isSynced: true });
          }
        }
      } catch (err) {
        console.warn('Server sync queued for later:', err);
      }
    }

    // Update in-memory state
    setInspectionsStore((prev) => {
      const idx = prev.findIndex((s) => s.id === subId);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = inspectionPayload;
        return clone;
      }
      return [...prev, inspectionPayload];
    });

    toast.success(`Inspection recorded for ${currentStation.name}! Editable for 30 minutes.`);
    setTechActiveTab('history');
  }

  // 10. Admin Matrix Filtering & Calculations
  const filteredStations = ALL_STATIONS.filter((s) => {
    if (adminPlantFilter === 'ALL') return true;
    return s.plantKey === adminPlantFilter;
  });

  const monthInspections = inspectionsStore.filter((s) => s.month === adminMonth);

  let totalDefectsCount = 0;
  monthInspections.forEach((sub) => {
    sub.records?.forEach((r: any) => {
      if (r.status === 'DEFECT' || r.status === 'X') totalDefectsCount++;
    });
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* NAVIGATION BAR */}
      <header className="bg-slate-900/90 backdrop-blur-md text-white shadow-md sticky top-0 z-40 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex flex-wrap justify-between items-center gap-2">
          {/* Brand */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black text-lg sm:text-xl shadow">
              <Wrench className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base md:text-lg font-black tracking-tight leading-tight">
                Alumex Maintenance System
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium truncate max-w-[200px] sm:max-w-none">
                Extrusion (CH/MT/102) & VPC (LS/MT/102)
              </p>
            </div>
          </div>

          {/* Status & Actions Bar */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 ml-auto">
            {/* Offline / Online Network Indicator */}
            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-full border ${
                isOnline
                  ? 'bg-emerald-950/80 border-emerald-700 text-emerald-400'
                  : 'bg-rose-950/80 border-rose-700 text-rose-400 animate-pulse'
              }`}
            >
              {isOnline ? <Wifi className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <WifiOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
              <span className="hidden xs:inline">{isOnline ? 'Online (Supabase)' : 'Offline (IndexedDB)'}</span>
            </div>

            {pendingSyncCount > 0 && (
              <button
                onClick={syncOfflineInspections}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-full transition shadow-sm"
                title="Click to sync offline records"
              >
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>{pendingSyncCount} Queued</span>
              </button>
            )}

            {currentUser?.role === 'tech' && (
              <button
                onClick={() => setShowProfileModal(true)}
                className="text-[11px] sm:text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 px-2.5 py-1 sm:py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition"
                title="Profile & Password Maintenance"
              >
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span>{currentUser.epf}</span>
              </button>
            )}

            {currentUser && (
              <button
                onClick={handleLogout}
                className="text-[11px] sm:text-xs bg-slate-800 hover:bg-rose-600 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-white px-2.5 py-1 sm:py-1.5 rounded-lg font-bold flex items-center gap-1 transition"
              >
                <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* ================= AUTHENTICATION VIEW ================= */}
        {!currentUser && (
          <div className="max-w-md mx-auto mt-8 sm:mt-12 bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-2xl border border-slate-800">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Portal Access</h2>
              <p className="text-xs text-slate-400 mt-1">Industrial Floor Maintenance Login</p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl mb-5 border border-slate-800">
              <button
                type="button"
                onClick={() => setAuthRole('tech')}
                className={`py-2.5 text-xs font-bold rounded-lg transition ${
                  authRole === 'tech' ? 'bg-amber-500 text-slate-950 shadow font-black' : 'text-slate-400'
                }`}
              >
                Technician
              </button>
              <button
                type="button"
                onClick={() => setAuthRole('admin')}
                className={`py-2.5 text-xs font-bold rounded-lg transition ${
                  authRole === 'admin' ? 'bg-amber-500 text-slate-950 shadow font-black' : 'text-slate-400'
                }`}
              >
                Supervisor
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {authRole === 'tech' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                    Technician EPF No
                  </label>
                  <input
                    type="text"
                    value={epfInput}
                    onChange={(e) => setEpfInput(e.target.value.toUpperCase())}
                    placeholder="e.g. EPF-4820"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">First-time login default password: <b>tech123</b></p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={passInput}
                    onChange={(e) => setPassInput(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-medium">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black py-3 rounded-xl shadow-lg shadow-amber-500/25 transition disabled:opacity-50"
              >
                {loginLoading ? 'Signing In...' : 'Sign In to Maintenance Portal'}
              </button>
            </form>
          </div>
        )}

        {/* ================= TECHNICIAN PORTAL ================= */}
        {currentUser?.role === 'tech' && (
          <div className="space-y-6">
            {/* TOP SEGMENTED CONTROL */}
            <div className="bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 flex items-center gap-1 max-w-md mx-auto shadow-xl backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setTechActiveTab('scanner')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                  techActiveTab === 'scanner'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Scan QR</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (currentStation) {
                    setTechActiveTab('checklist');
                  } else {
                    toast.info('Please scan a machine panel QR tag first.');
                  }
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                  techActiveTab === 'checklist'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <span>Checklist</span>
                {currentStation && (
                  <span className="text-[10px] font-black bg-slate-900/80 text-amber-300 px-1.5 py-0.5 rounded-md">
                    {currentStation.code}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setTechActiveTab('history')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                  techActiveTab === 'history'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <History className="w-4 h-4" />
                <span>History</span>
                {inspectionsStore.length > 0 && (
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                      techActiveTab === 'history' ? 'bg-slate-900 text-amber-400' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {inspectionsStore.length}
                  </span>
                )}
              </button>
            </div>

            {/* TECHNICIAN STATUS HERO */}
            <div className="bg-slate-900/90 text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Field Inspection Mode
                  </span>
                  <span className="text-xs font-bold text-slate-600">•</span>
                  <button
                    onClick={() => setShowProfileModal(true)}
                    className="text-xs font-mono font-bold text-amber-300 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-700 flex items-center gap-1"
                  >
                    <User className="w-3 h-3 text-amber-400" />
                    <span>{currentUser.epf}</span>
                  </button>
                </div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Plant Floor Maintenance Inspection
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                  Rule: Checkpoints can only be edited within <b className="text-amber-400 font-semibold">30 minutes</b> of marking. After 30 minutes, records are permanently locked.
                </p>
              </div>

              <button
                onClick={() => setShowProfileModal(true)}
                className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 active:scale-95 text-amber-400 hover:text-amber-300 px-3.5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm text-xs transition-all"
              >
                <KeyRound className="w-4 h-4" /> Change Password
              </button>
            </div>

            {/* ================= STEP 1: SCANNER VIEWPORT ================= */}
            {techActiveTab === 'scanner' && (
              <div className="bg-slate-900/95 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                      </span>
                      <h3 className="font-black text-white text-base tracking-tight">Machine Panel QR Scanner</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Walk to the physical machine control panel and scan its QR code to load the checklist.
                    </p>
                  </div>
                  <div className="w-full sm:w-auto">
                    {!scannerActive ? (
                      <button
                        onClick={startCameraScanner}
                        className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-black px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all"
                      >
                        <Camera className="w-4 h-4" /> Start Live Camera
                      </button>
                    ) : (
                      <button
                        onClick={stopCameraScanner}
                        className="w-full sm:w-auto bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
                      >
                        Stop Camera
                      </button>
                    )}
                  </div>
                </div>

                {/* Viewfinder Container */}
                <div className="max-w-md mx-auto relative bg-slate-950 rounded-2xl sm:rounded-3xl overflow-hidden min-h-[300px] sm:min-h-[340px] flex items-center justify-center border-2 border-slate-800 shadow-2xl group">
                  {/* Decorative Aiming Frame Corners (Yellow Brackets) */}
                  <div className="absolute inset-5 pointer-events-none z-10 flex flex-col justify-between">
                    <div className="flex justify-between">
                      <div className="w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-xl shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                      <div className="w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-xl shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                    </div>
                    <div className="flex justify-between">
                      <div className="w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-xl shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                      <div className="w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-xl shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                    </div>
                  </div>

                  {/* Amber Glowing Laser scan line effect when active */}
                  {scannerActive && <div className="scanner-laser z-20"></div>}

                  <div id="floor-qr-reader" className="w-full h-full z-0"></div>

                  {!scannerActive && (
                    <div className="text-center p-6 space-y-3 z-10">
                      <div className="w-20 h-20 bg-slate-900/90 border border-amber-500/30 text-amber-400 rounded-3xl flex items-center justify-center text-3xl mx-auto shadow-inner group-hover:scale-105 transition-transform">
                        <QrCode className="w-10 h-10" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-slate-100">Camera Viewfinder Ready</div>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                          Scan the QR tag affixed on the machine control panel or upload a photo of the panel tag.
                        </p>
                      </div>
                      <button
                        onClick={startCameraScanner}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/30 transition-all"
                      >
                        <Camera className="w-4 h-4" /> Start Live Camera
                      </button>
                    </div>
                  )}
                </div>

                {scannerAlert && (
                  <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-600/60 text-amber-300 text-xs font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>{scannerAlert}</span>
                  </div>
                )}

                {/* Upload Tag Photo Option */}
                <div className="flex justify-center pt-2">
                  <label className="py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:border-amber-500/50 text-slate-300 hover:text-white font-bold flex items-center gap-2 cursor-pointer transition text-xs shadow-sm">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>Upload Machine Panel Tag Photo</span>
                    <input type="file" accept="image/*" onChange={handleQRFile} className="hidden" />
                  </label>
                </div>
              </div>
            )}

            {/* ================= STEP 2: CHECKLIST VIEW ================= */}
            {techActiveTab === 'checklist' && (
              <>
                {!currentStation ? (
                  <div className="bg-slate-900/95 text-white p-8 rounded-3xl border border-slate-800 text-center space-y-4 max-w-md mx-auto shadow-xl">
                    <div className="w-16 h-16 bg-slate-800 border border-slate-700 text-amber-400 rounded-2xl flex items-center justify-center text-2xl mx-auto">
                      <ClipboardList className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-white">No Machine QR Scanned</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Please walk to the machine and scan its control panel QR tag to load its official checklist.
                      </p>
                    </div>
                    <button
                      onClick={() => setTechActiveTab('scanner')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-lg transition"
                    >
                      <Camera className="w-4 h-4" /> Open Camera Scanner
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-900/95 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl border border-slate-800 space-y-6">
                    {/* Station Header & Strict 30-min Timer */}
                    <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-950/80 text-blue-400 border border-blue-800">
                            {currentStation.plant} ({currentStation.doc})
                          </span>
                          {lockoutStatus.isLocked ? (
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Permanently Locked (&gt;30m)
                            </span>
                          ) : (
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {lockoutStatus.formattedTime} left to edit
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg sm:text-xl font-black text-white mt-1">
                          {currentStation.code}. {currentStation.name}
                        </h3>
                        <p className="text-xs text-slate-400">
                          Doc Ref: {currentStation.doc} • Machine Tag: {currentStation.qr}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setCurrentStation(null);
                          setTechActiveTab('scanner');
                        }}
                        className="text-xs font-bold px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700"
                      >
                        Scan Another Machine
                      </button>
                    </div>

                    {/* Master Checkpoints List */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs text-slate-400 pb-1">
                        <span className="font-bold uppercase tracking-wider text-[11px] text-amber-400">
                          Master Checkpoints ({currentStation.items.length} checks)
                        </span>
                        <span>Tap status & enter observations</span>
                      </div>

                      {currentStation.items.map((it, idx) => {
                        const currentStatus = checklistValues[idx]?.status || 'OK';
                        const currentDefectNote = checklistValues[idx]?.defectNote || '';
                        const isLocked = lockoutStatus.isLocked;

                        return (
                          <div
                            key={idx}
                            className={`p-3.5 sm:p-4 rounded-2xl border transition-all space-y-3 ${
                              currentStatus === 'DEFECT'
                                ? 'bg-rose-950/20 border-rose-800/60'
                                : currentStatus === 'STANDBY'
                                ? 'bg-amber-950/20 border-amber-800/60'
                                : 'bg-slate-900/80 border-slate-800'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-2.5">
                              <div className="space-y-0.5 flex-1">
                                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">
                                  {it.eq}
                                </div>
                                <div className="text-sm font-black text-white leading-tight">
                                  {it.it}
                                </div>
                                <div className="text-xs text-slate-400">
                                  <span className="font-semibold text-slate-500">Look For: </span>
                                  {it.lf}
                                </div>
                              </div>

                              {/* 3-Way Segmented Touch Controls (OK, DEFECT, STANDBY) */}
                              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 shadow-inner w-full sm:w-auto">
                                <button
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() =>
                                    setChecklistValues((prev) => ({
                                      ...prev,
                                      [idx]: { ...prev[idx], status: 'OK' }
                                    }))
                                  }
                                  className={`touch-btn px-3 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1 transition-all ${
                                    currentStatus === 'OK'
                                      ? 'bg-emerald-500 text-slate-950 shadow-md scale-[1.02]'
                                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                                  } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <span>√</span>
                                  <span>OK</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() =>
                                    setChecklistValues((prev) => ({
                                      ...prev,
                                      [idx]: { ...prev[idx], status: 'DEFECT' }
                                    }))
                                  }
                                  className={`touch-btn px-3 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1 transition-all ${
                                    currentStatus === 'DEFECT'
                                      ? 'bg-rose-500 text-white shadow-md scale-[1.02]'
                                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                                  } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <span>X</span>
                                  <span>DEFECT</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() =>
                                    setChecklistValues((prev) => ({
                                      ...prev,
                                      [idx]: { ...prev[idx], status: 'STANDBY' }
                                    }))
                                  }
                                  className={`touch-btn px-3 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1 transition-all ${
                                    currentStatus === 'STANDBY'
                                      ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                                  } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <span>0</span>
                                  <span>STANDBY</span>
                                </button>
                              </div>
                            </div>

                            {/* Observation / Defect Note Text Box (Always Visible per user instruction) */}
                            <div className="pt-1">
                              <textarea
                                rows={2}
                                disabled={isLocked}
                                value={currentDefectNote}
                                onChange={(e) =>
                                  setChecklistValues((prev) => ({
                                    ...prev,
                                    [idx]: { ...prev[idx], defectNote: e.target.value }
                                  }))
                                }
                                placeholder={
                                  currentStatus === 'DEFECT'
                                    ? 'Describe defect (e.g. air leakage in solenoid 2, loose bolt, oil leakage)...'
                                    : currentStatus === 'STANDBY'
                                    ? 'Reason for standby (e.g. line 2 idle today, waiting for billets)...'
                                    : 'Checkpoint observation / note (e.g. greased and inspected, sound normal)...'
                                }
                                className={`w-full text-xs p-2.5 rounded-xl border outline-none transition ${
                                  currentStatus === 'DEFECT'
                                    ? 'border-rose-800/80 bg-rose-950/30 text-rose-100 placeholder:text-rose-400/50 focus:ring-1 focus:ring-rose-500'
                                    : currentStatus === 'STANDBY'
                                    ? 'border-amber-800/80 bg-amber-950/30 text-amber-100 placeholder:text-amber-400/50 focus:ring-1 focus:ring-amber-500'
                                    : 'border-slate-800 bg-slate-950 text-slate-200 placeholder:text-slate-600 focus:ring-1 focus:ring-slate-500'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {!lockoutStatus.isLocked ? (
                      <button
                        onClick={submitInspection}
                        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.99] text-slate-950 font-black py-4 px-4 rounded-2xl shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2.5 text-sm sm:text-base"
                      >
                        <CheckCircle className="w-5 h-5" />
                        <span>
                          {currentSubmission ? 'Update Station Inspection' : 'Submit Station Inspection'}
                        </span>
                      </button>
                    ) : (
                      <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <Lock className="w-4 h-4 text-rose-500" />
                        <span>This inspection is permanently locked (30-minute grace period has expired).</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ================= STEP 3: HISTORY & LOG VIEW ================= */}
            {techActiveTab === 'history' && (
              <div className="bg-slate-900/95 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-black text-white text-base tracking-tight flex items-center gap-2">
                      <History className="w-5 h-5 text-amber-400" />
                      <span>Floor Inspection History</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Recent inspections recorded on this device and synchronized with the Supabase database.
                    </p>
                  </div>
                  <a
                    href={`/api/export?month=${new Date().toISOString().slice(0, 7)}&plant=ALL`}
                    download
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Export Month Excel (.xlsx)
                  </a>
                </div>

                {inspectionsStore.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-16 h-16 bg-slate-800 border border-slate-700 text-slate-500 rounded-2xl flex items-center justify-center text-2xl mx-auto">
                      <Clock className="w-8 h-8" />
                    </div>
                    <div className="text-sm font-bold text-slate-300">No Inspection Records Yet</div>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Completed machine inspections for this month will appear here with instant audit review.
                    </p>
                    <button
                      onClick={() => setTechActiveTab('scanner')}
                      className="px-4 py-2 bg-amber-500 text-slate-950 font-black text-xs rounded-xl"
                    >
                      Scan First Station
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inspectionsStore.map((sub: any) => {
                      const elapsed = Date.now() - sub.submittedAt;
                      const isLocked = elapsed > LOCKOUT_DURATION_MS;
                      const minsLeft = Math.max(0, 30 - Math.floor(elapsed / 60000));
                      const defectsCount = sub.records?.filter((r: any) => r.status === 'DEFECT' || r.status === 'X').length || 0;
                      const okCount = sub.records?.filter((r: any) => r.status === 'OK' || r.status === '√').length || 0;

                      return (
                        <div
                          key={sub.id}
                          className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-slate-600 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                {sub.plant}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">
                                {sub.date} • {sub.epf}
                              </span>
                              {sub.isSynced ? (
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full">
                                  Synced
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded-full">
                                  Queued
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-black text-white">{sub.stationName}</h4>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-emerald-400 font-bold">{okCount} OK</span>
                              <span className="text-slate-500">•</span>
                              <span className={defectsCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                                {defectsCount} Defects
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                            <div className="text-right">
                              {isLocked ? (
                                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded-lg">
                                  <Lock className="w-3 h-3" /> Locked
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded-lg">
                                  <Clock className="w-3 h-3" /> {minsLeft}m left
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                const st = ALL_STATIONS.find((s) => s.id === sub.stationId);
                                if (st) {
                                  openStationChecklist(st);
                                }
                              }}
                              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                            >
                              <span>{isLocked ? 'View' : 'Edit'}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* MOBILE PINNED BOTTOM APP BAR */}
        {currentUser?.role === 'tech' && (
          <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 py-2 flex justify-around items-center text-[10px] font-bold text-slate-400 shadow-2xl">
            <button
              onClick={() => setTechActiveTab('scanner')}
              className={`flex flex-col items-center gap-1 transition ${
                techActiveTab === 'scanner' ? 'text-amber-400' : 'hover:text-white'
              }`}
            >
              <Camera className="w-5 h-5" />
              <span>Scan</span>
            </button>

            {/* Floating Elevated Amber QR Button */}
            <button
              onClick={() => {
                setTechActiveTab('scanner');
                startCameraScanner();
              }}
              className="w-12 h-12 -mt-5 bg-amber-500 hover:bg-amber-400 active:scale-90 text-slate-950 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/40 border-4 border-slate-900 transition-transform"
              title="Quick Camera Scan"
            >
              <QrCode className="w-6 h-6" />
            </button>

            <button
              onClick={() => {
                if (currentStation) {
                  setTechActiveTab('checklist');
                } else {
                  toast.info('Please scan a machine panel QR tag first.');
                }
              }}
              className={`flex flex-col items-center gap-1 transition relative ${
                techActiveTab === 'checklist' ? 'text-amber-400' : 'hover:text-white'
              }`}
            >
              <ClipboardList className="w-5 h-5" />
              <span>Checklist</span>
              {currentStation && (
                <span className="absolute -top-1 right-2 w-2 h-2 rounded-full bg-amber-400"></span>
              )}
            </button>

            <button
              onClick={() => setTechActiveTab('history')}
              className={`flex flex-col items-center gap-1 transition ${
                techActiveTab === 'history' ? 'text-amber-400' : 'hover:text-white'
              }`}
            >
              <History className="w-5 h-5" />
              <span>History</span>
            </button>
          </nav>
        )}

        {/* ================= SUPERVISOR / ADMIN DASHBOARD ================= */}
        {currentUser?.role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-5 rounded-2xl shadow-xl border border-slate-800 flex flex-wrap justify-between items-center gap-4 text-white">
              <div>
                <span className="text-xs uppercase font-bold text-amber-400 tracking-wider">
                  Engineering Supervisor Portal
                </span>
                <h2 className="text-xl font-black text-white">Plant Audit & Review Dashboard</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inspect machine records, review 30-min lock compliance, inspect defect notes & export official Excel reports.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/export?month=${adminMonth}&plant=${adminPlantFilter}`}
                  download
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow transition"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Download Excel (.xlsx)
                </a>
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-400 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow transition border border-slate-700"
                >
                  <Printer className="w-4 h-4" /> Station QR Tags
                </button>
              </div>
            </div>

            {/* KPI Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-white shadow-sm">
                <span className="text-xs text-slate-400 font-semibold uppercase">Inspection Month</span>
                <input
                  type="month"
                  value={adminMonth}
                  onChange={(e) => setAdminMonth(e.target.value)}
                  className="mt-1 w-full font-bold text-white bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm outline-none"
                />
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-white shadow-sm">
                <span className="text-xs text-slate-400 font-semibold uppercase">Filter Plant</span>
                <select
                  value={adminPlantFilter}
                  onChange={(e: any) => setAdminPlantFilter(e.target.value)}
                  className="mt-1 w-full font-bold text-white bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm outline-none"
                >
                  <option value="ALL">All Plants (146 Checkpoints)</option>
                  <option value="EXTRUSION">Extrusion Plant (CH/MT/102 - 84 Checks)</option>
                  <option value="VPC">VPC Plant (LS/MT/102 - 62 Checks)</option>
                </select>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-white shadow-sm">
                <span className="text-xs text-slate-400 font-semibold uppercase">Total Master Checkpoints</span>
                <div className="text-2xl font-black text-white mt-1">
                  {adminPlantFilter === 'ALL' ? 146 : adminPlantFilter === 'EXTRUSION' ? 84 : 62}
                </div>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-white shadow-sm">
                <span className="text-xs text-slate-400 font-semibold uppercase">Total Defects (DEFECT)</span>
                <div className="text-2xl font-black text-rose-500 mt-1">{totalDefectsCount}</div>
              </div>
            </div>

            {/* 1-31 Day Monthly Audit Review Matrix */}
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden text-white">
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-white text-sm">Monthly Verification Grid (Days 1 to 31)</h3>
                  <p className="text-xs text-slate-400">
                    Condition OK: √ (Green) | Defect: X (Red) | Standby: 0 (Gray) | Click cell for details
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> OK
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-400 ml-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Defect
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-400 ml-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> Standby
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto scrollbar-thin max-h-[550px]">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-950 text-slate-400 sticky top-0 z-20">
                    <tr>
                      <th className="p-2.5 border border-slate-800 sticky left-0 bg-slate-950 z-30 min-w-[140px]">Equipment</th>
                      <th className="p-2.5 border border-slate-800 sticky left-[140px] bg-slate-950 z-30 min-w-[160px]">Item</th>
                      <th className="p-2.5 border border-slate-800 min-w-[220px]">Look For Criteria</th>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <th key={d} className="p-1 border border-slate-800 text-center min-w-[32px]">
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStations.map((st) =>
                      st.items.map((it, idx) => {
                        return (
                          <tr key={`${st.id}-${idx}`} className="hover:bg-slate-800/50 border-b border-slate-800/80">
                            <td className="p-2 border border-slate-800 sticky left-0 bg-slate-900 font-bold z-10 text-white">
                              {it.eq}
                            </td>
                            <td className="p-2 border border-slate-800 sticky left-[140px] bg-slate-900 z-10 text-slate-200">
                              {it.it}
                            </td>
                            <td className="p-2 border border-slate-800 text-slate-400 text-[11px]">{it.lf}</td>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                              const sub = monthInspections.find((s) => s.stationId === st.id && s.day === d);
                              const rec = sub?.records?.[idx];
                              const status = rec?.status;

                              let cellColor = 'text-slate-700';
                              let displayVal = '-';

                              if (status === 'OK' || status === '√') {
                                cellColor = 'bg-emerald-950/60 text-emerald-400 font-black';
                                displayVal = '√';
                              } else if (status === 'DEFECT' || status === 'X') {
                                cellColor = 'bg-rose-950/80 text-rose-400 font-black';
                                displayVal = 'X';
                              } else if (status === 'STANDBY' || status === '0') {
                                cellColor = 'bg-slate-800 text-slate-400';
                                displayVal = '0';
                              }

                              return (
                                <td
                                  key={d}
                                  onClick={() => rec && setSelectedCellAudit({ sub, rec, st, day: d })}
                                  className={`p-1 border border-slate-800 text-center cursor-pointer transition ${cellColor}`}
                                >
                                  {displayVal}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TECHNICIAN PROFILE & PASSWORD MAINTENANCE MODAL */}
        {showProfileModal && currentUser && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-5">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-base">Technician Profile</h3>
                    <p className="text-xs text-slate-400">Maintain credentials & security</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">EPF Number:</span>
                  <span className="font-mono font-bold text-amber-400">{currentUser.epf || 'EPF-4820'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Role:</span>
                  <span className="font-bold text-emerald-400 uppercase">{currentUser.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Auth Status:</span>
                  <span className="text-slate-300">Default password is "tech123"</span>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3.5">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>Change Password</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="Default is tech123"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="At least 4 characters"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={passwordChangeLoading}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 transition disabled:opacity-50"
                >
                  {passwordChangeLoading ? 'Updating Password...' : 'Save New Password'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* CELL AUDIT DETAIL MODAL */}
        {selectedCellAudit && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-800 text-white">
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm">Inspection Audit Detail</h3>
                </div>
                <button
                  onClick={() => setSelectedCellAudit(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 space-y-3.5 text-xs">
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-amber-400">
                    {selectedCellAudit.sub.plant} • {selectedCellAudit.sub.stationName}
                  </div>
                  <div className="text-sm font-black text-white">
                    {selectedCellAudit.rec.equipment} - {selectedCellAudit.rec.item}
                  </div>
                  <div className="text-slate-400">Standard: {selectedCellAudit.rec.look_for}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 border border-slate-800 bg-slate-950 rounded-xl">
                    <span className="text-slate-400 block font-semibold text-[10px]">INSPECTION STATUS</span>
                    <span
                      className={`text-base font-black ${
                        selectedCellAudit.rec.status === 'OK' || selectedCellAudit.rec.status === '√'
                          ? 'text-emerald-400'
                          : selectedCellAudit.rec.status === 'DEFECT' || selectedCellAudit.rec.status === 'X'
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {selectedCellAudit.rec.status}
                    </span>
                  </div>
                  <div className="p-3 border border-slate-800 bg-slate-950 rounded-xl">
                    <span className="text-slate-400 block font-semibold text-[10px]">LOCKOUT STATUS</span>
                    <span className="font-bold flex items-center gap-1 mt-1 text-slate-300">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      {Date.now() - selectedCellAudit.sub.submittedAt > LOCKOUT_DURATION_MS
                        ? 'Permanently Locked'
                        : 'Editable (Grace Window)'}
                    </span>
                  </div>
                </div>

                {selectedCellAudit.rec.defectNote && (
                  <div className="p-3 border border-slate-800 bg-slate-950 rounded-xl space-y-1">
                    <span className="text-slate-400 block font-semibold text-[10px]">OBSERVATIONS / DEFECT NOTE</span>
                    <p className="text-xs text-amber-300 font-medium">{selectedCellAudit.rec.defectNote}</p>
                  </div>
                )}

                <div className="p-3 border border-slate-800 bg-slate-950 rounded-xl space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Inspector EPF:</span>
                    <b className="font-mono text-amber-300">{selectedCellAudit.sub.epf}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Inspection Time:</span>
                    <b>{new Date(selectedCellAudit.sub.submittedAt).toLocaleString()}</b>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCellAudit(null)}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl transition"
                >
                  Close Audit View
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PRINTABLE QR TAGS MODAL */}
        {showPrintModal && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-white shadow-2xl">
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-sm">Station QR Tags for Machine Panels</h3>
                </div>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <p className="text-xs text-slate-400">
                  Print these official high-contrast QR tags and affix them directly on the machine control panels.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ALL_STATIONS.map((st) => (
                    <div
                      key={st.id}
                      className="p-4 rounded-2xl border border-slate-800 bg-slate-950 flex items-center space-x-4 shadow-sm"
                    >
                      <div className="bg-white p-2 rounded-xl">
                        <QRCodeSVG value={st.qr} size={70} level="M" />
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        <span className="text-[10px] font-bold text-amber-400 uppercase">
                          [{st.plantKey}] {st.doc}
                        </span>
                        <div className="text-xs font-black text-white truncate">
                          {st.code}. {st.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">TAG: {st.qr}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition"
                >
                  Print QR Sheets
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
