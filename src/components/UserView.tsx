import { useEffect, useState } from "react";
import { useQueue } from "../store/QueueContext";
import { Clock, MapPin, AlertCircle, CheckCircle, LogOut } from "lucide-react";

interface UserViewProps {
  token: string | null;
  onTokenReceived: (token: string | null) => void;
}

export function UserView({ token, onTokenReceived }: UserViewProps) {
  const { getVisitorByToken, calculateETA, getVisualState, formatETA, leaveQueue } = useQueue();
  const [visitor, setVisitor] = useState(getVisitorByToken(token || ""));

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      setVisitor(getVisitorByToken(token));
    }, 500);
    return () => clearInterval(interval);
  }, [token, getVisitorByToken]);

  if (!token || !visitor) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-slate-900 mb-2">No Active Token</h2>
          <p className="text-slate-600">Please register to get your queue token.</p>
        </div>
      </div>
    );
  }

  const eta = calculateETA(visitor.id);
  const visualState = getVisualState(visitor);

  const handleLeave = async () => {
    if (confirm("Are you sure you want to leave the queue?")) {
      await leaveQueue(visitor.id);
      onTokenReceived(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Main Token Card */}
      <div className={`bg-white rounded-2xl shadow-xl p-8 border-l-8 transition-all ${
        visualState.state === "called" ? "border-emerald-500" :
        visualState.state === "approaching" ? "border-amber-500" :
        "border-slate-300"
      }`}>
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Your Token
          </div>
          <div className={`text-7xl font-black mb-4 tracking-wider ${
            visualState.state === "called" ? "text-emerald-600" :
            visualState.state === "approaching" ? "text-amber-600" :
            "text-indigo-600"
          }`}>
            {visitor.token}
          </div>

          {/* Status Badge */}
          <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold text-lg mb-6 ${
            visualState.state === "called" ? "bg-emerald-500 animate-pulse" :
            visualState.state === "approaching" ? "bg-amber-500" :
            "bg-slate-600"
          }`}>
            {visualState.state === "called" && <CheckCircle size={20} />}
            {visualState.message}
          </div>

          {/* Queue Info */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-slate-600 text-sm mb-1">Position</div>
              <div className="text-3xl font-bold text-slate-900">{visitor.position}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-slate-600 text-sm mb-1 flex items-center justify-center gap-1">
                <Clock size={14} /> Est. Wait
              </div>
              <div className="text-3xl font-bold text-slate-900">{formatETA(eta)}</div>
            </div>
          </div>

          {/* Service Info */}
          <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
            <div className="flex items-center justify-center gap-2 text-indigo-700">
              <MapPin size={16} />
              <span className="font-medium">{visitor.serviceCounter}</span>
            </div>
            {visitor.priority === "Urgent" && (
              <div className="mt-2 text-rose-600 font-semibold text-sm">
                ⚡ Urgent Priority
              </div>
            )}
          </div>

          {/* Leave Queue Button */}
          <button
            onClick={handleLeave}
            className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Leave Queue
          </button>
        </div>
      </div>

      {/* Waiting Room Board */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Waiting Room</h3>
        <div className="space-y-2">
          {Object.values(useQueue().state.queues).flatMap(q => 
            q.visitors.filter(v => v.status !== "completed" && v.status !== "no-show").slice(0, 4)
          ).map(v => (
            <div key={v.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="font-mono font-semibold text-slate-900">{v.token}</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                v.status === "called" ? "bg-emerald-100 text-emerald-700" :
                v.status === "approaching" ? "bg-amber-100 text-amber-700" :
                "bg-slate-200 text-slate-700"
              }`}>
                {v.status === "called" ? "Being Served" : `Pos ${v.position}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
