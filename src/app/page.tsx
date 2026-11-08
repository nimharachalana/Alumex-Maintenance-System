'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ALL_STATIONS, MASTER_DATA, StationMaster } from '@/lib/master-data';
import { evaluateLockout, LOCKOUT_DURATION_MS, LockoutStatus } from '@/lib/lockout';
import { offlineDb, OfflineInspection } from '@/lib/offline-db';
import { QRCodeSVG } from 'qrcode.react';
import {
  Wrench,
  ShieldCheck,
  Camera,
  Share2,
  Lock,
  Clock,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Printer,
  Upload,
  Download,
  Eye,
  EyeOff,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  Search,
  Gauge
} from 'lucide-react';

interface CurrentUser {
  role: 'tech' | 'admin';
  epf?: string;
}

export default function PlantMaintenancePortal() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authRole, setAuthRole] = useState<'tech' | 'admin'>('tech');
  const [epfInput, setEpfInput] = useState('EPF-4820');
  const [passInput, setPassInput] = useState('tech123');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Floor Scanner & Checklist states
  const [currentStation, setCurrentStation] = useState<StationMaster | null>(null);
  const [selectedShift, setSelectedShift] = useState('Shift 1');
  const [checklistValues, setChecklistValues] = useState<{ [key: number]: { status: string; reading: string } }>({});
  const [technicianRemarks, setTechnicianRemarks] = useState('');
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
  const [showDevSimulator, setShowDevSimulator] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showSyncQRModal, setShowSyncQRModal] = useState(false);
  const [selectedCellAudit, setSelectedCellAudit] = useState<any>(null);

  // Admin filter states
  const [adminMonth, setAdminMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [adminPlantFilter, setAdminPlantFilter] = useState<'ALL' | 'EXTRUSION' | 'VPC'>('ALL');

  // Canvas Signature Pad
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const html5ScannerRef = useRef<any>(null);

  // 1. Initial Setup & Network Listeners
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineInspections();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Auto-restore session from localStorage if present
    const saved = localStorage.getItem('alumex_next_session');
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch (e) {}
    }

    // Load initial inspections from IndexedDB or API
    loadStoredInspections();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Load inspections from IndexedDB & Server
  async function loadStoredInspections() {
    try {
      if (offlineDb) {
        const localList = await offlineDb.inspections.toArray();
        setInspectionsStore(localList);
        const unsynced = localList.filter((item) => !item.isSynced);
        setPendingSyncCount(unsynced.length);
      }

      // Try fetching from server if online
      if (navigator.onLine) {
        const res = await fetch(`/api/inspections?month=${adminMonth}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            // Merge with local records
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
                  shift: srv.shift,
                  epf: srv.epf,
                  remarks: srv.remarks || '',
                  signatureUrl: srv.signatureUrl,
                  submittedAt: srv.submittedAt,
                  lastModifiedAt: srv.lastModifiedAt,
                  records: srv.items.map((i: any) => ({
                    item: i.checkpoint?.itemName || '',
                    equipment: i.checkpoint?.equipmentName || '',
                    look_for: i.checkpoint?.lookForCriteria || '',
                    status: i.status,
                    reading: i.reading || ''
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

  // 3. Auto-sync offline queued inspections to server
  async function syncOfflineInspections() {
    if (!offlineDb || !navigator.onLine) return;
    try {
      const pending = await offlineDb.inspections.where('isSynced').equals(0).toArray();
      for (const item of pending) {
        const res = await fetch('/api/inspections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });
        if (res.ok) {
          await offlineDb.inspections.update(item.id, { isSynced: true });
        }
      }
      loadStoredInspections();
    } catch (e) {
      console.warn('Sync failed:', e);
    }
  }

  // 4. Live 30-Minute Lockout Timer countdown
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
      const isAdmin = currentUser?.role === 'admin';
      const status = evaluateLockout(currentSubmission.submittedAt, isAdmin);
      setLockoutStatus(status);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSubmission, currentUser]);

  // 5. Auth Handlers
  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    const pass = passInput.trim().toLowerCase();

    if (pass === 'admin123' || pass === 'admin') {
      const user: CurrentUser = { role: 'admin' };
      setCurrentUser(user);
      localStorage.setItem('alumex_next_session', JSON.stringify(user));
    } else if (pass === 'tech123' || pass === 'tech') {
      const user: CurrentUser = { role: 'tech', epf: epfInput.trim() || 'EPF-4820' };
      setCurrentUser(user);
      localStorage.setItem('alumex_next_session', JSON.stringify(user));
    } else {
      setLoginError('Invalid credentials. Technician password is "tech123", Supervisor is "admin123".');
    }
  }

  function handleLogout() {
    stopCameraScanner();
    setCurrentUser(null);
    setCurrentStation(null);
    localStorage.removeItem('alumex_next_session');
  }

  // 6. Camera QR Scanner for Machine Panels
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
      setScannerAlert('Camera permission error. Please allow camera or use photo upload / simulator.');
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
      alert('Could not detect a QR code in the photo. Please ensure tag is clearly visible.');
    }
  }

  function handleScannedTag(tag: string) {
    stopCameraScanner();
    const found = ALL_STATIONS.find(
      (s) => s.qr.toLowerCase() === tag.toLowerCase() || s.id.toLowerCase() === tag.toLowerCase()
    );

    if (found) {
      openStationChecklist(found);
    } else {
      setScannerAlert(`Scanned code "${tag}" is not a recognized machine panel tag.`);
    }
  }

  // 7. Load Station Checklist & Check 30-Min Lockout
  function openStationChecklist(st: StationMaster) {
    setCurrentStation(st);
    const today = new Date().toISOString().slice(0, 10);

    // Look for existing submission in memory
    const existing = inspectionsStore.find(
      (s) => s.stationId === st.id && s.date === today && s.shift === selectedShift
    );

    setCurrentSubmission(existing || null);

    const initialVals: any = {};
    st.items.forEach((item, idx) => {
      let savedVal = '√';
      let savedReading = '';
      if (existing?.records?.[idx]) {
        savedVal = existing.records[idx].status || '√';
        savedReading = existing.records[idx].reading || '';
      }
      initialVals[idx] = { status: savedVal, reading: savedReading };
    });

    setChecklistValues(initialVals);
    setTechnicianRemarks(existing?.remarks || '');
    setTimeout(initCanvas, 100);
  }

  // 8. Signature Pad Canvas logic
  function initCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0f172a';
    ctx.lineCap = 'round';
  }

  function startDrawing(e: any) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  }

  function draw(e: any) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    e.preventDefault();
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // 9. Submit Station Inspection (Dual-Save: IndexedDB + Server)
  async function submitInspection() {
    if (!currentStation) return;
    const isAdmin = currentUser?.role === 'admin';

    // 30-minute lockout validation check
    if (currentSubmission?.submittedAt && !isAdmin) {
      const elapsed = Date.now() - currentSubmission.submittedAt;
      if (elapsed > LOCKOUT_DURATION_MS) {
        alert('Action Rejected: 30 minutes have elapsed since submission. Records are permanently locked.');
        return;
      }
    }

    const todayDate = new Date().toISOString().slice(0, 10);
    const subId =
      currentSubmission?.id ||
      `INS-${currentStation.id}-${todayDate}-${selectedShift.replace(' ', '')}`;

    const records = currentStation.items.map((it, idx) => ({
      item: it.it,
      equipment: it.eq,
      look_for: it.lf,
      status: checklistValues[idx]?.status || '√',
      reading: checklistValues[idx]?.reading || ''
    }));

    const canvas = canvasRef.current;
    const sigData = canvas ? canvas.toDataURL() : currentSubmission?.signatureUrl || '';

    const originalTime = currentSubmission?.submittedAt || Date.now();

    const inspectionPayload: OfflineInspection = {
      id: subId,
      stationId: currentStation.id,
      stationName: currentStation.name,
      plant: currentStation.plantKey,
      date: todayDate,
      day: new Date().getDate(),
      month: todayDate.slice(0, 7),
      shift: selectedShift,
      epf: currentUser?.epf || currentSubmission?.epf || 'EPF-TECH',
      remarks: technicianRemarks,
      signatureUrl: sigData,
      submittedAt: originalTime,
      lastModifiedAt: Date.now(),
      records,
      isSynced: false
    };

    // 1. ALWAYS Save locally into IndexedDB immediately (100% Offline Functional)
    if (offlineDb) {
      await offlineDb.inspections.put(inspectionPayload);
    }

    // 2. If online, sync directly to SQLite server
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/inspections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...inspectionPayload, isAdmin })
        });
        if (res.ok) {
          inspectionPayload.isSynced = true;
          if (offlineDb) {
            await offlineDb.inspections.update(subId, { isSynced: true });
          }
        }
      } catch (err) {
        console.warn('Server sync failed, will auto-sync later:', err);
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

    alert(
      `Inspection recorded successfully for ${currentStation.name}! Note: Checkpoints can be edited within the next 30 minutes.`
    );
    setCurrentStation(null);
    setCurrentSubmission(null);
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
      if (r.status === 'X') totalDefectsCount++;
    });
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* NAVIGATION BAR */}
      <header className="bg-slate-900 text-white shadow sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black text-xl shadow">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold leading-tight">Alumex Maintenance System</h1>
              <p className="text-xs text-slate-400">Next.js 14 CMMS • Extrusion (CH/MT/102) & VPC (LS/MT/102)</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Offline / Online Network Indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${
                isOnline
                  ? 'bg-emerald-950 border-emerald-700 text-emerald-400'
                  : 'bg-rose-950 border-rose-700 text-rose-400 animate-pulse'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? 'Online (SQLite)' : 'Offline (IndexedDB Active)'}</span>
            </div>

            {pendingSyncCount > 0 && (
              <button
                onClick={syncOfflineInspections}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-full transition"
                title="Click to sync offline records"
              >
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>{pendingSyncCount} Queued</span>
              </button>
            )}

            {currentUser && (
              <button
                onClick={handleLogout}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* ================= AUTHENTICATION VIEW ================= */}
        {!currentUser && (
          <div className="max-w-md mx-auto mt-10 bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-200">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-slate-900">Portal Login</h2>
              <p className="text-xs text-slate-500 mt-1">Industrial Floor Maintenance Access</p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-5">
              <button
                type="button"
                onClick={() => setAuthRole('tech')}
                className={`py-2.5 text-xs font-bold rounded-lg transition ${
                  authRole === 'tech' ? 'bg-white shadow text-blue-600' : 'text-slate-600'
                }`}
              >
                Technician
              </button>
              <button
                type="button"
                onClick={() => setAuthRole('admin')}
                className={`py-2.5 text-xs font-bold rounded-lg transition ${
                  authRole === 'admin' ? 'bg-white shadow text-amber-600' : 'text-slate-600'
                }`}
              >
                Supervisor
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {authRole === 'tech' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Technician EPF No</label>
                  <input
                    type="text"
                    value={epfInput}
                    onChange={(e) => setEpfInput(e.target.value)}
                    placeholder="e.g. EPF-4820"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={passInput}
                    onChange={(e) => setPassInput(e.target.value)}
                    placeholder="tech123 (Tech) or admin123 (Admin)"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition"
              >
                Sign In to Portal
              </button>

              <div className="pt-3 border-t border-slate-100">
                <div className="text-[11px] font-bold text-slate-400 uppercase text-center mb-2">Quick Floor Access</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthRole('tech');
                      setEpfInput('EPF-4820');
                      setPassInput('tech123');
                      setCurrentUser({ role: 'tech', epf: 'EPF-4820' });
                    }}
                    className="py-2 px-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-700 transition"
                  >
                    Tech (tech123)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthRole('admin');
                      setPassInput('admin123');
                      setCurrentUser({ role: 'admin' });
                    }}
                    className="py-2 px-3 bg-slate-50 hover:bg-amber-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:text-amber-700 transition"
                  >
                    Admin (admin123)
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ================= TECHNICIAN PORTAL ================= */}
        {currentUser?.role === 'tech' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
              <div>
                <span className="text-xs uppercase font-bold text-blue-600 tracking-wider">Field Inspection Mode</span>
                <h2 className="text-xl font-black text-slate-900">Welcome Technician ({currentUser.epf})</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rule: Checkpoints can be modified within <b>30 minutes</b> of marking. After 30 minutes, records are permanently locked.
                </p>
              </div>
              <button
                onClick={() => setShowSyncQRModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow text-xs transition"
              >
                <Share2 className="w-4 h-4" /> Share to Laptop (QR Beam)
              </button>
            </div>

            {/* SCANNER TAB (No manual station grid) */}
            {!currentStation && (
              <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                      <h3 className="font-black text-slate-900 text-base">Machine Panel QR Scanner</h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Walk up to the machine panel and scan its QR tag to load the official checklist.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!scannerActive ? (
                      <button
                        onClick={startCameraScanner}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow transition"
                      >
                        <Camera className="w-4 h-4" /> Start Live Camera
                      </button>
                    ) : (
                      <button
                        onClick={stopCameraScanner}
                        className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition"
                      >
                        Stop Camera
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative bg-slate-950 rounded-2xl overflow-hidden min-h-[260px] flex items-center justify-center border border-slate-800 shadow-inner">
                  <div id="floor-qr-reader" className="w-full"></div>
                  {!scannerActive && (
                    <div className="text-center p-6 space-y-2">
                      <div className="w-14 h-14 bg-slate-800 text-blue-400 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-inner">
                        <Camera className="w-7 h-7" />
                      </div>
                      <div className="text-xs font-bold text-slate-200">Camera Viewfinder Inactive</div>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        Click "Start Live Camera" to scan, or select a photo of the panel QR code from your gallery below.
                      </p>
                    </div>
                  )}
                </div>

                {scannerAlert && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    {scannerAlert}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
                  <label className="font-bold text-slate-600 flex items-center gap-2 cursor-pointer hover:text-blue-600 transition">
                    <Upload className="w-4 h-4 text-blue-500" /> Or Select Tag Photo from Gallery
                    <input type="file" accept="image/*" onChange={handleQRFile} className="hidden" />
                  </label>
                  <button
                    onClick={() => setShowDevSimulator(!showDevSimulator)}
                    className="text-[11px] font-bold text-slate-400 hover:text-blue-600 underline"
                  >
                    Quick Station Simulator (Floor Dev/Test)
                  </button>
                </div>

                {showDevSimulator && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">
                        Simulate Machine Tag Scan (Click to test):
                      </span>
                      <span className="text-[10px] text-slate-400">13 Master Stations</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                      {ALL_STATIONS.map((st) => (
                        <button
                          key={st.id}
                          onClick={() => handleScannedTag(st.qr)}
                          className="text-left p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 text-[10px] font-bold text-slate-700 truncate transition"
                        >
                          <span className="text-blue-600 font-extrabold">[{st.plantKey}]</span> {st.code}. {st.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CHECKLIST FORM CONTAINER */}
            {currentStation && (
              <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
                <div className="border-b pb-4 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                        {currentStation.plant} ({currentStation.doc})
                      </span>
                      {lockoutStatus.isLocked && (
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Locked (&gt;30m)
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mt-1">
                      {currentStation.code}. {currentStation.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Document Ref: {currentStation.doc} • Machine Panel Tag: {currentStation.qr}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCurrentStation(null);
                        startCameraScanner();
                      }}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 transition"
                    >
                      <Camera className="w-3.5 h-3.5" /> Scan Another Machine
                    </button>
                    <button
                      onClick={() => setCurrentStation(null)}
                      className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* 30-MINUTE LOCKOUT BANNER */}
                {lockoutStatus.isLocked ? (
                  <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 text-xs flex items-start gap-3">
                    <Lock className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <b>🔒 Checklist Permanently Locked (30-Minute Grace Window Expired):</b>
                      <p className="mt-0.5 text-rose-700">
                        This station inspection was submitted earlier by <b>{currentSubmission?.epf}</b>. As per plant policy, checklist details cannot be altered after 30 minutes.
                      </p>
                    </div>
                  </div>
                ) : currentSubmission ? (
                  <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <b>⚠️ 30-Minute Modification Grace Window Active:</b>
                      <p className="mt-0.5 text-amber-800">
                        You have <b className="font-mono text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-300">{lockoutStatus.formattedTime} remaining</b> to edit values before this checklist permanently locks.
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Date</span>
                    <b>{new Date().toLocaleDateString('en-GB')}</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Shift</span>
                    <select
                      value={selectedShift}
                      onChange={(e) => setSelectedShift(e.target.value)}
                      className="bg-white border rounded px-1.5 py-0.5 font-bold outline-none"
                    >
                      <option value="Shift 1">Shift 1 (Morning)</option>
                      <option value="Shift 2">Shift 2 (Evening)</option>
                      <option value="Shift 3">Shift 3 (Night)</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Inspector EPF</span>
                    <b>{currentUser.epf}</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Checkpoints</span>
                    <b className="text-blue-600">{currentStation.items.length} Checks</b>
                  </div>
                </div>

                {/* Checklist Rows */}
                <div className="space-y-3">
                  {currentStation.items.map((item, idx) => {
                    const currentVal = checklistValues[idx]?.status || '√';
                    const currentReading = checklistValues[idx]?.reading || '';
                    const isLocked = lockoutStatus.isLocked;

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2.5 ${
                          isLocked ? 'locked-field' : ''
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                          <div className="flex-1">
                            <span className="text-xs font-bold text-slate-900">
                              {idx + 1}. {item.eq} - {item.it}
                            </span>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                              Standard: {item.lf}
                            </p>
                          </div>
                          <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-white shadow-sm self-start">
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() =>
                                setChecklistValues((prev) => ({
                                  ...prev,
                                  [idx]: { ...prev[idx], status: '√' }
                                }))
                              }
                              className={`px-2.5 py-1 text-xs font-bold rounded transition ${
                                currentVal === '√' ? 'bg-emerald-600 text-white' : 'text-slate-700'
                              }`}
                            >
                              √ OK
                            </button>
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() =>
                                setChecklistValues((prev) => ({
                                  ...prev,
                                  [idx]: { ...prev[idx], status: 'X' }
                                }))
                              }
                              className={`px-2.5 py-1 text-xs font-bold rounded transition ${
                                currentVal === 'X' ? 'bg-rose-600 text-white' : 'text-slate-700'
                              }`}
                            >
                              X Defect
                            </button>
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() =>
                                setChecklistValues((prev) => ({
                                  ...prev,
                                  [idx]: { ...prev[idx], status: '0' }
                                }))
                              }
                              className={`px-2.5 py-1 text-xs font-bold rounded transition ${
                                currentVal === '0' ? 'bg-slate-600 text-white' : 'text-slate-700'
                              }`}
                            >
                              0 Standby
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                            Reading / Value:
                          </span>
                          <input
                            type="text"
                            disabled={isLocked}
                            value={currentReading}
                            onChange={(e) =>
                              setChecklistValues((prev) => ({
                                ...prev,
                                [idx]: { ...prev[idx], reading: e.target.value }
                              }))
                            }
                            placeholder="e.g. pressure (bar), temp (°C), motor vibration or remarks"
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Notes & Canvas Signature Pad */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Defects / Observations
                    </label>
                    <textarea
                      rows={3}
                      value={technicianRemarks}
                      onChange={(e) => setTechnicianRemarks(e.target.value)}
                      placeholder="Enter technician notes..."
                      disabled={lockoutStatus.isLocked}
                      className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-600 uppercase">Technician Signature</label>
                      <button
                        type="button"
                        onClick={clearSignature}
                        className="text-[11px] text-rose-500 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="border border-slate-300 rounded-xl bg-slate-50 overflow-hidden">
                      <canvas
                        ref={canvasRef}
                        width={340}
                        height={90}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full cursor-crosshair touch-none"
                      />
                    </div>
                  </div>
                </div>

                {!lockoutStatus.isLocked && (
                  <button
                    onClick={submitInspection}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span>
                      {currentSubmission ? 'Update Station Inspection' : 'Submit Station Inspection'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= SUPERVISOR / ADMIN DASHBOARD ================= */}
        {currentUser?.role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
              <div>
                <span className="text-xs uppercase font-bold text-amber-600 tracking-wider">Engineering Admin Portal</span>
                <h2 className="text-xl font-black text-slate-900">Plant Audit & Review Dashboard</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-User Coverage: Inspect submissions, view 30-min lock status, review parameters & export official Excel reports.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/export?month=${adminMonth}&plant=${adminPlantFilter}`}
                  download
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow transition"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Download Excel (.xlsx)
                </a>
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow transition"
                >
                  <Printer className="w-4 h-4" /> Station QR Tags
                </button>
              </div>
            </div>

            {/* KPI Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-400 font-semibold uppercase">Inspection Month</span>
                <input
                  type="month"
                  value={adminMonth}
                  onChange={(e) => setAdminMonth(e.target.value)}
                  className="mt-1 w-full font-bold text-slate-800 bg-slate-50 border rounded-lg px-2 py-1 text-sm outline-none"
                />
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-400 font-semibold uppercase">Filter Plant</span>
                <select
                  value={adminPlantFilter}
                  onChange={(e: any) => setAdminPlantFilter(e.target.value)}
                  className="mt-1 w-full font-bold text-slate-800 bg-slate-50 border rounded-lg px-2 py-1 text-sm outline-none"
                >
                  <option value="ALL">All Plants (146 Checkpoints)</option>
                  <option value="EXTRUSION">Extrusion Plant (CH/MT/102 - 84 Checks)</option>
                  <option value="VPC">VPC Plant (LS/MT/102 - 62 Checks)</option>
                </select>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-400 font-semibold uppercase">Total Master Checkpoints</span>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {adminPlantFilter === 'ALL' ? 146 : adminPlantFilter === 'EXTRUSION' ? 84 : 62}
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-400 font-semibold uppercase">Open Defects (X)</span>
                <div className="text-2xl font-black text-rose-600 mt-1">{totalDefectsCount}</div>
              </div>
            </div>

            {/* 1-31 Day Monthly Audit Review Matrix */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Monthly Verification Grid (Days 1 to 31)</h3>
                  <p className="text-xs text-slate-500">
                    Condition OK: √ (Green) | Not OK: X (Red) | Standby: 0 (Gray) | Click cell for detailed log
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> OK (√)
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-700 ml-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Defect (X)
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-500 ml-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Standby (0)
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto scrollbar-thin max-h-[550px]">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 sticky top-0 z-20 text-slate-700 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="p-2 border sticky left-0 bg-slate-100 z-30 min-w-[140px]">Equipment</th>
                      <th className="p-2 border sticky left-[140px] bg-slate-100 z-30 min-w-[160px]">Item</th>
                      <th className="p-2 border min-w-[220px]">Look For Criteria</th>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <th key={d} className="p-1 border text-center min-w-[28px]">
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStations.map((st) =>
                      st.items.map((it, itIdx) => (
                        <tr key={`${st.id}-${itIdx}`} className="hover:bg-slate-50">
                          <td className="p-2 border font-bold text-slate-800 sticky left-0 bg-white z-10">
                            {it.eq}
                          </td>
                          <td className="p-2 border font-medium text-slate-700 sticky left-[140px] bg-white z-10">
                            {it.it}
                          </td>
                          <td className="p-2 border text-slate-500">{it.lf}</td>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                            const sub = monthInspections.find((s) => s.stationId === st.id && s.day === d);
                            const rec = sub?.records?.find(
                              (r: any) => r.item === it.it && r.equipment === it.eq
                            );
                            const val = rec ? rec.status : '-';

                            let cellClass = 'text-slate-300';
                            if (val === '√') cellClass = 'bg-emerald-100 text-emerald-800 font-bold cursor-pointer hover:ring-2 hover:ring-emerald-400';
                            else if (val === 'X') cellClass = 'bg-rose-100 text-rose-800 font-black cursor-pointer hover:ring-2 hover:ring-rose-400';
                            else if (val === '0') cellClass = 'bg-slate-200 text-slate-700 font-bold cursor-pointer hover:ring-2 hover:ring-slate-400';

                            return (
                              <td
                                key={d}
                                onClick={() => {
                                  if (sub && rec) {
                                    setSelectedCellAudit({ sub, rec, st });
                                  }
                                }}
                                className={`p-1 border text-center ${cellClass}`}
                              >
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CELL AUDIT DETAIL MODAL */}
        {selectedCellAudit && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
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
                <div className="p-3 bg-slate-50 rounded-2xl border space-y-1">
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    {selectedCellAudit.sub.plant} • {selectedCellAudit.sub.stationName}
                  </div>
                  <div className="text-sm font-black text-slate-900">
                    {selectedCellAudit.rec.equipment} - {selectedCellAudit.rec.item}
                  </div>
                  <div className="text-slate-600">Standard: {selectedCellAudit.rec.look_for}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 border rounded-xl">
                    <span className="text-slate-400 block font-semibold text-[10px]">INSPECTION RATING</span>
                    <span
                      className={`text-lg font-black ${
                        selectedCellAudit.rec.status === '√'
                          ? 'text-emerald-600'
                          : selectedCellAudit.rec.status === 'X'
                          ? 'text-rose-600'
                          : 'text-slate-600'
                      }`}
                    >
                      {selectedCellAudit.rec.status === '√'
                        ? '√ Condition OK'
                        : selectedCellAudit.rec.status === 'X'
                        ? 'X Defect'
                        : '0 Standby'}
                    </span>
                  </div>
                  <div className="p-3 border rounded-xl">
                    <span className="text-slate-400 block font-semibold text-[10px]">RECORD LOCK STATUS</span>
                    <span className="font-bold flex items-center gap-1 mt-1 text-slate-700">
                      <Lock className="w-3.5 h-3.5" />
                      {Date.now() - selectedCellAudit.sub.submittedAt > LOCKOUT_DURATION_MS
                        ? 'Permanently Locked'
                        : 'Editable (Grace Window)'}
                    </span>
                  </div>
                </div>

                <div className="p-3 border rounded-xl space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Inspector EPF:</span>
                    <b>{selectedCellAudit.sub.epf}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Inspection Time:</span>
                    <b>{new Date(selectedCellAudit.sub.submittedAt).toLocaleString()}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Plant Shift:</span>
                    <b>{selectedCellAudit.sub.shift}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Parameter Reading / Value:</span>
                    <b className="text-blue-600">
                      {selectedCellAudit.rec.reading || 'N/A (Standard Check)'}
                    </b>
                  </div>
                </div>

                {selectedCellAudit.sub.remarks && (
                  <div className="p-3 border border-amber-200 bg-amber-50 rounded-xl">
                    <span className="text-amber-800 font-bold block text-[10px] uppercase">
                      Technician Notes:
                    </span>
                    <p className="text-slate-800 mt-0.5">{selectedCellAudit.sub.remarks}</p>
                  </div>
                )}
              </div>
              <div className="p-4 bg-slate-50 border-t flex justify-end">
                <button
                  onClick={() => setSelectedCellAudit(null)}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold"
                >
                  Close Audit Window
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PRINT MACHINE QR TAGS MODAL */}
        {showPrintModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                <h3 className="font-bold text-sm">Station QR Tags for Physical Machine Panels</h3>
                <button onClick={() => setShowPrintModal(false)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ALL_STATIONS.map((st) => (
                    <div
                      key={st.id}
                      className="p-4 rounded-2xl border-2 border-slate-800 bg-white flex items-center justify-between gap-4 shadow-sm"
                    >
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                          {st.plant}
                        </span>
                        <h4 className="text-sm font-black text-slate-900 mt-0.5">
                          {st.code}. {st.name}
                        </h4>
                        <div className="text-[11px] font-mono text-slate-500 mt-1">
                          TAG: <b>{st.qr}</b>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {st.items.length} Checkpoints
                        </div>
                      </div>
                      <div className="p-1 bg-white border border-slate-300 rounded-lg flex-shrink-0">
                        <QRCodeSVG value={st.qr} size={80} level="M" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
                >
                  Print QR Tags
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN-TO-SCREEN QR SYNC BEAM MODAL */}
        {showSyncQRModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-xl mx-auto">
                <Share2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Direct Screen-to-Screen Sync</h3>
              <p className="text-xs text-slate-500">
                Show this QR code to the supervisor laptop webcam to transfer all plant records immediately without internet!
              </p>
              <div className="p-3 bg-white border border-slate-200 rounded-2xl flex justify-center shadow-inner">
                <QRCodeSVG
                  value={JSON.stringify({
                    source: 'ALUMEX_DIRECT_SYNC',
                    data: inspectionsStore.slice(-15)
                  })}
                  size={200}
                  level="L"
                />
              </div>
              <button
                onClick={() => setShowSyncQRModal(false)}
                className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs"
              >
                Done / Close
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
