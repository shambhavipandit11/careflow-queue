import { useQueue } from "../store/QueueContext";
import { Phone, CheckCircle, XCircle, Play, Pause, Users, Clock, TrendingUp } from "lucide-react";

export function ProviderConsole() {
  const { 
    state, 
    callNextVisitor, 
    completeVisitor, 
    markNoShow, 
    toggleCounterStatus,
    calculateETA,
    formatETA
  } = useQueue();

  const counters = Object.values(state.queues);
  const totalWaiting = counters.reduce((sum, q) => sum + q.visitors.filter(v => v.status !== "completed" && v.status !== "no-show").length, 0);
  const totalServed = counters.reduce((sum, q) => sum + q.visitors.filter(v => v.status === "completed").length, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-slate-600 text-sm mb-1">Total Waiting</div>
              <div className="text-3xl font-bold text-indigo-600">{totalWaiting}</div>
            </div>
            <Users className="text-indigo-600" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-slate-600 text-sm mb-1">Served Today</div>
              <div className="text-3xl font-bold text-emerald-600">{totalServed}</div>
            </div>
            <TrendingUp className="text-emerald-600" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-slate-600 text-sm mb-1">Active Counters</div>
              <div className="text-3xl font-bold text-amber-600">
                {counters.filter(q => q.status === "open").length}/{counters.length}
              </div>
            </div>
            <Clock className="text-amber-600" size={32} />
          </div>
        </div>
      </div>

      {/* Service Counter Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {counters.map((queue) => {
          const calledVisitor = queue.visitors.find(v => v.status === "called");
          const waitingVisitors = queue.visitors.filter(v => v.status === "waiting" || v.status === "approaching");
          const isOpen = queue.status === "open";

          return (
            <div key={queue.serviceCounter} className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* Header */}
              <div className={`p-4 ${isOpen ? "bg-emerald-50" : "bg-amber-50"}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900">{queue.serviceCounter}</h3>
                  <span className="font-mono text-sm font-semibold text-slate-600">{queue.code}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{waitingVisitors.length} waiting</span>
                  <button
                    onClick={() => toggleCounterStatus(queue.serviceCounter)}
                    className={`flex items-center gap-1 px-2 py-1 rounded font-medium transition-colors ${
                      isOpen
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    }`}
                  >
                    {isOpen ? <><Play size={12} /> Open</> : <><Pause size={12} /> Paused</>}
                  </button>
                </div>
              </div>

              {/* Now Serving */}
              {calledVisitor ? (
                <div className="p-4 bg-indigo-50 border-b-2 border-indigo-200">
                  <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                    Now Serving
                  </div>
                  <div className="text-2xl font-black text-indigo-900 mb-3">{calledVisitor.token}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => completeVisitor(calledVisitor.id)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-emerald-500 text-white rounded font-medium hover:bg-emerald-600 transition-colors"
                    >
                      <CheckCircle size={16} /> Complete
                    </button>
                    <button
                      onClick={() => markNoShow(calledVisitor.id)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-rose-500 text-white rounded font-medium hover:bg-rose-600 transition-colors"
                    >
                      <XCircle size={16} /> No-Show
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border-b-2 border-slate-200">
                  <div className="text-center text-slate-500 text-sm py-2">No visitor being served</div>
                </div>
              )}

              {/* Queue List */}
              <div className="p-4 max-h-64 overflow-y-auto">
                {waitingVisitors.length > 0 ? (
                  <div className="space-y-2">
                    {waitingVisitors.map((visitor) => {
                      const eta = calculateETA(visitor.id);
                      return (
                        <div
                          key={visitor.id}
                          className={`flex items-center justify-between p-2 rounded transition-colors ${
                            visitor.priority === "Urgent"
                              ? "bg-rose-50 border border-rose-200"
                              : "bg-slate-50"
                          }`}
                        >
                          <div>
                            <div className="font-mono font-semibold text-slate-900">{visitor.token}</div>
                            <div className="text-xs text-slate-600 flex items-center gap-2">
                              <span>Pos {visitor.position}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock size={10} /> {formatETA(eta)}
                              </span>
                              {visitor.priority === "Urgent" && (
                                <span className="text-rose-600 font-semibold">⚡ Urgent</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => callNextVisitor(queue.serviceCounter)}
                            disabled={!isOpen || visitor.position !== 1}
                            className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                          >
                            Call
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 text-sm py-4">No visitors waiting</div>
                )}
              </div>

              {/* Call Next Button */}
              <div className="p-4 border-t bg-slate-50">
                <button
                  onClick={() => callNextVisitor(queue.serviceCounter)}
                  disabled={waitingVisitors.length === 0 || !isOpen || !!calledVisitor}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Phone size={18} />
                  Call Next Visitor
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
