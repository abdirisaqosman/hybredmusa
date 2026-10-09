import { toast } from "sonner";
import { useCreateInvite, useInvites } from "@/api/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function CoachInvites({ clientCount }: { clientCount: number }) {
  const invites = useInvites();
  const createInvite = useCreateInvite();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Clients</CardTitle>
        <CardDescription>
          {clientCount} active {clientCount === 1 ? "client" : "clients"}. Share a code so a client
          can link to you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          size="sm"
          disabled={createInvite.isPending}
          onClick={() =>
            createInvite.mutate(undefined, {
              onSuccess: (invite) => toast.success(`Invite code ${invite.inviteCode}`),
              onError: (error) => toast.error(error.message),
            })
          }
        >
          {createInvite.isPending ? "Creating..." : "New invite code"}
        </Button>

        {invites.isPending && <Skeleton className="h-24 w-full" />}
        {invites.data && invites.data.items.length === 0 && (
          <p className="text-sm text-muted-foreground">No invites yet.</p>
        )}
        {invites.data && invites.data.items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Client</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.data.items.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-mono">{invite.inviteCode}</TableCell>
                  <TableCell>
                    <Badge variant={invite.status === "active" ? "default" : "secondary"}>
                      {invite.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{invite.client?.name ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
