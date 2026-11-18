import { X } from "lucide-react";
import { useEffect } from "react";

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed top-4 right-4 max-w-md bg-white shadow-lg rounded-lg p-4 border-l-4 border-indigo-600 animate-slide-in z-50">
      <div className="flex items-start">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-900">{message}</p>
        </div>
        <button
          onClick={onDismiss}
          className="ml-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
