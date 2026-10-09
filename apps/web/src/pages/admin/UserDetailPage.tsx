import { useState, type ReactNode } from "react";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAdminAction, useAdminUnlink, useAdminUser } from "@/api/admin";
import { useMe } from "@/api/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function Confirm({
  trigger,
  title,
  description,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AdminUserDetailPage() {
  const { userId } = useParams({ strict: false }) as { userId: string };
  const me = useMe();
  const user = useAdminUser(userId);
  const action = useAdminAction(userId);
  const unlink = useAdminUnlink();
  const [busy, setBusy] = useState(false);

  const run = (path: string, body?: unknown, message = "Done") => {
    setBusy(true);
    action.mutate(
      { path, body },
      {
        onSuccess: () => toast.success(message),
        onError: (error) => toast.error(error.message),
        onSettled: () => setBusy(false),
      },
    );
  };

  if (user.isPending) return <Skeleton className="h-64 w-full" />;
  if (user.isError) return <p className="text-sm text-destructive">{user.error.message}</p>;
  if (!user.data) return null;

  const data = user.data;
  const isSelf = me.data?.user.id === data.id;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{data.name}</CardTitle>
            <Badge variant={data.role === "admin" ? "default" : "secondary"}>{data.role}</Badge>
            {data.disabledAt && <Badge variant="destructive">disabled</Badge>}
          </div>
          <CardDescription>{data.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Signed up</dt>
              <dd className="tabular-nums">{data.createdAt.slice(0, 10)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last active</dt>
              <dd className="tabular-nums">{data.lastActiveAt?.slice(0, 16).replace("T", " ") ?? "never"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Open sessions</dt>
              <dd className="tabular-nums">{data.activity.sessionsActive}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {data.role === "coach" ? "Clients" : "Coach"}
              </dt>
              <dd>{data.role === "coach" ? (data.clientCount ?? 0) : (data.coachName ?? "-")}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Activity</CardTitle>
          <CardDescription>Counts only. Health data is never shown here.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Food entries</p>
            <p className="tabular-nums">{data.activity.foodEntries}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Workout sessions</p>
            <p className="tabular-nums">{data.activity.workoutSessions}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Step entries</p>
            <p className="tabular-nums">{data.activity.stepEntries}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Coach and client links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.links.length === 0 && <p className="text-sm text-muted-foreground">No links.</p>}
          {data.links.map((link) => (
            <div key={link.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-b-0">
              <div className="min-w-0 text-sm">
                <p className="truncate">
                  {link.coachName} to {link.clientName ?? "nobody yet"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {link.status} - code {link.inviteCode}
                </p>
              </div>
              <Confirm
                trigger={
                  <Button variant="outline" size="sm">
                    Unlink
                  </Button>
                }
                title="Unlink this coach and client?"
                description="The client keeps their logs. The coach loses access to them."
                onConfirm={() =>
                  unlink.mutate(link.id, {
                    onSuccess: () => toast.success("Unlinked"),
                    onError: (error) => toast.error(error.message),
                  })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Actions</CardTitle>
          <CardDescription>Every action here is written to the audit log.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {data.disabledAt ? (
            <Confirm
              trigger={
                <Button size="sm" disabled={busy}>
                  Re-enable account
                </Button>
              }
              title="Re-enable this account?"
              description="They will be able to sign in again."
              onConfirm={() => run(`/admin/users/${data.id}/enable`, undefined, "Account enabled")}
            />
          ) : (
            <Confirm
              trigger={
                <Button variant="destructive" size="sm" disabled={busy || isSelf}>
                  Disable account
                </Button>
              }
              title="Disable this account?"
              description="They are signed out everywhere and cannot sign in until re-enabled."
              onConfirm={() => run(`/admin/users/${data.id}/disable`, undefined, "Account disabled")}
            />
          )}

          <Confirm
            trigger={
              <Button variant="outline" size="sm" disabled={busy}>
                Force logout
              </Button>
            }
            title="Revoke every session?"
            description="They will need to sign in again on every device."
            onConfirm={() => run(`/admin/users/${data.id}/logout`, undefined, "Sessions revoked")}
          />

          {data.role !== "admin" && (
            <Confirm
              trigger={
                <Button variant="outline" size="sm" disabled={busy}>
                  Make {data.role === "coach" ? "client" : "coach"}
                </Button>
              }
              title="Change this account's role?"
              description="Existing logs and links stay as they are."
              onConfirm={() =>
                run(
                  `/admin/users/${data.id}/role`,
                  { role: data.role === "coach" ? "client" : "coach" },
                  "Role changed",
                )
              }
            />
          )}

          {data.role === "admin" ? (
            <Confirm
              trigger={
                <Button variant="outline" size="sm" disabled={busy || isSelf}>
                  Remove admin
                </Button>
              }
              title="Remove admin rights?"
              description="They become a client. You cannot do this to yourself."
              onConfirm={() => run(`/admin/users/${data.id}/admin`, { isAdmin: false }, "Admin removed")}
            />
          ) : (
            <Confirm
              trigger={
                <Button variant="outline" size="sm" disabled={busy}>
                  Make admin
                </Button>
              }
              title="Promote to admin?"
              description="They get the admin panel, but still cannot read anyone's health data."
              onConfirm={() => run(`/admin/users/${data.id}/admin`, { isAdmin: true }, "Promoted")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
