import { useState, useRef } from "react";

interface PlayerNameInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  testId: string;
  savedNames: string[];
}

export default function PlayerNameInput({
  value,
  onChange,
  placeholder,
  testId,
  savedNames,
}: PlayerNameInputProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? savedNames.filter(
        (n) =>
          n.toLowerCase().includes(value.toLowerCase()) &&
          n.toLowerCase() !== value.toLowerCase()
      )
    : savedNames;

  const showDropdown = open && filtered.length > 0;

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        data-testid={testId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder}
        className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
        autoComplete="off"
      />
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-popover border border-border rounded-md shadow-md max-h-32 overflow-y-auto">
          {filtered.map((name) => (
            <button
              key={name}
              type="button"
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
