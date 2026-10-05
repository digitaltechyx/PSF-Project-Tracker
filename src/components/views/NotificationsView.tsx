"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, UserPlus, Edit, MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';

const iconMap = {
  task_assigned: <UserPlus className="h-4 w-4" />,
  task_updated: <Edit className="h-4 w-4" />,
  comment_added: <MessageSquare className="h-4 w-4" />,
  task_unassigned: <UserPlus className="h-4 w-4" />,
  task_status_changed: <Edit className="h-4 w-4" />,
  subtask_assigned: <ListIcon />,
};

function ListIcon() {
  return <MessageSquare className="h-4 w-4" />;
}

export function NotificationsView({
  store,
  onNavigateToTask,
}: {
  store: any;
  onNavigateToTask?: (wsId: string, projId: string, taskId: string) => void;
}) {
  const { notifications, isLoading } = useNotifications(50);
  const { markNotificationAsRead } = store;

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inbox</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Assignments, comments, and task updates.
          </p>
        </div>
        {!isLoading && notifications.length > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {notifications.length} recent
          </p>
        )}
      </div>

      <Card className="border-border/60 shadow-sm overflow-hidden bg-card rounded-2xl">
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {notifications.map((notif: any) => (
              <div
                key={notif.id}
                className={cn(
                  'p-5 flex items-start gap-4 transition-colors hover:bg-muted/30 cursor-pointer',
                  !notif.read && 'bg-primary/[0.04] border-l-[3px] border-l-primary'
                )}
                onClick={() => {
                  if (!notif.read) markNotificationAsRead(notif.id);
                  if (notif.workspaceId && notif.projectId && notif.taskId && onNavigateToTask) {
                    onNavigateToTask(notif.workspaceId, notif.projectId, notif.taskId);
                  }
                }}
              >
                <div
                  className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm',
                    notif.type === 'task_assigned' || notif.type === 'subtask_assigned'
                      ? 'bg-blue-100 text-blue-600'
                      : notif.type === 'comment_added'
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-orange-100 text-orange-600'
                  )}
                >
                  {iconMap[notif.type as keyof typeof iconMap] || <Bell className="h-4 w-4" />}
                </div>

                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-sm">{notif.title}</span>
                    <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">{notif.message}</p>

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] font-medium text-primary/80">{notif.actorName}</span>
                    {!notif.read && <span className="h-1.5 w-1.5 bg-primary rounded-full" />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!isLoading && notifications.length === 0 && (
            <div className="p-16 text-center text-muted-foreground space-y-4">
              <div className="h-16 w-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto">
                <Bell className="h-8 w-8 opacity-20" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground">You&apos;re all caught up</h3>
                <p className="max-w-xs mx-auto text-sm">
                  Notifications about assignments and updates will appear here.
                </p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="p-20 flex justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                <span className="text-xs text-muted-foreground font-medium">Syncing inbox…</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
