import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayISO } from "@/lib/tracker/analytics";
import type { TrackerSettings } from "@/lib/tracker/types";

type Props = {
  open: boolean;
  initial?: TrackerSettings | null;
  onComplete: (s: TrackerSettings) => void;
};

export function OnboardingDialog({ open, initial, onComplete }: Props) {
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayISO());
  const [target, setTarget] = useState<number>(initial?.dailyTarget ?? 220);
  const [totalDays, setTotalDays] = useState<number>(initial?.totalDays ?? 105);

  useEffect(() => {
    if (initial) {
      setStartDate(initial.startDate);
      setTarget(initial.dailyTarget);
      setTotalDays(initial.totalDays);
    }
  }, [initial]);

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md [&>button.absolute]:hidden">
        <DialogHeader>
          <DialogTitle className="text-xl">Start your 105-Day Challenge</DialogTitle>
          <DialogDescription>
            Pick the day you started the challenge — we'll handle the rest.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="start">Start date</Label>
            <Input
              id="start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="target">Daily target (EGP)</Label>
              <Input
                id="target"
                type="number"
                inputMode="numeric"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="days">Total days</Label>
              <Input
                id="days"
                type="number"
                inputMode="numeric"
                value={totalDays}
                onChange={(e) => setTotalDays(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            Goal total ={" "}
            <span className="font-semibold text-foreground">
              {(target * totalDays).toLocaleString("en-US")} EGP
            </span>{" "}
            over {totalDays} days.
          </div>
        </div>
        <DialogFooter>
          <Button
            className="w-full"
            onClick={() =>
              onComplete({
                startDate,
                dailyTarget: Number(target) || 220,
                totalDays: Number(totalDays) || 90,
              })
            }
          >
            Start tracking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
