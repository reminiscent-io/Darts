import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Lock, Target } from "lucide-react";

const STORAGE_KEY = "darts-access-granted";
const ACCESS_CODE = "NYFR";

export function isAccessGranted(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function grantAccess(): void {
  localStorage.setItem(STORAGE_KEY, "true");
}

interface AccessScreenProps {
  onAccessGranted: () => void;
}

export default function AccessScreen({ onAccessGranted }: AccessScreenProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  const handleSubmit = useCallback(() => {
    if (code.trim().toUpperCase() === ACCESS_CODE) {
      grantAccess();
      onAccessGranted();
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  }, [code, onAccessGranted]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <main className="h-full flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-8 w-full max-w-xs"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="w-8 h-8 text-primary" />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Cricket Darts
          </h1>
        </div>

        <motion.div
          animate={shaking ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="w-full flex flex-col gap-3"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Lock className="w-4 h-4" aria-hidden="true" />
            <label htmlFor="access-code-input">Enter access code</label>
          </div>
          <Input
            id="access-code-input"
            data-testid="input-access-code"
            type="text"
            placeholder="Access code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(false);
            }}
            onKeyDown={handleKeyDown}
            className={`text-center text-lg tracking-widest uppercase ${
              error ? "border-destructive" : ""
            }`}
            style={{ fontFamily: "var(--font-mono)" }}
            autoFocus
            autoComplete="off"
          />
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              role="alert"
              className="text-sm text-destructive text-center"
            >
              Incorrect code
            </motion.p>
          )}
          <Button
            data-testid="button-submit-access-code"
            onClick={handleSubmit}
            className="w-full"
            size="lg"
          >
            Enter
          </Button>
        </motion.div>
      </motion.div>
    </main>
  );
}
