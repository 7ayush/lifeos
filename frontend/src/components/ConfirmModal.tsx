import { AlertCircle, X, Trash2, Info } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  variant = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const themes = {
    danger: {
      icon: <Trash2 className="w-6 h-6 text-rose-500" />,
      button: 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20',
      accent: 'border-rose-500/20',
      bg: 'bg-rose-500/10'
    },
    warning: {
      icon: <AlertCircle className="w-6 h-6 text-amber-500" />,
      button: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20',
      accent: 'border-amber-500/20',
      bg: 'bg-amber-500/10'
    },
    info: {
      icon: <Info className="w-6 h-6 text-indigo-500" />,
      button: 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20',
      accent: 'border-indigo-500/20',
      bg: 'bg-indigo-500/10'
    }
  };

  const theme = themes[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm glass-panel rounded-3xl border border-border p-8 shadow-2xl animate-in zoom-in-95 duration-300">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-6">
          <div className={`p-5 rounded-3xl ${theme.bg} border ${theme.accent} shadow-inner`}>
            {theme.icon}
          </div>
          
          <div className="space-y-3">
            <h3 className="text-2xl font-extrabold text-foreground font-['Outfit'] tracking-tight">{title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-[240px] mx-auto font-medium">{message}</p>
          </div>

          <div className="flex w-full gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3.5 rounded-2xl font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all border border-transparent hover:border-border active:scale-95"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-4 py-3.5 rounded-2xl font-bold text-white shadow-[0_0_20px_rgba(0,0,0,0.3)] transition-all active:scale-95 ${theme.button}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
