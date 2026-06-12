import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

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
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listId = useId();

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
    setActiveIndex(-1);
    if (onChange) onChange(next);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setOpen(false);
      setActiveIndex(-1);
    }, 150);
    if (onCommit && localValue !== value) {
      onCommit(localValue);
    }
  };

  const handlePick = (name: string) => {
    setLocalValue(name);
    if (onChange) onChange(name);
    if (onCommit) onCommit(name);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (filtered.length === 0) return;
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((prev) => (prev + delta + filtered.length) % filtered.length);
      return;
    }
    if (e.key === "Enter" && showDropdown && activeIndex >= 0) {
      e.preventDefault();
      handlePick(filtered[activeIndex]);
      return;
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        data-testid={testId}
        type="text"
        role="combobox"
        aria-label={placeholder}
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showDropdown && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
        }
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus-visible:ring-1 focus-visible:ring-ring transition-colors"
        autoComplete="off"
      />
      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          aria-label="Saved player names"
          className="absolute left-0 right-0 top-full mt-1 z-20 bg-popover border border-border rounded-md shadow-md max-h-32 overflow-y-auto"
        >
          {filtered.map((name, idx) => (
            <div
              key={name}
              id={`${listId}-option-${idx}`}
              role="option"
              aria-selected={idx === activeIndex}
              className={cn(
                "w-full cursor-pointer px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent",
                idx === activeIndex && "bg-accent"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePick(name)}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
