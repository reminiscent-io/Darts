import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ShareButtonProps {
  gameId: string;
  playerCount: number;
  isConnected: boolean;
}

export default function ShareButton({ gameId, playerCount, isConnected }: ShareButtonProps) {
  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/game/${gameId}`;

    // Try native Web Share API first (works on mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Darts Game",
          text: "Join my darts game!",
          url,
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fall through to clipboard
        if ((err as Error).name === "AbortError") return;
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied!",
        description: "Share it with your friends to join the game.",
      });
    } catch {
      // Last resort: prompt with the URL
      toast({
        title: "Share this link",
        description: url,
      });
    }
  }, [gameId]);

  return (
    <div className="flex items-center gap-1">
      {playerCount > 1 && (
        <div className="flex items-center gap-0.5 text-muted-foreground">
          <Users className="w-3 h-3" aria-hidden="true" />
          <span className="text-[10px] font-mono tabular-nums">
            {playerCount}
            <span className="sr-only"> devices connected</span>
          </span>
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground relative"
        aria-label={isConnected ? "Share game link (live sync connected)" : "Share game link"}
        onClick={handleShare}
      >
        <Share2 className="w-4 h-4" />
        {isConnected && (
          <span aria-hidden="true" className="absolute top-1 right-1 w-1.5 h-1.5 bg-chart-4 rounded-full" />
        )}
      </Button>
    </div>
  );
}
