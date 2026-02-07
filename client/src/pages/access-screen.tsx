import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Lock, Target } from "lucide-react";

const ACCESS_CODE = "NYFR";
const STORAGE_KEY = "darts-access-granted";

export function isAccessGranted(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

interface AccessScreenProps {
  onAccessGranted: () => void;
}

export default function AccessScreen({ onAccessGranted }: AccessScreenProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (code.trim().toUpperCase() === ACCESS_CODE) {
      localStorage.setItem(STORAGE_KEY, "true");
      setError(false);
      onAccessGranted();
    } else {
      setError(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-4 w-full max-w-xs"
      >
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mb-2">
          <Target className="w-8 h-8 text-primary" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight font-mono text-foreground">
          Cricket Darts
        </h1>

        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Lock className="w-4 h-4" />
          <span>Enter access code</span>
        </div>

        <input
          data-testid="input-access-code"
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder="ACCESS CODE"
          className={`w-full bg-muted/50 border rounded-md px-4 py-3 text-center text-sm font-mono tracking-widest text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors uppercase ${
            error ? "border-destructive" : "border-border focus:border-primary/50"
          }`}
          autoComplete="off"
          autoFocus
        />

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-destructive"
          >
            Invalid access code
          </motion.p>
        )}

        <Button
          data-testid="button-access-submit"
          size="lg"
          className="w-full text-base"
          onClick={handleSubmit}
        >
          Enter
        </Button>
      </motion.div>
    </div>
  );
}
