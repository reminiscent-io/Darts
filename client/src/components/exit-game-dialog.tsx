import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRef } from "react";

interface ExitGameDialogProps {
  open: boolean;
  /** Other devices currently in this game's room, this one excluded. */
  othersConnected?: number;
  onCancel: () => void;
  /** Step out on this device; the game keeps going for everyone else. */
  onLeave: () => void;
  /** Kill the game for every device in it. */
  onEndGame: () => void;
}

export default function ExitGameDialog({
  open,
  othersConnected = 0,
  onCancel,
  onLeave,
  onEndGame,
}: ExitGameDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent
        className="max-w-xs sm:max-w-sm rounded-md bg-card border-card-border text-center gap-3"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <AlertDialogTitle className="text-center">Done with this game?</AlertDialogTitle>
        <AlertDialogDescription className="text-center">
          {othersConnected > 0
            ? `${othersConnected} other ${othersConnected === 1 ? "device is" : "devices are"} in this game.`
            : "It isn't finished yet."}
        </AlertDialogDescription>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            className="w-full"
            onClick={onLeave}
            data-testid="button-leave-game"
          >
            Leave game
          </Button>
          <p className="text-xs text-muted-foreground -mt-1">
            Clears it from this device.{" "}
            {othersConnected > 0
              ? "Everyone else keeps playing."
              : "It stays live on its share link."}
          </p>

          <Button
            variant="ghost"
            className="w-full mt-1 text-destructive"
            style={{ borderColor: "hsl(var(--destructive) / 0.45)" }}
            onClick={onEndGame}
            data-testid="button-end-game"
          >
            End game for everyone
          </Button>
          <p className="text-xs text-muted-foreground -mt-1">
            Deletes it everywhere. Unfinished games aren't saved to history.
          </p>

          <Button
            ref={cancelRef}
            variant="ghost"
            className="w-full mt-1 text-muted-foreground"
            onClick={onCancel}
            data-testid="button-stay-in-game"
          >
            Stay
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
