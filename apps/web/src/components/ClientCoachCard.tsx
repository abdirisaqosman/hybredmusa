import { useState } from "react";
import { toast } from "sonner";
import type { PublicUser } from "@hybredmusa/shared";
import { useLinkToCoach } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClientCoachCard({ coach }: { coach: PublicUser | null }) {
  const [code, setCode] = useState("");
  const link = useLinkToCoach();

  if (coach) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your coach</CardTitle>
          <CardDescription>{coach.name}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Link to a coach</CardTitle>
        <CardDescription>Enter the invite code your coach gave you.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            link.mutate(code.trim().toUpperCase(), {
              onSuccess: (result) => {
                setCode("");
                toast.success(`Linked to ${result.coach.name}`);
              },
              onError: (error) => toast.error(error.message),
            });
          }}
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="invite-code">Invite code</Label>
            <Input
              id="invite-code"
              value={code}
              autoCapitalize="characters"
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={link.isPending}>
            {link.isPending ? "Linking..." : "Link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
