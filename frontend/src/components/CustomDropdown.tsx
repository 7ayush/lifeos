import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string | number;
  label: string | number;
}

interface CustomDropdownProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: Option[];
  icon?: React.ReactNode;
  className?: string;
  width?: string;
}

export function CustomDropdown({ value, onChange, options, icon, className = '', width = 'w-32' }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative shrink-0 ${width} ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-secondary/50 hover:bg-secondary/80 border border-border rounded-lg text-sm text-foreground font-medium transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 group"
      >

        <div className="flex items-center gap-1.5 overflow-hidden">
          {icon && <span className="text-cyan-400 group-hover:scale-110 transition-transform">{icon}</span>}

          <span className="truncate">{selectedOption?.label}</span>
        </div>
        <ChevronDown 
          className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180 text-cyan-400' : 'group-hover:text-foreground'}`} 
        />
      </button>

      {isOpen && (
        <div className="absolute z-100 left-0 min-w-full w-max mt-1.5 py-1.5 bg-popover/95 backdrop-blur-3xl rounded-xl border border-border shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200 origin-top overflow-hidden">

          <div className="max-h-60 overflow-y-auto custom-scrollbar">


            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${
                  option.value === value 
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold' 
                    : 'text-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                {option.label}
                {option.value === value && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
