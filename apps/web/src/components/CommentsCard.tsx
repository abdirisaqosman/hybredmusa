import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useMe } from "@/api/auth";
import { useAddComment, useComments, useDeleteComment } from "@/api/coach";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  clientId: string;
  targetType: "day" | "session";
  targetRef: string;
  title?: string;
}

export function CommentsCard({ clientId, targetType, targetRef, title = "Comments" }: Props) {
  const me = useMe();
  const comments = useComments(clientId, targetType, targetRef);
  const addComment = useAddComment(clientId, targetType, targetRef);
  const deleteComment = useDeleteComment(clientId);
  const [body, setBody] = useState("");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {targetType === "day" ? `On ${targetRef}` : "On this session"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {comments.isPending && <Skeleton className="h-16 w-full" />}
        {comments.data?.items.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
        {comments.data?.items.map((comment) => (
          <div key={comment.id} className="flex items-start justify-between gap-3 border-b pb-2 last:border-b-0">
            <div className="min-w-0">
              <p className="text-sm">{comment.body}</p>
              <p className="text-xs text-muted-foreground">
                {comment.author.name} - {comment.createdAt.slice(0, 16).replace("T", " ")}
              </p>
            </div>
            {comment.author.id === me.data?.user.id && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete comment"
                onClick={() => deleteComment.mutate(comment.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            addComment.mutate(body.trim(), {
              onSuccess: () => setBody(""),
              onError: (error) => toast.error(error.message),
            });
          }}
        >
          <Textarea
            rows={2}
            placeholder="Write a comment"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={addComment.isPending || !body.trim()}>
            {addComment.isPending ? "Posting..." : "Post comment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
