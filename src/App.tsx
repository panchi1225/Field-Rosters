import React, { useState, useEffect, useRef } from 'react';
import { Settings, Users, Briefcase, ChevronLeft, Trash2, Plus, LayoutDashboard, ArrowLeftRight, Utensils, Car, Truck, X, Coffee, MapPin, CheckCircle2, ChevronDown, ChevronRight, Ban, Search, Cloud, Download, Upload, Save, AlertCircle, Copy, Check, Lock, CheckCircle, AlertTriangle, Maximize, Minimize } from 'lucide-react';
import { Person, Site, Role, ViewMode, Vehicle, FirebaseConfig } from './types';
import { INITIAL_PEOPLE, INITIAL_SITES, INITIAL_VEHICLES, ROLE_LABELS } from './constants';

// Special ID for "Yasumi" (Day Off)
const YASUMI_SITE_ID = 'yasumi';

interface UpdateInfo {
  time: string;
  name: string;
}

// Confirm Modal Type
type ConfirmTarget = 
  | { type: 'SITE'; id: string; name: string }
  | { type: 'VEHICLE'; id: string; name: string }
  | { type: 'PERSON'; id: string; name: string }
  | null;

// --- Components ---

// 1. Role Badge Helper
const getRoleStyles = (role: Role) => {
  switch (role) {
    case Role.MANAGER:
      return 'border-green-600 text-black bg-white';
    case Role.STAFF:
      return 'border-orange-500 text-black bg-white';
    case Role.OPERATOR:
      return 'border-purple-600 text-black bg-white';
    case Role.WORKER:
      return 'border-black text-black bg-white';
    default:
      return 'border-gray-300 text-black bg-white';
  }
};

// Helper for dynamic font size based on name length
const getNameFontSize = (name: string, isCompact: boolean = false) => {
  const len = name.length;
  if (isCompact) {
    // 縮小した札サイズ(h-20/h-24)に合わせて文字サイズを微調整
    if (len <= 2) return 'text-[13px] md:text-[17px]';
    if (len <= 3) return 'text-[11px] md:text-[14px]';
    return 'text-[9px] md:text-[11px]';
  }
  if (len <= 2) return 'text-3xl md:text-3xl';
  if (len <= 3) return 'text-2xl md:text-2xl';
  if (len <= 5) return 'text-xl md:text-xl';
  if (len <= 7) return 'text-lg md:text-lg';
  return 'text-sm';
};

/**
 * 指示された並び順の優先順位を定義
 * 管理職(0) > 運転手(1) > 職員(2) > オペレーター(3) > 作業員(4)
 */
const getPersonSortPriority = (p: Person): number => {
  if (p.role === Role.MANAGER) return 0;
  if (p.isDriver) return 1;
  switch (p.role) {
    case Role.STAFF: return 2;
    case Role.OPERATOR: return 3;
    case Role.WORKER: return 4;
    default: return 99;
  }
};

// 2. Person Card (Vertical Text)
interface PersonCardProps {
  person: Person;
  onClick?: (person: Person) => void;
  isSelected?: boolean;
  isDimmed?: boolean; // For allocation mode locking
  isCompact?: boolean; // For all-in-one view
}

const PersonCard: React.FC<PersonCardProps> = ({ 
  person, 
  onClick,
  isSelected = false,
  isDimmed = false,
  isCompact = false
}) => {
  const fontSizeClass = getNameFontSize(person.name, isCompact);

  return (
    <div
      onClick={(e) => {
        if (isDimmed) return;
        e.stopPropagation();
        onClick && onClick(person);
      }}
      className={`
        relative flex flex-col items-center transition-transform select-none
        border shadow-sm rounded-sm
        ${getRoleStyles(person.role)}
        ${onClick && !isDimmed ? 'cursor-pointer hover:brightness-95' : ''}
        ${isSelected ? 'ring-2 ring-blue-500 scale-105 z-10' : ''}
        ${isDimmed ? 'opacity-30 cursor-not-allowed' : ''}
        ${isCompact ? 'h-20 md:h-24 w-6 md:w-8 border-2 pt-0.5 pb-0.5 px-[1px]' : 'h-36 md:h-44 w-11 md:w-14 border-[3px] md:border-4 pt-1 pb-1 px-0.5 m-0.5'}
      `}
    >
             {/* 弁当あり表示 */}
{/* 弁当あり表示 */}
<div className="h-2 md:h-3 flex items-center justify-center w-full mb-0.5">
{person.hasLunch && (
isCompact ? (
<Utensils className={'w-2 md:w-3 ' + (person.lunchOrder === '\u73FE\u5834' ? 'text-orange-600' : 'text-blue-600')} />
) : (() => {
const lunchCls = person.lunchOrder === '\u73FE\u5834' ? 'text-orange-600 border-orange-200' : 'text-blue-600 border-blue-200';
return (
<span className={'text-[8px] md:text-[10px] font-bold leading-none bg-white/95 px-0.5 rounded border shadow-sm ' + lunchCls}>
弁当
</span>
);
})()
)}
</div>

      {/* Name Container */}
      <div className="flex-1 flex items-center justify-center overflow-hidden w-full px-[1px]">
        <span className={`writing-vertical font-bold leading-none tracking-tighter whitespace-nowrap ${fontSizeClass}`}>
          {person.name}
        </span>
      </div>
    </div>
  );
};

// --- Helper Functions ---

const formatToJapaneseEra = (dateString: string) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  // Reiwa calculation: Reiwa 1 is 2019
  const reiwaYear = year - 2018;
  const eraString = reiwaYear <= 0 ? `${year}年` : `令和${reiwaYear}年`;
  
  return `${eraString}${month}月${day}日 ${hours}：${minutes}`;
};

// --- Main App Component ---

const App: React.FC = () => {
  // State
  const [view, setView] = useState<ViewMode>('WHITEBOARD');
  const [isCompactWhiteboard, setIsCompactWhiteboard] = useState(false);
  
  // Ref to track current view in callbacks (like onSnapshot)
  const viewRef = useRef<ViewMode>(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Data State
  const [sites, setSites] = useState<Site[]>(() => {
    const saved = localStorage.getItem('wb_sites');
return saved ? JSON.parse(saved) : [];  });
  const [people, setPeople] = useState<Person[]>(() => {
    const saved = localStorage.getItem('wb_people');
    if (saved) {
      const parsed = JSON.parse(saved) as Person[];
      return parsed.map((p) => ({ 
        hasLunch: true, 
        vehicleId: null,
        isDriver: false,
        ...p,
        siteId: p.siteId === null ? YASUMI_SITE_ID : p.siteId
      }));
    }
return [];
  });
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const saved = localStorage.getItem('wb_vehicles');
return saved ? JSON.parse(saved) : [];  });
  const [lastUpdateInfo, setLastUpdateInfo] = useState<UpdateInfo | null>(() => {
    const saved = localStorage.getItem('wb_last_update');
    return saved ? JSON.parse(saved) : null;
  });
  const [isInitialLoading, setIsInitialLoading] = useState(!localStorage.getItem('wb_people'));

  // Firebase Config State
  const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
    apiKey: "AIzaSyBAcmb5RvtzQRRMqcBYItNKqb_4RGo3C00",
    authDomain: "field-rosters-pro.firebaseapp.com",
    projectId: "field-rosters-pro",
    storageBucket: "field-rosters-pro.firebasestorage.app",
    messagingSenderId: "500150832255",
    appId: "1:500150832255:web:e41022240e3d918edf834a"
};

const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig | null>(() => {
    const saved = localStorage.getItem('wb_firebase_config');
    return saved ? JSON.parse(saved) : DEFAULT_FIREBASE_CONFIG;
});

  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('DISCONNECTED');
  const dbRef = useRef<any>(null); // Store firestore instance
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isRemoteUpdate = useRef(false); // Flag to prevent write loops

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{person: Person, siteName: string} | null>(null);
  const [lunchConfirmTarget, setLunchConfirmTarget] = useState<Person | null>(null);

  // Password Protection State
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restorePasswordInput, setRestorePasswordInput] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [passwordTargetView, setPasswordTargetView] = useState<ViewMode | null>(null);

  // Allocation Completion State
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [completerSearchQuery, setCompleterSearchQuery] = useState('');
  const [showCompletionSuccess, setShowCompletionSuccess] = useState<string | null>(null);
  const [initialPeopleSnapshot, setInitialPeopleSnapshot] = useState<string>('');
  const [initialSitesSnapshot, setInitialSitesSnapshot] = useState<string>('');
  const [showNoChangesAlert, setShowNoChangesAlert] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);

  // UI State for Allocation Mode
  const [selectedPersonForAction, setSelectedPersonForAction] = useState<Person | null>(null);
  
  // Move Flow State
  const [movePhase, setMovePhase] = useState<'IDLE' | 'PICK_SITE' | 'PICK_GROUP'>('IDLE');
  const [movingPerson, setMovingPerson] = useState<Person | null>(null);
  const [targetSiteId, setTargetSiteId] = useState<string | null>(null);

  // UI State for Person Management (Accordion)
  const [expandedCategories, setExpandedCategories] = useState<Record<Role, boolean>>({
    [Role.MANAGER]: false,
    [Role.STAFF]: false,
    [Role.OPERATOR]: false,
    [Role.WORKER]: false,
  });

  // Deletion Confirm State
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);

  // Inputs for forms
  const [newSiteName, setNewSiteName] = useState('');
  const [newVehicleName, setNewVehicleName] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonRole, setNewPersonRole] = useState<Role>(Role.WORKER);
  const [newPersonHasLunch, setNewPersonHasLunch] = useState(true);
  
  // Cloud Settings Input
  const [configInput, setConfigInput] = useState('');

  // Local Persistence
  useEffect(() => {
    if (view === 'ALLOCATION') return;
    localStorage.setItem('wb_sites', JSON.stringify(sites));
  }, [sites, view]);

  useEffect(() => {
    if (view === 'ALLOCATION') return;
    localStorage.setItem('wb_people', JSON.stringify(people));
  }, [people, view]);

  useEffect(() => {
    if (view === 'ALLOCATION') return;
    localStorage.setItem('wb_vehicles', JSON.stringify(vehicles));
  }, [vehicles, view]);

  useEffect(() => {
    if (view === 'ALLOCATION') return;
    if (lastUpdateInfo) {
      localStorage.setItem('wb_last_update', JSON.stringify(lastUpdateInfo));
    }
  }, [lastUpdateInfo, view]);

  useEffect(() => {
    if (firebaseConfig) {
      localStorage.setItem('wb_firebase_config', JSON.stringify(firebaseConfig));
    }
  }, [firebaseConfig]);
  const restoreFromBackup = () => {
    const backupPeople = localStorage.getItem('wb_backup_people');
    const backupSites = localStorage.getItem('wb_backup_sites');
    const backupVehicles = localStorage.getItem('wb_backup_vehicles');
    if (backupPeople && backupSites && backupVehicles) {
      setPeople(JSON.parse(backupPeople));
      setSites(JSON.parse(backupSites));
      setVehicles(JSON.parse(backupVehicles));
      const backupLastUpdate = localStorage.getItem('wb_backup_last_update');
if (backupLastUpdate) setLastUpdateInfo(JSON.parse(backupLastUpdate));
      setIsRestoreModalOpen(false);
      setRestorePasswordInput('');
      setRestoreError('');
      alert('バックアップからデータを復元しました。');
    } else {
      setRestoreError('バックアップデータが見つかりません。');
    }
  };
  const checkIfAllocationChanged = () => {
    const peopleChanged = initialPeopleSnapshot !== JSON.stringify(people);
    const sitesChanged = initialSitesSnapshot !== JSON.stringify(sites);
    return peopleChanged || sitesChanged;
  };

  // --- Cloud Sync Logic ---
  useEffect(() => {
    let active = true;

    const connectToFirebase = async () => {
      if (!firebaseConfig) {
        setCloudStatus('DISCONNECTED');
        setIsCloudConnected(false);
        return;
      }

      setCloudStatus('CONNECTING');
      try {
        const { initializeApp, getApps, getApp } = await import('firebase/app');
        const { getFirestore, doc, onSnapshot, setDoc } = await import('firebase/firestore');

        const appName = 'whiteboard-app';
        let app;
        if (getApps().length === 0) {
            app = initializeApp(firebaseConfig, appName);
        } else {
            app = getApp(appName);
        }
        
        const db = getFirestore(app);
        const docRef = doc(db, 'app_data', 'shared_board');

        const unsub = onSnapshot(docRef, (snapshot: any) => {
          if (snapshot.exists()) {
             const data = snapshot.data();
             if (active) {
                // ALLOCATIONモード中は外部の更新を反映しない（編集中データを保護）
                if (viewRef.current === 'ALLOCATION') return;
        const remoteTime = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
        const localUpdateInfo = localStorage.getItem('wb_last_update');
        const localTime = localUpdateInfo ? new Date(JSON.parse(localUpdateInfo).time).getTime() : 0;
if (localTime > 0 && remoteTime < localTime) return;
                isRemoteUpdate.current = true;
                if (data.sites) setSites(JSON.parse(data.sites));
                if (data.people) setPeople(JSON.parse(data.people));
                if (data.vehicles) setVehicles(JSON.parse(data.vehicles));
                if (data.lastUpdateInfo) setLastUpdateInfo(JSON.parse(data.lastUpdateInfo));
             }
             setIsInitialLoading(false);
          }
        }, (error: any) => {
            console.error("Firestore Error:", error);
            if (active) setCloudStatus('ERROR');
        });

        unsubscribeRef.current = unsub;
        dbRef.current = { setDoc, docRef };
        
        if (active) {
          setIsCloudConnected(true);
          setCloudStatus('CONNECTED');
        }

      } catch (err) {
        console.error("Firebase connection failed:", err);
        if (active) {
            setCloudStatus('ERROR');
            setIsCloudConnected(false);
        }
      }
    };

    connectToFirebase();

    return () => {
      active = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [firebaseConfig]);

  // Auto-Save to Cloud
  useEffect(() => {
    if (!isCloudConnected || !dbRef.current) return;
    // ALLOCATIONモード中は自動保存しない（完了ボタンでのみ保存）
    if (view === 'ALLOCATION') return;

    if (isRemoteUpdate.current) {
        isRemoteUpdate.current = false;
        return;
    }
        if (!lastUpdateInfo) return;

    const saveData = async () => {
        try {
            const { setDoc, docRef } = dbRef.current;
            await setDoc(docRef, {
                sites: JSON.stringify(sites),
                people: JSON.stringify(people),
                vehicles: JSON.stringify(vehicles),
                lastUpdateInfo: JSON.stringify(lastUpdateInfo),
                updatedAt: new Date().toISOString()
            });
        } catch (e) {
            console.error("Cloud save failed", e);
            setCloudStatus('ERROR');
        }
    };
    const timer = setTimeout(saveData, 500); 
    return () => clearTimeout(timer);
  }, [sites, people, vehicles, lastUpdateInfo, isCloudConnected, view]);

  // --- Handlers ---
  const handleEnterAllocation = () => {
    setInitialPeopleSnapshot(JSON.stringify(people));
    setInitialSitesSnapshot(JSON.stringify(sites));
    setView('ALLOCATION');
  };

  const handleAddSite = () => {
    if (!newSiteName.trim()) return;
    const newSite: Site = {
      id: crypto.randomUUID(),
      name: newSiteName.trim(),
      order: sites.length,
    };
    setSites(prev => [...prev, newSite]);
    setNewSiteName('');
  };

  const executeDeleteSite = (id: string) => {
    setSites(prev => prev.filter(s => s.id !== id));
    setPeople(prev => prev.map(p => p.siteId === id ? { ...p, siteId: YASUMI_SITE_ID, vehicleId: null, isDriver: false } : p));
    setConfirmTarget(null);
  };

  const handleAddVehicle = () => {
    if (!newVehicleName.trim()) return;
    const newVehicle: Vehicle = {
      id: crypto.randomUUID(),
      name: newVehicleName.trim(),
    };
    setVehicles(prev => [...prev, newVehicle]);
    setNewVehicleName('');
  };

  const executeDeleteVehicle = (id: string) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
    setPeople(prev => prev.map(p => p.vehicleId === id ? { ...p, vehicleId: null, isDriver: false } : p));
    setConfirmTarget(null);
  };

  const handleAddPerson = () => {
    if (!newPersonName.trim()) return;
    const newPerson: Person = {
      id: crypto.randomUUID(),
      name: newPersonName.trim(),
      role: newPersonRole,
      siteId: YASUMI_SITE_ID, 
      hasLunch: newPersonHasLunch,
      vehicleId: null,
      isDriver: false,
    };
    setPeople(prev => [...prev, newPerson]);
    setNewPersonName('');
  };

  const executeDeletePerson = (id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id));
    setConfirmTarget(null);
  };

 const toggleLunch = (id: string) => {
  setPeople(prev => prev.map(p => p.id === id ? { ...p, hasLunch: !p.hasLunch, lunchOrder: p.hasLunch ? null : p.lunchOrder } : p));
};

  const toggleDriver = (personId: string) => {
    setPeople(prev => {
      const person = prev.find(p => p.id === personId);
      if (!person) return prev;
      return prev.map(p => {
        if (p.id === personId) {
            return { ...p, isDriver: !p.isDriver };
        }
        if (person.vehicleId && p.vehicleId === person.vehicleId && p.id !== personId) {
            return { ...p, isDriver: false };
        }
        return p;
      });
    });
    setSelectedPersonForAction(null);
  };

  const changeGroupVehicle = (siteId: string, oldVehicleId: string | null, targetVehicleId: string | null) => {
    setPeople(prev => prev.map(p => {
      if (p.siteId === siteId && p.vehicleId === oldVehicleId) {
        return { 
          ...p, 
          vehicleId: targetVehicleId, 
          isDriver: false 
        };
      }
      return p;
    }));
  };

  const moveToYasumi = (personId: string) => {
    setPeople(prev => prev.map(p => {
        if (p.id === personId) {
            return {
                ...p,
                siteId: YASUMI_SITE_ID,
                vehicleId: null,
                isDriver: false
            };
        }
        return p;
    }));
    setSelectedPersonForAction(null);
  };

  const handleSearchClick = (person: Person) => {
    let siteName = "未配置";
    if (person.siteId === YASUMI_SITE_ID) {
      siteName = "休み";
    } else if (person.siteId) {
      const site = sites.find(s => s.id === person.siteId);
      if (site) siteName = site.name;
    }
    setSearchResult({ person, siteName });
    setIsSearchOpen(false);
  };

  const handleProtectedViewAccess = (view: ViewMode) => {
    setPasswordTargetView(view);
    setIsPasswordModalOpen(true);
    setPasswordInput('');
    setPasswordError(false);
  };

  const handlePasswordSubmit = () => {
    const correctPassword = passwordTargetView === 'CLOUD_SETTINGS' ? '1225' : '4043';
    if (passwordInput === correctPassword) {
      if (passwordTargetView) {
        setView(passwordTargetView);
      }
      setIsPasswordModalOpen(false);
      setPasswordTargetView(null);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };


  const handleAllocationCompleteBtnClick = () => {
    if (!checkIfAllocationChanged()) {
      setShowNoChangesAlert(true);
    } else {
      setIsCompletionModalOpen(true);
    }
  };

  const handleAllocationComplete = (name: string) => {
    setIsCompletionModalOpen(false);
    setShowCompletionSuccess(name);
    
    // Record update info
    setLastUpdateInfo({
      time: new Date().toISOString(),
      name: name
    });
    // Auto backup
    localStorage.setItem('wb_backup_people', JSON.stringify(people));
    localStorage.setItem('wb_backup_sites', JSON.stringify(sites));
    localStorage.setItem('wb_backup_vehicles', JSON.stringify(vehicles));
    localStorage.setItem('wb_backup_time', new Date().toISOString());
    localStorage.setItem('wb_backup_last_update', JSON.stringify(lastUpdateInfo));

    setTimeout(() => {
        setShowCompletionSuccess(null);
        setView('WHITEBOARD');
    }, 2000);
  };

  const handleExitAllocationRequest = () => {
    if (checkIfAllocationChanged()) {
        setShowExitWarning(true);
    } else {
        setView('SETTINGS_MENU');
    }
  };

  // Export/Import
  const handleExportData = () => {
    const data = { sites, people, vehicles, lastUpdateInfo, timestamp: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whiteboard_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.sites && json.people && json.vehicles) {
          if (window.confirm('現在のデータを上書きして読み込みますか？この操作は取り消せません。')) {
            setSites(json.sites);
            setPeople(json.people);
            setVehicles(json.vehicles);
            if (json.lastUpdateInfo) setLastUpdateInfo(json.lastUpdateInfo);
            alert('データを読み込みました。');
          }
        } else {
          alert('ファイル形式が正しくありません。');
        }
      } catch (err) {
        alert('読み込みエラーが発生しました。');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleSaveConfig = () => {
    try {
      let cleanInput = configInput;
      if (cleanInput.includes('const firebaseConfig =')) {
          cleanInput = cleanInput.split('=')[1].trim();
          if (cleanInput.endsWith(';')) cleanInput = cleanInput.slice(0, -1);
      }
      const firstBrace = cleanInput.indexOf('{');
      const lastBrace = cleanInput.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
          cleanInput = cleanInput.slice(firstBrace, lastBrace + 1);
      }
      const config = JSON.parse(cleanInput) as FirebaseConfig;
      if (config.apiKey && config.projectId) {
        setFirebaseConfig(config);
        alert('設定を保存しました。接続を試行します。');
      } else {
        alert('無効な設定のようです。apiKeyやprojectIdが含まれているか確認してください。');
      }
    } catch (e) {
      alert('JSONの解析に失敗しました。形式を確認してください。\n' + e);
    }
  };

  // --- Move Flow Logic ---
  const startMoveProcess = () => {
    if (selectedPersonForAction) {
        setMovingPerson(selectedPersonForAction);
        setSelectedPersonForAction(null);
        setMovePhase('PICK_SITE');
    }
  };

  const handleSiteSelect = (siteId: string) => {
    if (movePhase !== 'PICK_SITE') return;
    if (siteId === YASUMI_SITE_ID) {
        executeMove(YASUMI_SITE_ID, null);
    } else {
        setTargetSiteId(siteId);
        setMovePhase('PICK_GROUP');
    }
  };

  const handleGroupSelect = (vehicleId: string | null) => {
    if (movePhase !== 'PICK_GROUP' || !targetSiteId) return;
    executeMove(targetSiteId, vehicleId);
  };

  const handleNewGroupSelect = (siteId: string) => {
    const newGroupId = `temp_${crypto.randomUUID()}`;
    executeMove(siteId, newGroupId);
  };

  const executeMove = (siteId: string, vehicleId: string | null) => {
      if (!movingPerson) return;
      setPeople(prev => prev.map(p => {
          if (p.id === movingPerson.id) {
              return {
                  ...p,
                  siteId: siteId,
                  vehicleId: vehicleId,
                  isDriver: vehicleId ? p.isDriver : false
              };
          }
          return p;
      }));
      setMovingPerson(null);
      setTargetSiteId(null);
      setMovePhase('IDLE');
  };

  const cancelMove = () => {
      setMovingPerson(null);
      setTargetSiteId(null);
      setMovePhase('IDLE');
  };

  const groupPeopleByVehicle = (staff: Person[]) => {
    const grouped: Record<string, Person[]> = {};
    staff.forEach(p => {
      const key = p.vehicleId === null ? 'null' : p.vehicleId;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });
    return grouped;
  };

  const toggleCategory = (role: Role) => {
      setExpandedCategories(prev => ({ ...prev, [role]: !prev[role] }));
  };

  const handleMoveGroup = (siteId: string, groupKey: string, direction: 'left' | 'right') => {
    setSites(prev => prev.map(site => {
      if (site.id !== siteId) return site;

      const siteStaff = people.filter(p => p.siteId === site.id);
      const grouped = groupPeopleByVehicle(siteStaff);
      let keys = Object.keys(grouped);

      // Sort current keys based on existing groupOrder
      if (site.groupOrder) {
         keys.sort((a, b) => {
             const ia = site.groupOrder!.indexOf(a);
             const ib = site.groupOrder!.indexOf(b);
             if (ia !== -1 && ib !== -1) return ia - ib;
             if (ia !== -1) return -1;
             if (ib !== -1) return 1;
             return 0;
         });
      }

      const idx = keys.indexOf(groupKey);
      if (idx === -1) return site;

      const newKeys = [...keys];
      if (direction === 'left' && idx > 0) {
        [newKeys[idx - 1], newKeys[idx]] = [newKeys[idx], newKeys[idx - 1]];
      } else if (direction === 'right' && idx < newKeys.length - 1) {
        [newKeys[idx], newKeys[idx + 1]] = [newKeys[idx + 1], newKeys[idx]];
      } else {
        return site;
      }

      return { ...site, groupOrder: newKeys };
    }));
  };

  // --- Helper for Driver Label ---
  const renderDriverLabel = (person: Person, isCompact: boolean = false) => {
    if (!person.isDriver) return <div className={isCompact ? 'h-1.5 md:h-2 mb-0.5' : 'h-4 md:h-6'} />;
    
    // 一括表示（Compact）モードの場合、赤い車のアイコンを表示
    if (isCompact) {
      return (
        <div className="h-1.5 md:h-2 flex items-center justify-center mb-0.5">
          <Car className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-red-600 fill-red-100" />
        </div>
      );
    }
    
    return (
      <div className="h-4 md:h-6 flex items-center justify-center">
        <span className="text-[9px] md:text-[11px] text-red-600 font-extrabold whitespace-nowrap tracking-tighter leading-none">
          運転手
        </span>
      </div>
    );
  };

  // --- Reusable Yasumi Section ---
  const renderYasumiBlock = (isMobile: boolean) => {
    const yasumiPeople = people.filter(p => p.siteId === YASUMI_SITE_ID);
    return (
      <div 
        className={`bg-gray-200 flex flex-col transition-all ${isMobile ? 'rounded-xl border-2 border-dashed border-gray-400 mt-2 mb-8' : 'h-full'} ${movePhase === 'PICK_SITE' ? 'bg-blue-50 cursor-pointer hover:bg-blue-100 ring-2 ring-blue-300' : ''} ${(movePhase !== 'IDLE' && movePhase !== 'PICK_SITE') ? 'opacity-40 pointer-events-none' : ''}`}
        onClick={() => handleSiteSelect(YASUMI_SITE_ID)}
      >
        <div className={`p-2 md:p-3 bg-gray-300 font-bold text-xs md:text-base text-gray-700 text-center border-b border-gray-400 flex items-center justify-center gap-2 ${isMobile ? 'rounded-t-xl' : ''}`}>
          <Coffee className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />休み ({yasumiPeople.length})
        </div>
        <div className={`p-2 md:p-4 ${isMobile ? 'min-h-[100px]' : 'flex-1 overflow-y-auto'}`}>
          <div className="flex md:grid md:grid-cols-2 flex-wrap gap-1 md:gap-2 justify-center">
              {[...yasumiPeople].sort((a, b) => getPersonSortPriority(a) - getPersonSortPriority(b)).map(p => (
                <div key={p.id} className="flex flex-col items-center">
                   {renderDriverLabel(p)}
                    <PersonCard 
                      person={p} 
                      onClick={setSelectedPersonForAction} 
                      isSelected={selectedPersonForAction?.id === p.id || movingPerson?.id === p.id} 
                      isDimmed={movePhase !== 'IDLE' && movingPerson?.id !== p.id} 
                    />
                </div>
              ))}
          </div>
          {yasumiPeople.length === 0 && <div className="text-gray-400 text-xs md:text-sm text-center mt-4 md:mt-10">該当なし</div>}
        </div>
      </div>
    );
  };

  // --- Views ---

  const renderWhiteboard = () => {
    // 現場ごとの人員数を計算
    const siteCounts = new Map<string, number>();
    sites.forEach(s => {
      const count = people.filter(p => p.siteId === s.id).length;
      siteCounts.set(s.id, count);
    });

    // 人員がいる現場のみを表示し、人数が多い順にソート
    const activeSites = sites
      .filter(s => (siteCounts.get(s.id) || 0) > 0)
      .sort((a, b) => {
        const countA = siteCounts.get(a.id) || 0;
        const countB = siteCounts.get(b.id) || 0;
        // 人数が多い順
        if (countB !== countA) return countB - countA;
        // 人数が同じ場合は元の順序（order）で安定ソート
        return a.order - b.order;
      });

    return (
      <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-2 md:py-3 flex flex-col md:flex-row justify-between md:items-center shadow-sm relative z-40 shrink-0 gap-2 md:gap-4">
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
              現場配置表
              {isCompactWhiteboard && <span className="text-xs md:text-sm bg-blue-600 text-white px-2 py-0.5 rounded-full ml-2 font-bold shadow-sm">一括表示中</span>}
            </h1>
          {lastUpdateInfo && (
 <div className="text-[10px] md:text-xs text-gray-500 font-bold ml-8 md:ml-10 mt-0.5">
    最終更新：{formatToJapaneseEra(lastUpdateInfo.time)}（{lastUpdateInfo.name}）
  </div>
)}
</div>

          <div className="flex items-center gap-2 md:gap-4 justify-between md:justify-end">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 border border-gray-200">
               {cloudStatus === 'CONNECTED' ? (
                  <>
                    <Cloud className="w-3 h-3 md:w-4 md:h-4 text-green-500" />
                    <span className="text-[10px] md:text-xs font-bold text-green-700">同期中</span>
                  </>
               ) : cloudStatus === 'CONNECTING' ? (
                  <>
                    <Cloud className="w-3 h-3 md:w-4 md:h-4 text-yellow-500 animate-pulse" />
                    <span className="text-[10px] md:text-xs font-bold text-yellow-700">接続中...</span>
                  </>
               ) : (
                  <>
                    <Cloud className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
                    <span className="text-[10px] md:text-xs font-bold text-gray-500">未接続</span>
                  </>
               )}
            </div>
            <div className="flex gap-2">
              {/* 一括表示モード切替ボタン (Tablet/PC only) */}
              <button
                type="button"
                onClick={() => setIsCompactWhiteboard(!isCompactWhiteboard)}
                className={`hidden md:flex items-center gap-1 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg transition-all shadow-sm text-xs md:text-sm font-bold border cursor-pointer ${isCompactWhiteboard ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}
              >
                {isCompactWhiteboard ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                <span>{isCompactWhiteboard ? '通常表示' : '一括表示'}</span>
              </button>

              <button
                type="button"
                onClick={() => { setSearchQuery(''); setIsSearchOpen(true); }}
                className="flex items-center gap-1 md:gap-2 bg-white text-gray-700 border border-gray-300 px-2 md:px-4 py-1.5 md:py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-xs md:text-sm cursor-pointer"
              >
                <Search className="w-4 h-4 md:w-5 md:h-5" />
                <span>検索</span>
              </button>
              <button
                type="button"
                onClick={() => setView('SETTINGS_MENU')}
                className="flex items-center gap-1 md:gap-2 bg-gray-800 text-white px-2 md:px-4 py-1.5 md:py-2 rounded-lg hover:bg-gray-700 transition-colors shadow-md text-xs md:text-sm cursor-pointer"
              >
                <Settings className="w-4 h-4 md:w-5 md:h-5" />
                <span>設定</span>
              </button>
            </div>
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto bg-gray-100 p-2 md:p-6 relative z-0`}>
          <div className={`${isCompactWhiteboard ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3 w-full' : 'flex flex-col gap-3 md:gap-6 max-w-full'}`}>
            {activeSites.map(site => {
              const siteStaff = people.filter(p => p.siteId === site.id);
              const lunchCount = siteStaff.filter(p => p.hasLunch).length;
              const lunchGenba = siteStaff.filter(p => p.hasLunch && p.lunchOrder === '現場').length;
              const lunchJimusho = siteStaff.filter(p => p.hasLunch && (p.lunchOrder === '事務所' || !p.lunchOrder)).length;
              const grouped = groupPeopleByVehicle(siteStaff);
              // Whiteboard view also respects groupOrder
              let groupKeys = Object.keys(grouped);
              if (site.groupOrder) {
                 groupKeys.sort((a, b) => {
                     const ia = site.groupOrder!.indexOf(a);
                     const ib = site.groupOrder!.indexOf(b);
                     if (ia !== -1 && ib !== -1) return ia - ib;
                     if (ia !== -1) return -1;
                     if (ib !== -1) return 1;
                     return 0;
                 });
              }

              return (
                <div key={site.id} className={`bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden transition-all ${isCompactWhiteboard ? 'max-h-full border-[1.5px]' : 'w-full md:rounded-xl shadow-md border-2'}`}>
                  <div className={`bg-gray-50 border-b border-gray-200 px-2 md:px-3 py-1 md:py-2 flex items-center ${isCompactWhiteboard ? 'shrink-0' : 'py-2'}`}>
                    <div className="flex items-center gap-2 md:gap-4 overflow-hidden w-full">
                      <h2 className={`${isCompactWhiteboard ? 'text-[11px] md:text-xs' : 'text-base md:text-xl'} font-extrabold text-gray-800 leading-tight border-l-[3px] border-blue-500 pl-2 py-0 truncate`}>
                          {site.name}
                      </h2>
                      <div className="flex items-center gap-1 md:gap-2 shrink-0">
                    
                          {lunchGenba > 0 && (
  <div className={`flex items-center gap-1 bg-orange-100 rounded-full border border-orange-200 shadow-sm ${isCompactWhiteboard ? 'px-1.5 py-0.5' : 'px-2 py-1'}`}>
    <Utensils className={`${isCompactWhiteboard ? 'w-2 h-2' : 'w-3 h-3 md:w-4 md:h-4'} text-orange-600`} />
    <span className={`${isCompactWhiteboard ? 'text-[9px]' : 'text-[10px] md:text-sm'} font-bold text-orange-800`}>現場：{lunchGenba}個</span>
  </div>
)}
{lunchJimusho > 0 && (
  <div className={`flex items-center gap-1 bg-blue-100 rounded-full border border-blue-200 shadow-sm ${isCompactWhiteboard ? 'px-1.5 py-0.5' : 'px-2 py-1'}`}>
    <Utensils className={`${isCompactWhiteboard ? 'w-2 h-2' : 'w-3 h-3 md:w-4 md:h-4'} text-blue-600`} />
    <span className={`${isCompactWhiteboard ? 'text-[9px]' : 'text-[10px] md:text-sm'} font-bold text-blue-800`}>事務所：{lunchJimusho}個</span>
  </div>
)}

                      </div>
                    </div>
                  </div>
                  <div className={`flex flex-wrap content-start bg-white gap-1 ${isCompactWhiteboard ? 'p-1' : 'p-2 md:p-4 min-h-[80px] gap-2'}`}>
                    {groupKeys.map((vIdKey) => {
                      const members = grouped[vIdKey];
                      const isNullKey = vIdKey === 'null' || vIdKey.startsWith('temp_');
                      const realVId = isNullKey ? (vIdKey === 'null' ? null : vIdKey) : vIdKey;
                      const vehicle = vehicles.find(v => v.id === realVId);
                      return (
                        <div key={vIdKey} className={`border rounded bg-indigo-50/20 flex flex-col relative ${isCompactWhiteboard ? 'min-w-[45px] p-0.5 border-indigo-100' : 'border-2 border-indigo-100 p-1 md:p-1.5 pb-0 min-w-[80px] md:min-w-[100px]'}`}>
                           <div className={`flex items-center gap-0.5 mb-0.5 border-b border-indigo-100/50 pb-0.5 ${isCompactWhiteboard ? 'h-[12px]' : 'h-[20px] md:h-[25px]'}`}>
                             {vehicle && (
                               <>
                                 <Truck className={`${isCompactWhiteboard ? 'w-2 h-2' : 'w-3 h-3 md:w-4 md:h-4'} text-indigo-500 shrink-0`} />
                                 <span className={`${isCompactWhiteboard ? 'text-[8px]' : 'text-[10px] md:text-sm'} font-bold text-indigo-700 truncate leading-none`}>
                                  {vehicle.name}
                                 </span>
                               </>
                             )}
                           </div>
                           <div className={`flex flex-wrap ${isCompactWhiteboard ? 'gap-[2px]' : 'gap-1'}`}>
                             {[...members].sort((a, b) => getPersonSortPriority(a) - getPersonSortPriority(b)).map(person => (
                               <div key={person.id} className="flex flex-col items-center">
                                 {renderDriverLabel(person, isCompactWhiteboard)}
                                 <PersonCard 
                                   person={person} 
                                   onClick={() => { setLunchConfirmTarget(person); }}
                                   isCompact={isCompactWhiteboard} 
                                 />
                               </div>
                             ))}
                           </div>
                        </div>
                      );
                    })}
                    {siteStaff.length === 0 && !isCompactWhiteboard && (
                      <div className="w-full h-16 md:h-32 flex items-center justify-center text-gray-400 italic text-xs md:text-sm select-none border-2 border-dashed border-gray-100 rounded-lg">
                        人員配置なし
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* Search Modal */}
        {isSearchOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 md:p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <h3 className="font-bold text-lg text-gray-700">人員検索</h3>
                <button onClick={() => setIsSearchOpen(false)} className="p-2 hover:bg-gray-200 rounded-full">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-4 border-b border-gray-200">
                 <input
                   type="text"
                   placeholder="名前で検索..."
                   className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                 />
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <ul className="space-y-1">
                  {people
                    .filter(p => p.name.includes(searchQuery))
                    .sort((a,b) => a.name.localeCompare(b.name, 'ja'))
                    .map(p => (
                    <li key={p.id}>
                      <button
                        onClick={() => handleSearchClick(p)}
                        className="w-full text-left p-3 hover:bg-blue-50 rounded-lg flex items-center justify-between group"
                      >
                        <span className="font-bold text-gray-800">{p.name}</span>
                        <span className="text-gray-400 text-sm group-hover:text-blue-500">選択 &rarr;</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
{lunchConfirmTarget && (
  <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 w-full max-w-md text-center">
      <div className="mb-6">
        <p className="text-lg font-bold text-gray-800 mb-2">{lunchConfirmTarget.name}</p>
        {lunchConfirmTarget.hasLunch ? (
          <p className="text-base text-gray-700">弁当を<span className="font-bold text-blue-600">【なし】</span>に変更しますか？</p>
        ) : (
          <p className="text-base text-gray-700 mb-4">弁当を<span className="font-bold text-blue-600">【あり】</span>に変更<br/>注文先を選択してください</p>
        )}
      </div>
      {lunchConfirmTarget.hasLunch ? (
        <div className="flex gap-3">
          <button onClick={() => setLunchConfirmTarget(null)} className="flex-1 py-3 px-4 rounded-lg border border-gray-300 text-gray-700 font-bold hover:bg-gray-100">キャンセル</button>
          <button onClick={() => { toggleLunch(lunchConfirmTarget.id); setLunchConfirmTarget(null); }} className="flex-1 py-3 px-4 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700">変更する</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <button onClick={() => { setPeople(prev => prev.map(p => p.id === lunchConfirmTarget.id ? { ...p, hasLunch: true, lunchOrder: '事務所' } : p)); setLunchConfirmTarget(null); }} className="flex-1 py-3 px-4 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700">事務所</button>
            <button onClick={() => { setPeople(prev => prev.map(p => p.id === lunchConfirmTarget.id ? { ...p, hasLunch: true, lunchOrder: '現場' } : p)); setLunchConfirmTarget(null); }} className="flex-1 py-3 px-4 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700">現場</button>
          </div>
          <button onClick={() => setLunchConfirmTarget(null)} className="py-3 px-4 rounded-lg border border-gray-300 text-gray-700 font-bold hover:bg-gray-100">キャンセル</button>
        </div>
      )}
    </div>
  </div>
)}
        {/* Search Result Popup */}
        {searchResult && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 w-full max-md:max-w-md text-center">
               <div className="mb-6">
                 <CheckCircle2 className="w-12 h-12 md:w-16 md:h-16 text-green-500 mx-auto mb-4" />
                 <p className="text-lg md:text-xl font-bold text-gray-800 leading-relaxed">
                   {searchResult.person.name}<br />
                   【 <span className="text-blue-600">{searchResult.siteName}</span> 】
                 </p>
               </div>
               <button onClick={() => setSearchResult(null)} className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 w-full">OK</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSettingsMenu = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4 flex items-center shadow-sm sticky top-0 z-10">
        <button onClick={() => setView('WHITEBOARD')} className="p-2 hover:bg-gray-100 rounded-full mr-4">
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">設定メニュー</h2>
      </div>
      <div className="max-w-3xl mx-auto w-full p-4 md:p-6 space-y-4">
        <button
          onClick={handleEnterAllocation}
          className="w-full py-4 md:py-6 px-4 md:px-6 bg-white border border-gray-200 shadow-sm rounded-xl flex items-center gap-4 md:gap-6 hover:bg-blue-50 hover:border-blue-200 transition-all group"
        >
          <div className="bg-blue-500 text-white p-3 md:p-4 rounded-full group-hover:scale-110 transition-transform shadow-md shrink-0">
            <ArrowLeftRight className="w-6 h-6 md:w-8 md:h-8" />
          </div>
          <div className="text-left overflow-hidden">
            <h3 className="text-lg md:text-xl font-bold text-gray-800 truncate">人員配置</h3>
            <p className="text-xs md:text-sm text-gray-500 line-clamp-1 md:line-clamp-none">現場割り振り・運転手・休み設定</p>
          </div>
        </button>
        <button
          onClick={() => handleProtectedViewAccess('DATA_MANAGEMENT_MENU')}
          className="w-full py-4 md:py-6 px-4 md:px-6 bg-white border border-gray-200 shadow-sm rounded-xl flex items-center gap-4 md:gap-6 hover:bg-green-50 hover:border-green-200 transition-all group"
        >
          <div className="bg-green-500 text-white p-3 md:p-4 rounded-full group-hover:scale-110 transition-transform shadow-md shrink-0">
            <Briefcase className="w-6 h-6 md:w-8 md:h-8" />
          </div>
          <div className="text-left overflow-hidden">
            <h3 className="text-lg md:text-xl font-bold text-gray-800 truncate">データ管理</h3>
            <p className="text-xs md:text-sm text-gray-500 line-clamp-1 md:line-clamp-none">現場・車両・人員の登録・編集</p>
          </div>
        </button>
        <button
          onClick={() => handleProtectedViewAccess('CLOUD_SETTINGS')}
          className="w-full py-4 md:py-6 px-4 md:px-6 bg-white border border-gray-200 shadow-sm rounded-xl flex items-center gap-4 md:gap-6 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
        >
          <div className="bg-indigo-500 text-white p-3 md:p-4 rounded-full group-hover:scale-110 transition-transform shadow-md shrink-0">
            <Cloud className="w-6 h-6 md:w-8 md:h-8" />
          </div>
          <div className="text-left overflow-hidden">
            <h3 className="text-lg md:text-xl font-bold text-gray-800 truncate">クラウド共有設定</h3>
            <p className="text-xs md:text-sm text-gray-500 line-clamp-1 md:line-clamp-none">{isCloudConnected ? '同期中' : '未接続・Firebase設定'}</p>
          </div>
        </button>
      </div>

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <Lock className="w-6 h-6" />
              <h3 className="text-xl font-bold">パスワード入力</h3>
            </div>
            <p className="text-sm text-gray-600 text-center">{passwordTargetView === 'CLOUD_SETTINGS' ? 'クラウド設定' : 'データ管理画面'}にアクセスするには<br/>管理パスワードを入力してください。</p>
            <div className="flex flex-col gap-1">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); if (passwordError) setPasswordError(false); }}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                placeholder="タップして入力"
                className={`w-full p-4 border rounded-lg text-center text-xl tracking-wider outline-none transition-all ${passwordError ? 'border-red-500 bg-red-50 focus:ring-2 focus:ring-red-500 shadow-sm ring-red-200' : 'border-gray-300 focus:ring-2 focus:ring-indigo-500'}`}
              />
              {passwordError && <p className="text-red-500 text-xs font-bold text-center mt-1 animate-pulse">パスワードが違います。</p>}
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => { setIsPasswordModalOpen(false); setPasswordTargetView(null); setPasswordError(false); }} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200">キャンセル</button>
              <button onClick={handlePasswordSubmit} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700">解除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  const renderAllocation = () => {
    // Calculate globally assigned vehicles to filter dropdowns
    const allAssignedVehicleIds = new Set(people.map(p => p.vehicleId).filter((id): id is string => id !== null));

    return (
      <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`text-white p-3 md:p-4 flex items-center justify-between shrink-0 shadow-md z-20 transition-colors ${movePhase !== 'IDLE' ? 'bg-indigo-600' : 'bg-gray-800'}`}>
          <div className="flex items-center gap-2 md:gap-4">
             <button onClick={handleExitAllocationRequest} className="p-2 hover:bg-gray-700 rounded-full" disabled={movePhase !== 'IDLE'}>
              <ChevronLeft />
            </button>
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 md:w-6 md:h-6" /> <span className="hidden md:inline">人員配置モード</span><span className="md:hidden">配置</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="text-xs text-gray-100 font-bold hidden lg:block">
                {movePhase === 'IDLE' && '人員をタップして操作を選択'}
                {movePhase === 'PICK_SITE' && `「${movingPerson?.name}」の移動先：現場を選択`}
                {movePhase === 'PICK_GROUP' && `「${movingPerson?.name}」の移動先：グループを選択`}
            </div>
            <div className="flex gap-2">
                {movePhase !== 'IDLE' ? (
                    <button onClick={cancelMove} className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border border-white/30 transition-all">
                        <X className="w-4 h-4"/> 戻る
                    </button>
                ) : (
                    <button 
                        onClick={handleAllocationCompleteBtnClick}
                        className="bg-green-600 hover:bg-green-700 px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 shadow-lg transition-all border border-green-500"
                    >
                        <CheckCircle className="w-4 h-4" /> 完了
                    </button>
                )}
            </div>
          </div>
        </div>

        {/* Board */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 md:p-6 bg-gray-50 border-r border-gray-200">
             <div className="grid grid-cols-1 gap-4 md:gap-6">
               {sites.map(site => {
                 const siteStaff = people.filter(p => p.siteId === site.id);
                 const grouped = groupPeopleByVehicle(siteStaff);
                 
                 // Sort groups based on site.groupOrder
                 let groupKeys = Object.keys(grouped);
                 if (site.groupOrder) {
                    groupKeys.sort((a, b) => {
                        const indexA = site.groupOrder!.indexOf(a);
                        const indexB = site.groupOrder!.indexOf(b);
                        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                        if (indexA !== -1) return -1;
                        if (indexB !== -1) return 1;
                        return 0;
                    });
                 }
                 
                 const vehicleGroups = groupKeys.map(key => ({ vehicleIdKey: key, members: grouped[key] }));
                 const isSiteSelectable = movePhase === 'PICK_SITE';
                 const isGroupSelectable = movePhase === 'PICK_GROUP' && targetSiteId === site.id;
                 const isLocked = movePhase !== 'IDLE' && !isSiteSelectable && !isGroupSelectable;
                 return (
                   <div 
                    key={site.id} 
                    className={`bg-white border-2 border-dashed rounded-lg md:rounded-xl p-3 md:p-4 min-h-[160px] md:min-h-[220px] flex flex-col transition-all ${isSiteSelectable ? 'border-blue-500 bg-blue-50 cursor-pointer hover:bg-blue-100 ring-2 ring-blue-300' : 'border-gray-300'} ${isGroupSelectable ? 'border-green-500 bg-green-50 ring-2 ring-green-300' : ''} ${isLocked ? 'opacity-40 pointer-events-none' : ''}`}
                    onClick={() => handleSiteSelect(site.id)}
                   >
                     <div className="flex items-center justify-between mb-2 md:mb-4 border-b border-gray-100 pb-1 md:pb-2">
                       <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                         <h3 className="font-bold text-sm md:text-lg text-gray-800 truncate">{site.name}</h3>
                         <span className="text-[10px] md:text-sm bg-gray-100 px-1.5 md:px-2 py-0.5 rounded text-gray-600 shrink-0">{siteStaff.length}名</span>
                       </div>
                     </div>
                     <div className="flex-1 flex flex-wrap gap-3 md:gap-6 content-start items-stretch">
                        {vehicleGroups.map((group, groupIndex) => {
                          const { vehicleIdKey, members } = group;
                          const isNullKey = vehicleIdKey === 'null' || vehicleIdKey.startsWith('temp_');
                          const realVId = isNullKey ? null : vehicleIdKey;
                          const groupCurrentVehicleId = vehicleIdKey === 'null' ? null : vehicleIdKey;
                          const canPickThisGroup = isGroupSelectable;
                          const movingPersonVehicleIdKey = movingPerson?.vehicleId === null ? 'null' : (movingPerson?.vehicleId || 'null');
                          const isCurrentGroup = movingPerson?.siteId === site.id && movingPersonVehicleIdKey === vehicleIdKey && members.some(m => m.id === movingPerson?.id);
                          
                          // Determine if sort buttons should be disabled
                          const isFirst = groupIndex === 0;
                          const isLast = groupIndex === vehicleGroups.length - 1;

                          return (
                            <div 
                              key={vehicleIdKey}
                              className={`bg-indigo-50 border border-indigo-200 rounded p-1.5 md:p-2 flex flex-col gap-1 md:gap-2 min-w-[120px] md:min-w-[140px] shadow-sm relative ${canPickThisGroup && !isCurrentGroup ? 'cursor-pointer hover:ring-4 hover:ring-green-400 hover:bg-green-100 hover:shadow-lg scale-105 transition-transform' : ''} ${isCurrentGroup && movePhase !== 'IDLE' ? 'bg-gray-200 opacity-70 border-gray-300 cursor-not-allowed' : ''}`}
                              onClick={(e) => { if (canPickThisGroup && !isCurrentGroup) { e.stopPropagation(); handleGroupSelect(vehicleIdKey === 'null' ? null : vehicleIdKey); } }}
                            >
                              <div className="flex items-center justify-between border-b border-indigo-200 pb-1 mb-1 h-[20px] md:h-[25px]">
                                <div className="flex items-center gap-1 w-full overflow-hidden" onClick={e => e.stopPropagation()}>
                                    <Truck className="w-3 h-3 text-indigo-700 shrink-0"/>
                                    <select
                                        className={`bg-transparent text-[10px] md:text-xs font-bold outline-none w-full truncate cursor-pointer hover:bg-indigo-100 rounded ${realVId ? 'text-indigo-900' : 'text-gray-500'}`}
                                        value={realVId || ""}
                                        onChange={(e) => changeGroupVehicle(site.id, groupCurrentVehicleId, e.target.value || null)}
                                        disabled={movePhase !== 'IDLE'}
                                    >
                                        <option value="">車両なし</option>
                                        {vehicles.filter(v => v.id === realVId || !allAssignedVehicleIds.has(v.id)).map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {movePhase === 'IDLE' && vehicleGroups.length > 1 && (
                                   <div className="flex items-center gap-0.5 shrink-0 ml-1">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleMoveGroup(site.id, vehicleIdKey, 'left'); }} 
                                        disabled={isFirst}
                                        className={`p-0.5 rounded ${isFirst ? 'text-gray-300 cursor-not-allowed' : 'text-indigo-600 hover:bg-indigo-200'}`}
                                      >
                                         <ChevronLeft size={14} />
                                      </button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleMoveGroup(site.id, vehicleIdKey, 'right'); }} 
                                        disabled={isLast}
                                        className={`p-0.5 rounded ${isLast ? 'text-gray-300 cursor-not-allowed' : 'text-indigo-600 hover:bg-indigo-200'}`}
                                      >
                                         <ChevronRight size={14} />
                                      </button>
                                   </div>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1 min-h-[40px] md:min-h-[50px]">
                                {[...members].sort((a, b) => getPersonSortPriority(a) - getPersonSortPriority(b)).map(p => (
                                  <div key={p.id} className="flex flex-col items-center">
                                    {renderDriverLabel(p)}
                                    <PersonCard 
                                      person={p} 
                                      onClick={setSelectedPersonForAction}
                                      isSelected={selectedPersonForAction?.id === p.id || movingPerson?.id === p.id}
                                      isDimmed={movePhase !== 'IDLE' && movingPerson?.id !== p.id}
                                    />
                                  </div>
                                ))}
                              </div>
                              {canPickThisGroup && !isCurrentGroup && <div className="absolute inset-0 flex items-center justify-center bg-green-500/10 rounded pointer-events-none"><div className="bg-green-500 text-white text-[10px] md:text-xs font-bold px-1.5 md:px-2 py-0.5 md:py-1 rounded shadow">ここに配置</div></div>}
                              {isCurrentGroup && movePhase !== 'IDLE' && <div className="absolute inset-0 flex items-center justify-center bg-gray-500/10 rounded pointer-events-none"><div className="bg-gray-500 text-white text-[10px] md:text-xs font-bold px-1.5 md:px-2 py-0.5 md:py-1 rounded shadow">現在の所属</div></div>}
                            </div>
                          );
                        })}
                        {isGroupSelectable && (
                            <button onClick={(e) => { e.stopPropagation(); handleNewGroupSelect(site.id); }} className="border-2 border-dashed border-green-400 bg-green-50 rounded-lg p-1.5 md:p-2 min-w-[120px] md:min-w-[140px] min-h-[80px] md:min-h-[100px] flex flex-col items-center justify-center gap-1 md:gap-2 hover:bg-green-100 transition-colors">
                                <Plus className="w-6 h-6 md:w-8 md:h-8 text-green-600" />
                                <span className="text-[10px] md:text-sm font-bold text-green-700">新規グループ</span>
                            </button>
                        )}
                     </div>
                   </div>
                 )
               })}
               
               {/* Mobile Yasumi Block at the bottom of Site list */}
               <div className="md:hidden">
                 {renderYasumiBlock(true)}
               </div>
             </div>
          </div>

          {/* Desktop Yasumi Sidebar */}
          <div className={`hidden md:flex w-48 border-l border-gray-300 flex-col shrink-0`}>
            {renderYasumiBlock(false)}
          </div>
        </div>

        {selectedPersonForAction && movePhase === 'IDLE' && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPersonForAction(null)}>
                <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-sm flex flex-col gap-4 animate-in slide-in-from-bottom-4 md:slide-in-from-none duration-200" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <h3 className="text-xl font-bold text-gray-800">{selectedPersonForAction.name}</h3>
                        <button onClick={() => setSelectedPersonForAction(null)} className="p-2 hover:bg-gray-100 rounded-full">
                            <X className="w-6 h-6 text-gray-500" />
                        </button>
                    </div>
                    <div className="flex flex-col gap-3 mt-1">
                        <button onClick={startMoveProcess} className="bg-blue-600 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3">
                            <ArrowLeftRight className="w-5 h-5" />
                            <span className="text-base md:text-lg">移動する</span>
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                             <button onClick={() => toggleDriver(selectedPersonForAction.id)} className={`font-bold py-2.5 px-2 rounded-xl shadow-md active:scale-95 transition-all flex flex-col items-center justify-center gap-1 ${selectedPersonForAction.isDriver ? 'bg-red-100 text-red-700 border-2 border-red-300' : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'}`}>
                                <Car className="w-5 h-5" />
                                <span className="text-xs md:text-sm">{selectedPersonForAction.isDriver ? '運転手解除' : '運転手に指名'}</span>
                             </button>
                             <button onClick={() => moveToYasumi(selectedPersonForAction.id)} className="bg-gray-500 text-white font-bold py-2.5 px-2 rounded-xl shadow-md hover:bg-gray-600 active:scale-95 transition-all flex flex-col items-center justify-center gap-1" disabled={selectedPersonForAction.siteId === YASUMI_SITE_ID}>
                                <Coffee className="w-5 h-5" />
                                <span className="text-xs md:text-sm">休みへ</span>
                             </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Completion Modal */}
        {isCompletionModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-2 md:p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
                    <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between bg-green-50 rounded-t-2xl">
                        <div className="flex items-center gap-2 text-green-700">
                            <CheckCircle className="w-5 h-5 md:w-6 md:h-6" />
                            <h3 className="text-lg md:text-xl font-bold truncate">配置完了（担当者を選択）</h3>
                        </div>
                        <button onClick={() => setIsCompletionModalOpen(false)} className="p-2 hover:bg-green-100 rounded-full transition-colors">
                            <X className="w-6 h-6 text-green-700" />
                        </button>
                    </div>
                    <div className="p-3 md:p-4 bg-white border-b border-gray-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                            <input type="text" placeholder="名前で絞り込み..." value={completerSearchQuery} onChange={(e) => setCompleterSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 md:py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm md:text-base" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2">
                        {people.filter(p => p.name.includes(completerSearchQuery)).sort((a,b) => {
                            const priority = { [Role.MANAGER]: 0, [Role.STAFF]: 1, [Role.OPERATOR]: 2, [Role.WORKER]: 3 };
                            const pa = priority[a.role] ?? 99;
                            const pb = priority[b.role] ?? 99;
                            if (pa !== pb) return pa - pb;
                            return a.name.localeCompare(b.name, 'ja');
                        }).map(p => (
                            <button key={p.id} onClick={() => handleAllocationComplete(p.name)} className="w-full text-left p-3 md:p-4 hover:bg-green-50 rounded-xl flex items-center justify-between group border border-transparent hover:border-green-200 transition-all shadow-sm bg-gray-50">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-1.5 md:w-2 h-6 md:h-8 rounded-full shrink-0 ${p.role === Role.MANAGER ? 'bg-green-600' : p.role === Role.STAFF ? 'bg-orange-400' : p.role === Role.OPERATOR ? 'bg-purple-400' : 'bg-gray-400'}`} />
                                    <span className="font-bold text-gray-800 text-base md:text-lg truncate">{p.name}</span>
                                </div>
                                <span className="text-green-500 opacity-0 group-hover:opacity-100 font-bold transition-opacity text-xs md:text-sm">選択 &rarr;</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* No Changes Alert */}
        {showNoChangesAlert && (
            <div className="fixed inset-0 bg-black/60 z-[130] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xs text-center flex flex-col items-center gap-4 animate-in zoom-in duration-150">
                    <div className="bg-blue-100 p-3 rounded-full"><AlertCircle className="w-8 h-8 text-blue-600" /></div>
                    <div><h3 className="font-bold text-gray-800 text-lg">通知</h3><p className="text-sm text-gray-600 mt-1">配置に変更がありません。</p></div>
                    <button onClick={() => setShowNoChangesAlert(false)} className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg">閉じる</button>
                </div>
            </div>
        )}

        {/* Exit Warning Popup */}
        {showExitWarning && (
            <div className="fixed inset-0 bg-black/60 z-[130] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xs text-center flex flex-col items-center gap-4 animate-in zoom-in duration-150">
                    <div className="bg-orange-100 p-3 rounded-full"><AlertCircle className="w-8 h-8 text-orange-600" /></div>
                    <div><h3 className="font-bold text-gray-800 text-lg">警告</h3><p className="text-sm text-gray-600 mt-1">配置が完了していません。<br/>変更を破棄して終了しますか？</p></div>
                    <div className="flex gap-2 w-full">
                        <button onClick={() => setShowExitWarning(false)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-lg">いいえ</button>
                        <button 
                            onClick={() => { 
                                setShowExitWarning(false);
                                // ロールバック：スナップショットからデータを復元
                                if (initialPeopleSnapshot) setPeople(JSON.parse(initialPeopleSnapshot));
                                if (initialSitesSnapshot) setSites(JSON.parse(initialSitesSnapshot));
                                setView('SETTINGS_MENU'); 
                            }} 
                            className="flex-1 bg-orange-600 text-white font-bold py-2 rounded-lg"
                        >
                            はい
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Success Animation */}
        {showCompletionSuccess && (
            <div className="fixed inset-0 bg-green-600/90 z-[120] flex flex-col items-center justify-center text-white animate-in fade-in duration-300">
                <div className="bg-white p-6 md:p-8 rounded-full shadow-2xl mb-6 animate-bounce">
                    <CheckCircle className="w-16 h-16 md:w-24 md:h-24 text-green-600" />
                </div>
                <h2 className="text-2xl md:text-4xl font-bold mb-2">配置完了</h2>
                <p className="text-lg md:text-xl font-medium opacity-90">担当：{showCompletionSuccess}</p>
                <p className="mt-8 text-xs md:text-sm animate-pulse">ホワイトボードに戻ります...</p>
            </div>
        )}
      </div>
    );
  };

  const renderDataManagementMenu = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4 flex items-center shadow-sm sticky top-0 z-10">
        <button onClick={() => setView('SETTINGS_MENU')} className="p-2 hover:bg-gray-100 rounded-full mr-4"><ChevronLeft className="w-6 h-6 text-gray-600" /></button>
        <h2 className="text-xl font-bold text-gray-800">データ管理</h2>
      </div>
      <div className="max-w-3xl mx-auto w-full p-4 md:p-6 space-y-4">
        <button onClick={() => setView('SITE_MANAGEMENT')} className="w-full py-5 md:py-6 px-4 md:px-6 bg-white border border-gray-200 shadow-sm rounded-xl flex items-center gap-4 md:gap-6 hover:bg-red-50 hover:border-red-200 transition-all group">
          <div className="bg-red-500 text-white p-3 md:p-4 rounded-full group-hover:scale-110 transition-transform shadow-md shrink-0"><MapPin className="w-6 h-6 md:w-8 md:h-8" /></div>
          <div className="text-left overflow-hidden"><h3 className="text-lg md:text-xl font-bold text-gray-800 truncate">現場管理</h3><p className="text-xs md:text-sm text-gray-500">工事現場の追加・削除・名称変更</p></div>
        </button>
        <button onClick={() => setView('VEHICLE_MANAGEMENT')} className="w-full py-5 md:py-6 px-4 md:px-6 bg-white border border-gray-200 shadow-sm rounded-xl flex items-center gap-4 md:gap-6 hover:bg-blue-50 hover:border-blue-200 transition-all group">
          <div className="bg-blue-500 text-white p-3 md:p-4 rounded-full group-hover:scale-110 transition-transform shadow-md shrink-0"><Truck className="w-6 h-6 md:w-8 md:h-8" /></div>
          <div className="text-left overflow-hidden"><h3 className="text-lg md:text-xl font-bold text-gray-800 truncate">車両管理</h3><p className="text-xs md:text-sm text-gray-500">使用車両（社用車・ダンプ等）管理</p></div>
        </button>
        <button onClick={() => setView('PERSON_MANAGEMENT')} className="w-full py-5 md:py-6 px-4 md:px-6 bg-white border border-gray-200 shadow-sm rounded-xl flex items-center gap-4 md:gap-6 hover:bg-indigo-50 hover:border-indigo-200 transition-all group">
          <div className="bg-indigo-500 text-white p-3 md:p-4 rounded-full group-hover:scale-110 transition-transform shadow-md shrink-0"><Users className="w-6 h-6 md:w-8 md:h-8" /></div>
          <div className="text-left overflow-hidden"><h3 className="text-lg md:text-xl font-bold text-gray-800 truncate">人員管理</h3><p className="text-xs md:text-sm text-gray-500">名簿管理と個別弁当設定</p></div>
        </button>
      </div>
    </div>
  );

   const renderSiteManagement = () => {
    const sortedSites = [...sites].sort(function(a, b) { return b.order - a.order; });
    return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4 flex items-center shadow-sm sticky top-0 z-10"><button onClick={function() { setView('DATA_MANAGEMENT_MENU'); }} className="p-2 hover:bg-gray-100 rounded-full mr-4"><ChevronLeft className="w-6 h-6 text-gray-600" /></button><h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 truncate"><MapPin className="w-6 h-6 text-red-500" />現場管理</h2></div>
      <div className="max-w-3xl mx-auto w-full p-4 md:p-6 space-y-6">
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200"><h3 className="font-bold text-gray-700 mb-4">新しい現場を追加</h3><div className="flex flex-col md:flex-row gap-2"><input type="text" value={newSiteName} onChange={function(e) { setNewSiteName(e.target.value); }} placeholder="現場名を入力 (例: A工区)" className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" /><button onClick={handleAddSite} disabled={!newSiteName.trim()} className="bg-blue-600 text-white px-6 py-3 md:py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> 追加</button></div></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="bg-gray-50 px-4 md:px-6 py-3 border-b border-gray-200 font-bold text-gray-500 text-sm">登録済み現場一覧 ({sites.length})</div><ul className="divide-y divide-gray-100">{sortedSites.map(function(site) { return (<li key={site.id} className="p-4 flex items-center justify-between hover:bg-gray-50"><span className="text-base md:text-lg font-medium text-gray-800 truncate pr-2">{site.name}</span><button onClick={function(e) { e.stopPropagation(); setConfirmTarget({ type: 'SITE', id: site.id, name: site.name }); }} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors shrink-0" title="削除"><Trash2 className="w-5 h-5" /></button></li>); })}</ul></div>
      </div>
    </div>
    );
  };


  const renderVehicleManagement = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4 flex items-center shadow-sm sticky top-0 z-10"><button onClick={() => setView('DATA_MANAGEMENT_MENU')} className="p-2 hover:bg-gray-100 rounded-full mr-4"><ChevronLeft className="w-6 h-6 text-gray-600" /></button><h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 truncate"><Truck className="w-6 h-6 text-blue-500" />車両管理</h2></div>
      <div className="max-w-3xl mx-auto w-full p-4 md:p-6 space-y-6">
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200"><h3 className="font-bold text-gray-700 mb-4">新しい車両を追加</h3><div className="flex flex-col md:flex-row gap-2"><input type="text" value={newVehicleName} onChange={(e) => setNewVehicleName(e.target.value)} placeholder="車両名を入力 (例: ハイエース1号)" className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" /><button onClick={handleAddVehicle} disabled={!newVehicleName.trim()} className="bg-blue-600 text-white px-6 py-3 md:py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> 追加</button></div></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="bg-gray-50 px-4 md:px-6 py-3 border-b border-gray-200 font-bold text-gray-500 text-sm">登録済み車両一覧 ({vehicles.length})</div><ul className="divide-y divide-gray-100">{[...vehicles].sort((a, b) => a.name.localeCompare(b.name, 'ja')).map(v => (<li key={v.id} className="p-4 flex items-center justify-between hover:bg-gray-50"><span className="text-base md:text-lg font-medium text-gray-800 truncate pr-2">{v.name}</span><button onClick={(e) => { e.stopPropagation(); setConfirmTarget({ type: 'VEHICLE', id: v.id, name: v.name }); }} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors shrink-0" title="削除"><Trash2 className="w-5 h-5" /></button></li>))}</ul></div>
      </div>
    </div>
  );

  const renderPersonManagement = () => {
    const groupedPeople = {
      [Role.MANAGER]: people.filter(p => p.role === Role.MANAGER).sort((a, b) => a.name.localeCompare(b.name, 'ja')),
      [Role.STAFF]: people.filter(p => p.role === Role.STAFF).sort((a, b) => a.name.localeCompare(b.name, 'ja')),
      [Role.OPERATOR]: people.filter(p => p.role === Role.OPERATOR).sort((a, b) => a.name.localeCompare(b.name, 'ja')),
      [Role.WORKER]: people.filter(p => p.role === Role.WORKER).sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    };
    const renderPersonRow = (person: Person) => (
      <li key={person.id} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50 gap-2 border-b border-gray-100 last:border-0">
        <div className="flex items-center gap-2 overflow-hidden flex-1">
            <span className={`w-2 h-2 md:w-3 md:h-3 rounded-full border border-gray-300 shrink-0 ${person.role === Role.MANAGER ? 'bg-green-600' : person.role === Role.STAFF ? 'bg-orange-500' : person.role === Role.OPERATOR ? 'bg-purple-600' : 'bg-black'}`}></span>
            <div className="text-sm md:text-lg font-bold text-gray-800 truncate">{person.name}</div>
            {person.hasLunch && (<span className="text-[8px] md:text-[10px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded-full border border-orange-200 whitespace-nowrap shrink-0">弁当あり</span>)}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] md:text-xs font-bold text-gray-500">弁当:</span>
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <button onClick={(e) => { e.stopPropagation(); toggleLunch(person.id); }} className={`px-1.5 md:px-3 py-0.5 md:py-1 rounded text-[10px] md:text-xs font-bold transition-all ${person.hasLunch ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>あり</button>
            <button onClick={(e) => { e.stopPropagation(); toggleLunch(person.id); }} className={`px-1.5 md:px-3 py-0.5 md:py-1 rounded text-[10px] md:text-xs font-bold transition-all ${!person.hasLunch ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>なし</button>
          </div>
          <div className="w-px h-4 md:h-6 bg-gray-200"></div>
          <button onClick={(e) => { e.stopPropagation(); setConfirmTarget({ type: 'PERSON', id: person.id, name: person.name }); }} className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1 md:p-2 rounded-lg transition-colors" title="削除">
            <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </li>
    );
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white border-b border-gray-200 p-4 flex items-center shadow-sm sticky top-0 z-10"><button onClick={() => setView('DATA_MANAGEMENT_MENU')} className="p-2 hover:bg-gray-100 rounded-full mr-4"><ChevronLeft className="w-6 h-6 text-gray-600" /></button><h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 truncate"><Users className="w-6 h-6 text-indigo-500" />人員管理</h2></div>
        <div className="max-w-3xl mx-auto w-full p-4 md:p-6 space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-700 mb-4">新しい人員を追加</h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-2">
                <input type="text" value={newPersonName} onChange={(e) => setNewPersonName(e.target.value)} placeholder="氏名 (例: 山田 太郎)" className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                <select value={newPersonRole} onChange={(e) => setNewPersonRole(e.target.value as Role)} className="p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm">{Object.entries(ROLE_LABELS).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}</select>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 w-full md:w-auto">
                  <span className="text-xs font-bold text-gray-600 flex items-center gap-1"><Utensils className="w-4 h-4"/> 弁当:</span>
                  <div className="flex gap-2">
                    <button onClick={() => setNewPersonHasLunch(true)} className={`px-4 md:px-3 py-1.5 md:py-1 rounded text-xs font-bold transition-colors ${newPersonHasLunch ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-200 text-gray-500'}`}>あり</button>
                    <button onClick={() => setNewPersonHasLunch(false)} className={`px-4 md:px-3 py-1.5 md:py-1 rounded text-xs font-bold transition-colors ${!newPersonHasLunch ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-200 text-gray-500'}`}>なし</button>
                  </div>
                </div>
                <button onClick={handleAddPerson} disabled={!newPersonName.trim()} className="w-full md:w-auto bg-indigo-600 text-white px-8 py-3 md:py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> 追加</button>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 md:px-6 py-3 border-b border-gray-200 font-bold text-gray-700 text-sm">登録済み人員一覧 ({people.length})</div>
            <div>
              <button onClick={() => toggleCategory(Role.MANAGER)} className="w-full bg-green-50 px-4 md:px-6 py-3 border-y border-gray-200 font-bold text-green-800 text-xs md:text-sm flex items-center justify-between hover:bg-green-100 transition-colors">
                <div className="flex items-center gap-2"><span className="w-2 md:w-3 h-2 md:h-3 border border-green-600 bg-white inline-block"></span>管理職 ({groupedPeople[Role.MANAGER].length})</div>
                {expandedCategories[Role.MANAGER] ? <ChevronDown /> : <ChevronRight />}
              </button>
              {expandedCategories[Role.MANAGER] && (<ul className="divide-y divide-gray-100">{groupedPeople[Role.MANAGER].length > 0 ? (groupedPeople[Role.MANAGER].map(renderPersonRow)) : (<li className="p-4 text-gray-400 text-sm text-center">登録なし</li>)}</ul>)}
            </div>
            <div>
              <button onClick={() => toggleCategory(Role.STAFF)} className="w-full bg-orange-50 px-4 md:px-6 py-3 border-y border-gray-200 font-bold text-orange-800 text-xs md:text-sm flex items-center justify-between hover:bg-orange-100 transition-colors">
                <div className="flex items-center gap-2"><span className="w-2 md:w-3 h-2 md:h-3 border border-orange-500 bg-white inline-block"></span>職員 ({groupedPeople[Role.STAFF].length})</div>
                {expandedCategories[Role.STAFF] ? <ChevronDown /> : <ChevronRight />}
              </button>
              {expandedCategories[Role.STAFF] && (<ul className="divide-y divide-gray-100">{groupedPeople[Role.STAFF].length > 0 ? (groupedPeople[Role.STAFF].map(renderPersonRow)) : (<li className="p-4 text-gray-400 text-sm text-center">登録なし</li>)}</ul>)}
            </div>
            <div>
              <button onClick={() => toggleCategory(Role.OPERATOR)} className="w-full bg-purple-50 px-4 md:px-6 py-3 border-y border-gray-200 font-bold text-purple-800 text-xs md:text-sm flex items-center justify-between hover:bg-purple-100 transition-colors">
                <div className="flex items-center gap-2"><span className="w-2 md:w-3 h-2 md:h-3 border border-purple-600 bg-white inline-block"></span>オペレーター ({groupedPeople[Role.OPERATOR].length})</div>
                {expandedCategories[Role.OPERATOR] ? <ChevronDown /> : <ChevronRight />}
              </button>
              {expandedCategories[Role.OPERATOR] && (<ul className="divide-y divide-gray-100">{groupedPeople[Role.OPERATOR].length > 0 ? (groupedPeople[Role.OPERATOR].map(renderPersonRow)) : (<li className="p-4 text-gray-400 text-sm text-center">登録なし</li>)}</ul>)}
            </div>
            <div>
              <button onClick={() => toggleCategory(Role.WORKER)} className="w-full bg-gray-100 px-4 md:px-6 py-3 border-y border-gray-200 font-bold text-gray-800 text-xs md:text-sm flex items-center justify-between hover:bg-gray-200 transition-colors">
                <div className="flex items-center gap-2"><span className="w-2 md:w-3 h-2 md:h-3 border border-black bg-white inline-block"></span>作業員 ({groupedPeople[Role.WORKER].length})</div>
                {expandedCategories[Role.WORKER] ? <ChevronDown /> : <ChevronRight />}
              </button>
              {expandedCategories[Role.WORKER] && (<ul className="divide-y divide-gray-100">{groupedPeople[Role.WORKER].length > 0 ? (groupedPeople[Role.WORKER].map(renderPersonRow)) : (<li className="p-4 text-gray-400 text-sm text-center">登録なし</li>)}</ul>)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCloudSettings = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4 flex items-center shadow-sm sticky top-0 z-10"><button onClick={() => setView('SETTINGS_MENU')} className="p-2 hover:bg-gray-100 rounded-full mr-4"><ChevronLeft className="w-6 h-6 text-gray-600" /></button><h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 truncate"><Cloud className="w-6 h-6 text-indigo-500" />クラウド共有設定</h2></div>
      <div className="max-w-3xl mx-auto w-full p-4 md:p-6 space-y-6">
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm md:text-base"><CheckCircle2 className={`w-5 h-5 ${cloudStatus === 'CONNECTED' ? 'text-green-500' : 'text-gray-300'}`} />現在のステータス</h3>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className={`px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 text-sm ${cloudStatus === 'CONNECTED' ? 'bg-green-100 text-green-700' : cloudStatus === 'CONNECTING' ? 'bg-yellow-100 text-yellow-700' : cloudStatus === 'ERROR' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
              {cloudStatus === 'CONNECTED' && <><Check className="w-4 h-4" /> 接続済み</>}
              {cloudStatus === 'CONNECTING' && <><Cloud className="w-4 h-4 animate-pulse" /> 接続中...</>}
              {cloudStatus === 'ERROR' && <><AlertCircle className="w-4 h-4" /> エラー発生</>}
              {cloudStatus === 'DISCONNECTED' && <><Ban className="w-4 h-4" /> 未接続</>}
            </div>
            {isCloudConnected && (<span className="text-xs md:text-sm text-gray-500 italic text-center md:text-left">リアルタイム同期が有効です</span>)}
          </div>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2 text-sm md:text-base"><Settings className="w-5 h-5 text-gray-500" />Firebase設定</h3>
          <p className="text-xs md:text-sm text-gray-500 mb-4">Firebaseコンソールから取得した構成オブジェクト（JSON）を貼り付けてください。</p>
          <textarea value={configInput} onChange={(e) => setConfigInput(e.target.value)} placeholder='{ "apiKey": "...", "authDomain": "...", ... }' className="w-full h-40 p-4 border border-gray-300 rounded-lg font-mono text-[10px] md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none mb-4" />
          <button onClick={handleSaveConfig} className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 text-sm md:text-base"><Save className="w-5 h-5" />設定を保存して再接続</button>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm md:text-base"><Save className="w-5 h-5 text-gray-500" />バックアップと復元</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <button onClick={handleExportData} className="flex items-center justify-center gap-3 p-4 border-2 border-dashed border-blue-200 rounded-xl hover:bg-blue-50 transition-colors group">
              <Download className="w-5 h-5 md:w-6 md:h-6 text-blue-500 group-hover:scale-110 transition-transform" />
              <div className="text-left"><div className="font-bold text-gray-800 text-xs md:text-sm">エクスポート</div><div className="text-[10px] text-gray-500">現在のデータを保存</div></div>
            </button>
            <label className="flex items-center justify-center gap-3 p-4 border-2 border-dashed border-green-200 rounded-xl hover:bg-green-50 transition-colors group cursor-pointer">
              <Upload className="w-5 h-5 md:w-6 md:h-6 text-green-500 group-hover:scale-110 transition-transform" />
              <div className="text-left"><div className="font-bold text-gray-800 text-xs md:text-sm">インポート</div><div className="text-[10px] text-gray-500">ファイルから復元</div></div>
              <input type="file" className="hidden" accept=".json" onChange={handleImportData} />
            </label>
          </div>
                      <button onClick={() => setIsRestoreModalOpen(true)} className="w-full mt-3 flex items-center justify-center gap-2 p-4 border-2 border-dashed border-red-200 rounded-xl hover:bg-red-50 transition-colors group">
              <div className="text-left"><div className="font-bold text-gray-800 text-xs md:text-sm">バックアップから復元</div><div className="text-[10px] text-gray-500">データに異常が発生した場合に、直前のバックアップから復元します</div></div>
            </button>
            <div className="text-[10px] text-gray-500 font-bold mt-2 text-center">{(() => { const bu = localStorage.getItem('wb_backup_last_update'); if (bu) { const info = JSON.parse(bu); return '最終更新：' + formatToJapaneseEra(info.time) + '（' + info.name + '）'; } return 'バックアップデータなし'; })()}</div>

        </div>
            {isRestoreModalOpen && (
<div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
<div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4">
<h3 className="text-xl font-bold text-indigo-600">バックアップから復元</h3>
<p className="text-sm text-gray-600">復元するにはパスワードを入力してください。</p>
<input type="password" value={restorePasswordInput} onChange={(e) => { setRestorePasswordInput(e.target.value); if (restoreError) setRestoreError(''); }} onKeyDown={(e) => { if (e.key === 'Enter' && restorePasswordInput === '4043') restoreFromBackup(); }} placeholder={'\u30D1\u30B9\u30EF\u30FC\u30C9\u3092\u5165\u529B'} className={'w-full p-4 border rounded-lg text-center text-xl tracking-wider outline-none ' + (restoreError ? 'border-red-500 bg-red-50' : 'border-gray-300')} />
{restoreError && <p className="text-red-500 text-xs font-bold text-center">{restoreError}</p>}
<div className="flex gap-2 mt-2">
<button onClick={() => { setIsRestoreModalOpen(false); setRestorePasswordInput(''); setRestoreError(''); }} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200">キャンセル</button>
<button onClick={() => { if (restorePasswordInput === '4043') { restoreFromBackup(); } else { setRestoreError('\u30D1\u30B9\u30EF\u30FC\u30C9\u304C\u9055\u3044\u307E\u3059\u3002'); }}} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700">復元する</button>
</div>
</div>
</div>
)}
      </div>
    </div>

  );

  return (
    <>
    {isInitialLoading && people.length === 0 && (<div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div><p className="text-gray-600 font-bold text-lg">データを読み込み中...</p></div></div>)}
      {(() => {
        switch (view) {
          case 'SETTINGS_MENU':
            return renderSettingsMenu();
          case 'CLOUD_SETTINGS':
            return renderCloudSettings();
          case 'DATA_MANAGEMENT_MENU':
            return renderDataManagementMenu();
          case 'SITE_MANAGEMENT':
            return renderSiteManagement();
          case 'VEHICLE_MANAGEMENT':
            return renderVehicleManagement();
          case 'PERSON_MANAGEMENT':
            return renderPersonManagement();
          case 'ALLOCATION':
            return renderAllocation();
          case 'WHITEBOARD':
          default:
            return renderWhiteboard();
        }
      })()}

      {/* Custom Confirmation Modal */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-10 h-10 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">削除の確認</h3>
              <p className="text-gray-600 mb-1">
                「<span className="font-bold text-gray-800">{confirmTarget.name}</span>」を削除しますか？
              </p>
              <div className="bg-gray-50 p-3 rounded-lg w-full mt-4 text-left border border-gray-100">
                <p className="text-xs text-gray-500 font-bold mb-1">削除の影響:</p>
                <p className="text-xs text-red-600">
                  {confirmTarget.type === 'SITE' && '・この現場に配置されている人員はすべて「休み」に移動します。'}
                  {confirmTarget.type === 'VEHICLE' && '・この車両に乗車設定されている人員の乗車設定が解除されます。'}
                  {confirmTarget.type === 'PERSON' && '・この人員の全データが削除されます。配置表からも消去されます。'}
                </p>
              </div>
            </div>
            <div className="flex border-t border-gray-100">
              <button 
                onClick={() => setConfirmTarget(null)}
                className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-50 transition-colors border-r border-gray-100"
              >
                キャンセル
              </button>
              <button 
                onClick={() => {
                  if (confirmTarget.type === 'SITE') executeDeleteSite(confirmTarget.id);
                  if (confirmTarget.type === 'VEHICLE') executeDeleteVehicle(confirmTarget.id);
                  if (confirmTarget.type === 'PERSON') executeDeletePerson(confirmTarget.id);
                }}
                className="flex-1 py-4 text-red-600 font-bold hover:bg-red-50 transition-colors"
              >
                削除する
              </button>
            </div>
          </div>

        </div>

      )}
    </>
  );
};

export default App;