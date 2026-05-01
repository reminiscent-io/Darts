import { useState, useRef, useEffect } from "react";

interface PlayerNameInputProps {
  value: string;
  onChange?: (val: string) => void;
  onCommit?: (val: string) => void;
  placeholder: string;
  testId: string;
  savedNames: string[];
}

export default function PlayerNameInput({
  value,
  onChange,
  onCommit,
  placeholder,
  testId,
  savedNames,
}: PlayerNameInputProps) {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Re-sync if the upstream value changes (e.g., remote update via WebSocket)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const filtered = localValue.trim()
    ? savedNames.filter(
        (n) =>
          n.toLowerCase().includes(localValue.toLowerCase()) &&
          n.toLowerCase() !== localValue.toLowerCase()
      )
    : savedNames;

  const showDropdown = open && filtered.length > 0;

  const handleChange = (next: string) => {
    setLocalValue(next);
    if (onChange) onChange(next);
  };

  const handleBlur = () => {
    setTimeout(() => setOpen(false), 150);
    if (onCommit && localValue !== value) {
      onCommit(localValue);
    }
  };

  const handlePick = (name: string) => {
    setLocalValue(name);
    if (onChange) onChange(name);
    if (onCommit) onCommit(name);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        data-testid={testId}
        type="text"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
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
              onClick={() => handlePick(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
