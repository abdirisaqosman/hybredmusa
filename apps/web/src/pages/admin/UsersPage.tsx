import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAdminUsers } from "@/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const users = useAdminUsers(query, cursor);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name or email"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setCursors([]);
        }}
        className="max-w-sm"
      />

      {users.isPending && <Skeleton className="h-64 w-full" />}
      {users.data && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Coach or clients</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Link
                      to="/admin/users/$userId"
                      params={{ userId: user.id }}
                      className="underline"
                    >
                      {user.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{user.createdAt.slice(0, 10)}</TableCell>
                  <TableCell className="tabular-nums">
                    {user.lastActiveAt ? user.lastActiveAt.slice(0, 10) : "never"}
                  </TableCell>
                  <TableCell>
                    {user.disabledAt ? (
                      <Badge variant="destructive">disabled</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">active</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.role === "coach"
                      ? `${user.clientCount ?? 0} clients`
                      : (user.coachName ?? "-")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={cursors.length === 0}
          onClick={() => setCursors((prev) => prev.slice(0, -1))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!users.data?.nextCursor}
          onClick={() =>
            users.data?.nextCursor && setCursors((prev) => [...prev, users.data.nextCursor!])
          }
        >
          Next
        </Button>
      </div>
    </div>
  );
}
