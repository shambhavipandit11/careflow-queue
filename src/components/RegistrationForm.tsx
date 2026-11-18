import { useState, type FormEvent } from "react";
import { useQueue } from "../store/QueueContext";
import type { Priority } from "../types";
import { Clock, Users, CheckCircle2 } from "lucide-react";

interface RegistrationFormProps {
  onTokenReceived: (token: string) => void;
  onViewChange: (view: "user" | "provider") => void;
}

export function RegistrationForm({ onTokenReceived, onViewChange }: RegistrationFormProps) {
  const { state, registerVisitor } = useQueue();
  const [selectedCounter, setSelectedCounter] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("Normal");
  const [name, setName] = useState("");
  const [registeredToken, setRegisteredToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // const currentDomain = state.currentDomain;
  const counters = Object.values(state.queues);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCounter) return;

    setIsSubmitting(true);
    const visitor = await registerVisitor(selectedCounter, priority, name);
    setIsSubmitting(false);

    if (visitor) {
      setRegisteredToken(visitor.token);
      onTokenReceived(visitor.token);
    }
  };

  if (registeredToken) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 border-4 border-emerald-500">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="text-emerald-600" size={32} />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Token Issued!</h2>
            <div className="text-6xl font-black text-indigo-600 my-6 tracking-wider">
              {registeredToken}
            </div>
            <p className="text-slate-600 mb-6">
              Please keep this token handy. You'll be notified when your turn approaches.
            </p>
            <button
              onClick={() => onViewChange("user")}
              className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Track My Token
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Join Queue</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Input (Optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Your Name (Optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          {/* Service Counter Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Select Service Counter
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {counters.map((queue) => {
                const waitingCount = queue.visitors.filter(v => v.status !== "completed").length;
                const avgWait = waitingCount * queue.avgServiceTime;
                
                return (
                  <button
                    key={queue.serviceCounter}
                    type="button"
                    onClick={() => setSelectedCounter(queue.serviceCounter)}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedCounter === queue.serviceCounter
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="font-semibold text-slate-900 mb-2">{queue.serviceCounter}</div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <Users size={14} /> {waitingCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} /> ~{avgWait}min
                      </span>
                    </div>
                    <div className="mt-2 text-xs font-medium text-indigo-600">
                      Avg: {queue.avgServiceTime} min/person
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Priority Level
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPriority("Normal")}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  priority === "Normal"
                    ? "bg-slate-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setPriority("Urgent")}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  priority === "Urgent"
                    ? "bg-rose-500 text-white"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                }`}
              >
                Urgent
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!selectedCounter || isSubmitting}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Registering..." : "Get Digital Token"}
          </button>
        </form>
      </div>
    </div>
  );
}
