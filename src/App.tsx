import { useState, useEffect } from "react";
import { QueueProvider, useQueue } from "./store/QueueContext";
import { Toast } from "./components/Toast";
import { RegistrationForm } from "./components/RegistrationForm";
import { UserView } from "./components/UserView";
import { ProviderConsole } from "./components/ProviderConsole";
import { DOMAINS } from "./config/domains";
import { 
  Landmark, Train, Stethoscope, Wrench, 
  Users, LayoutGrid, SplitSquareVertical, 
  RotateCcw, Wifi, WifiOff, Bell 
} from "lucide-react";
import "./index.css";

const iconMap: Record<string, any> = {
  Landmark, Train, Stethoscope, Wrench
};

function AppContent() {
  const { 
    state, isServerOnline, notificationManager, switchDomain, 
    toggleSplitDemoMode, resetDemo 
  } = useQueue();
  
  const [view, setView] = useState<"register" | "user" | "provider">("register");
  const [toast, setToast] = useState<string | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);

  useEffect(() => {
    notificationManager.setToastCallback((msg) => setToast(msg));
  }, [notificationManager]);

  const handleDomainSwitch = (domainId: string) => {
    switchDomain(domainId);
    setView("register");
    setUserToken(null);
  };

  const currentDomain = DOMAINS.find(d => d.id === state.currentDomain) || DOMAINS[0];
  const Icon = iconMap[currentDomain.icon] || Landmark;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Icon className="text-indigo-600" size={28} />
                <h1 className="text-2xl font-bold text-slate-900">QueueFlow</h1>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                Real-Time Sync
              </span>
              {isServerOnline ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded">
                  <Wifi size={12} /> Server Online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded">
                  <WifiOff size={12} /> Offline Mode
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => resetDemo()}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1.5"
              >
                <RotateCcw size={14} /> Reset
              </button>
              <button
                onClick={toggleSplitDemoMode}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                  state.splitDemoMode
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <SplitSquareVertical size={14} /> Split Demo
              </button>
            </div>
          </div>

          {/* Domain Switcher */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {DOMAINS.map((domain) => {
              const DomainIcon = iconMap[domain.icon];
              return (
                <button
                  key={domain.id}
                  onClick={() => handleDomainSwitch(domain.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    state.currentDomain === domain.id
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <DomainIcon size={16} />
                  {domain.name}
                </button>
              );
            })}
          </div>

          {/* View Toggle (when not in split mode) */}
          {!state.splitDemoMode && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setView("register")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  view === "register"
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Users size={16} className="inline mr-1.5" />
                Register
              </button>
              {userToken && (
                <button
                  onClick={() => setView("user")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    view === "user"
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Bell size={16} className="inline mr-1.5" />
                  My Token
                </button>
              )}
              <button
                onClick={() => setView("provider")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  view === "provider"
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <LayoutGrid size={16} className="inline mr-1.5" />
                Provider Console
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4">
        {state.splitDemoMode ? (
          <div className="flex gap-4 h-[calc(100vh-240px)]">
            <div className="flex-1 overflow-auto">
              {userToken ? (
                <UserView token={userToken} onTokenReceived={setUserToken} />
              ) : (
                <RegistrationForm onTokenReceived={setUserToken} onViewChange={setView} />
              )}
            </div>
            <div className="flex-1 overflow-auto">
              <ProviderConsole />
            </div>
          </div>
        ) : (
          <>
            {view === "register" && <RegistrationForm onTokenReceived={(token) => { setUserToken(token); setView("user"); }} onViewChange={setView} />}
            {view === "user" && <UserView token={userToken} onTokenReceived={setUserToken} />}
            {view === "provider" && <ProviderConsole />}
          </>
        )}
      </main>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

export default function App() {
  return (
    <QueueProvider>
      <AppContent />
    </QueueProvider>
  );
}
