"use client";

import * as React from "react";
import { Check, ChevronDown, Copy, Mail, RotateCw, ShieldCheck, UserCheck, UserMinus, UserPlus, Users } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { EmptyState } from "@/components/dashboard/empty-state";
import { InviteDialog } from "@/components/dashboard/invite-dialog";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { getSupabaseClient } from "@/lib/supabase";
import { callTeamRoute, type InviteResult } from "@/lib/team-api";
import { cn, formatCurrency, formatCurrencyCompact } from "@/lib/utils";

interface MemberRecord {
  userId: string;
  fullName: string;
  role: string;
  status: "active" | "inactive";
  joinedAt: string;
}

interface TargetRecord {
  amount: number;
  period: string;
}

interface InvitationRecord {
  id: string;
  email: string;
  fullName: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
  sendCount: number;
  personalTarget: number;
  targetPeriod: string;
}

function roleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "sales_rep") return "Sales rep";
  return role.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function initialsOf(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

/** Start of the current target window (monthly / quarterly / annual). */
function periodStart(period: string): Date {
  const now = new Date();
  if (period === "quarterly") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (period === "annual") return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const INVITATION_STATUS_STYLES: Record<InvitationRecord["status"], string> = {
  pending: "border-sky-200 bg-sky-50 text-sky-700",
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  revoked: "border-rose-200 bg-rose-50 text-rose-700",
  expired: "border-slate-200 bg-slate-100 text-slate-500",
};

export function TeamView() {
  const { membershipRole, organizationId } = useAuth();
  const { opportunities, activities, currency } = usePipeline();

  const [isLoading, setIsLoading] = React.useState(true);
  const [members, setMembers] = React.useState<MemberRecord[]>([]);
  const [targets, setTargets] = React.useState<Record<string, TargetRecord>>({});
  const [invitations, setInvitations] = React.useState<InvitationRecord[]>([]);
  const [resendLink, setResendLink] = React.useState<{ invitationId: string; acceptUrl: string } | null>(null);
  const [copiedResendLink, setCopiedResendLink] = React.useState(false);
  const [expandedUserId, setExpandedUserId] = React.useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<
    | { kind: "deactivate"; userId: string; name: string; openDeals: number }
    | { kind: "revoke"; invitationId: string; email: string }
    | null
  >(null);

  const loadTeam = React.useCallback(async () => {
    if (!organizationId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      const [membersResult, targetsResult, invitationsResult] = await Promise.all([
        supabase
          .from("organization_members")
          .select("user_id, role, status, joined_at")
          .eq("organization_id", organizationId),
        supabase.from("sales_targets").select("user_id, target_amount, period").eq("organization_id", organizationId),
        supabase
          .from("invitations")
          .select("id, email, full_name, status, expires_at, created_at, send_count, personal_target, target_period")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false }),
      ]);
      const queryError = membersResult.error ?? targetsResult.error ?? invitationsResult.error;
      if (queryError) throw new Error(queryError.message);

      const memberRows = (membersResult.data ?? []) as {
        user_id: string; role: string; status: string; joined_at: string;
      }[];
      const names: Record<string, string> = {};
      if (memberRows.length) {
        const profilesResult = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", memberRows.map((row) => row.user_id));
        if (profilesResult.error) throw new Error(profilesResult.error.message);
        for (const profile of (profilesResult.data ?? []) as { id: string; full_name: string | null }[]) {
          names[profile.id] = profile.full_name?.trim() || "Team member";
        }
      }

      const targetMap: Record<string, TargetRecord> = {};
      for (const row of (targetsResult.data ?? []) as { user_id: string; target_amount: number; period: string }[]) {
        targetMap[row.user_id] = { amount: Number(row.target_amount ?? 0), period: row.period };
      }

      setMembers(
        memberRows.map((row) => ({
          userId: row.user_id,
          fullName: names[row.user_id] ?? "Team member",
          role: row.role,
          status: row.status === "inactive" ? "inactive" : "active",
          joinedAt: row.joined_at,
        })),
      );
      setTargets(targetMap);
      setInvitations(
        (invitationsResult.data ?? []).map((row: Record<string, unknown>) => ({
          id: String(row.id),
          email: String(row.email),
          fullName: String(row.full_name ?? ""),
          status: String(row.status) as InvitationRecord["status"],
          expiresAt: String(row.expires_at),
          createdAt: String(row.created_at),
          sendCount: Number(row.send_count ?? 1),
          personalTarget: Number(row.personal_target ?? 0),
          targetPeriod: String(row.target_period ?? "monthly"),
        })),
      );
    } catch (error) {
      toast({
        title: "Could not load team data.",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    if (membershipRole === "owner") void loadTeam();
    else setIsLoading(false);
  }, [loadTeam, membershipRole]);

  const setMemberStatus = async (userId: string, status: "active" | "inactive") => {
    const { error } = await getSupabaseClient().rpc("set_member_status", {
      target_organization_id: organizationId,
      target_user_id: userId,
      new_status: status,
    });
    if (error) {
      toast({ title: "Member status was not changed.", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: status === "active" ? "Member reactivated." : "Member deactivated." });
    await loadTeam();
  };

  const handleResend = async (invitationId: string) => {
    try {
      const result = await callTeamRoute<InviteResult>("/api/team/resend", { organizationId, invitationId });
      if (result.emailSent) {
        setResendLink(null);
        toast({
          title: "Invitation resent.",
          description: [
            "A new link was issued; the old link no longer works.",
            result.warning,
          ]
            .filter(Boolean)
            .join(" "),
        });
      } else if (result.acceptUrl) {
        setResendLink({ invitationId, acceptUrl: result.acceptUrl });
        setCopiedResendLink(false);
        toast({
          title: "A new link was created, but email was not sent.",
          description: result.warning ?? "Share the link below manually.",
        });
      } else {
        throw new Error("The resend response did not include an invitation link.");
      }
      await loadTeam();
    } catch (error) {
      toast({ title: "Could not resend invitation.", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    }
  };

  const copyResendLink = async () => {
    if (!resendLink) return;
    try {
      await navigator.clipboard.writeText(resendLink.acceptUrl);
      setCopiedResendLink(true);
      setTimeout(() => setCopiedResendLink(false), 2000);
    } catch {
      toast({
        title: "Could not copy the invitation link.",
        description: "Select the link and copy it manually.",
        variant: "destructive",
      });
    }
  };

  const handleRevoke = async (invitationId: string) => {
    try {
      const result = await callTeamRoute<InviteResult>("/api/team/revoke", { organizationId, invitationId });
      toast({ title: "Invitation revoked.", description: result.warning ?? undefined });
      await loadTeam();
    } catch (error) {
      toast({ title: "Could not revoke invitation.", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    }
  };

  const actualFor = (userId: string, period: string): number => {
    const start = periodStart(period);
    return opportunities
      .filter((opportunity) =>
        opportunity.ownerId === userId &&
        opportunity.stage === "Closed Won" &&
        opportunity.closedDate &&
        new Date(opportunity.closedDate) >= start)
      .reduce((sum, opportunity) => sum + opportunity.value, 0);
  };

  if (membershipRole !== "owner") {
    return (
      <EmptyState
        title="Owner access required"
        description="Only the organization owner can manage team members and invitations."
        icon={ShieldCheck}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[28px]">Team</h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
            Manage members, invitations and targets. Members only see their own deals.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus />
          Invite
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[15px] font-semibold tracking-tight">Members</h2>
            <span className="text-2xs text-muted-foreground">{members.length}</span>
          </div>
        </div>

        {isLoading ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">Loading team…</p>
        ) : members.length === 0 ? (
          <EmptyState title="No members yet" description="Invite your first team member." icon={Users} />
        ) : (
          <ul className="divide-y divide-border">
            {members.map((member) => {
              const target = targets[member.userId];
              const actual = target ? actualFor(member.userId, target.period) : 0;
              const isExpanded = expandedUserId === member.userId;
              const memberDeals = opportunities.filter((opportunity) => opportunity.ownerId === member.userId);

              return (
                <li key={member.userId}>
                  <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setExpandedUserId(isExpanded ? null : member.userId)}
                      aria-expanded={isExpanded}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold",
                          member.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {initialsOf(member.fullName)}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold">{member.fullName}</span>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-2xs font-medium",
                              member.role === "owner"
                                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                : "border-slate-200 bg-slate-50 text-slate-600",
                            )}
                          >
                            {roleLabel(member.role)}
                          </span>
                          {member.status === "inactive" ? (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-2xs font-medium text-rose-700">
                              Deactivated
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-2xs text-muted-foreground">
                          {target && target.amount > 0
                            ? `${formatCurrency(actual, currency)} of ${formatCurrency(target.amount, currency)} ${target.period} target`
                            : "No personal target set"}
                        </span>
                      </span>
                    </button>

                    {member.role !== "owner" ? (
                      member.status === "active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setConfirmAction({
                              kind: "deactivate",
                              userId: member.userId,
                              name: member.fullName,
                              openDeals: memberDeals.filter(
                                (opportunity) => opportunity.stage !== "Closed Won" && opportunity.stage !== "Closed Lost",
                              ).length,
                            })
                          }
                        >
                          <UserMinus />
                          Deactivate
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => void setMemberStatus(member.userId, "active")}>
                          <UserCheck />
                          Reactivate
                        </Button>
                      )
                    ) : null}

                    <ChevronDown
                      className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")}
                    />
                  </div>

                  {isExpanded ? (
                    <div className="border-t border-border bg-muted/30 px-5 py-4">
                      {target && target.amount > 0 ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">Target vs actual ({target.period})</span>
                            <span className="text-muted-foreground">
                              {formatCurrencyCompact(actual, currency)} / {formatCurrencyCompact(target.amount, currency)}
                            </span>
                          </div>
                          <Progress
                            value={Math.min(Math.round((actual / target.amount) * 100), 100)}
                            aria-label="Target progress"
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No personal target set for this member.</p>
                      )}

                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <h3 className="text-2xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Their deals ({memberDeals.length})
                          </h3>
                          {memberDeals.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No deals assigned.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {memberDeals.slice(0, 6).map((opportunity) => (
                                <li key={opportunity.id} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="truncate">{opportunity.company}</span>
                                  <span className="shrink-0 text-muted-foreground">
                                    {opportunity.stage} · {formatCurrencyCompact(opportunity.value, currency)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-2xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Recent activity
                          </h3>
                          {activities.filter((a) => a.opportunityId && memberDeals.some((d) => d.id === a.opportunityId)).length === 0 ? (
                            <p className="text-xs text-muted-foreground">No activity yet.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {activities
                                .filter((a) => a.opportunityId && memberDeals.some((d) => d.id === a.opportunityId))
                                .slice(0, 6)
                                .map((activity) => (
                                  <li key={activity.id} className="text-xs">
                                    <span className="block truncate">{activity.text}</span>
                                    <span className="text-2xs text-muted-foreground">{activity.time}</span>
                                  </li>
                                ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[15px] font-semibold tracking-tight">Invitations</h2>
            <span className="text-2xs text-muted-foreground">{invitations.length}</span>
          </div>
        </div>

        {invitations.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No invitations yet. Invite a team member to get started.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{invitation.email}</p>
                  <p className="text-2xs text-muted-foreground">
                    {invitation.personalTarget > 0
                      ? `${formatCurrency(invitation.personalTarget, currency)} ${invitation.targetPeriod} target · `
                      : ""}
                    {invitation.status === "pending"
                      ? `expires ${new Date(invitation.expiresAt).toLocaleDateString()}`
                      : `sent ${new Date(invitation.createdAt).toLocaleDateString()}`}
                    {invitation.sendCount > 1 ? ` · ${invitation.sendCount} sends` : ""}
                  </p>
                </div>

                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-2xs font-medium capitalize",
                    INVITATION_STATUS_STYLES[invitation.status],
                  )}
                >
                  {invitation.status}
                </span>

                {invitation.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void handleResend(invitation.id)}>
                      <RotateCw />
                      Resend
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmAction({ kind: "revoke", invitationId: invitation.id, email: invitation.email })}
                    >
                      Revoke
                    </Button>
                  </div>
                ) : null}
                {invitation.status === "pending" && resendLink?.invitationId === invitation.id ? (
                  <div className="flex w-full gap-2">
                    <Input
                      aria-label={`New invitation link for ${invitation.email}`}
                      readOnly
                      value={resendLink.acceptUrl}
                      className="text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void copyResendLink()}
                      aria-label="Copy new invitation link"
                    >
                      {copiedResendLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="space-y-3">
        <h2 className="text-[15px] font-semibold tracking-tight">Org-wide activity feed</h2>
        <p className="text-xs text-muted-foreground">What team members are doing across all deals.</p>
        <ActivityFeed limit={8} />
      </div>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        organizationId={organizationId ?? ""}
        onInvited={() => void loadTeam()}
      />

      <ConfirmDialog
        open={confirmAction?.kind === "deactivate"}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title="Deactivate member?"
        description={
          confirmAction?.kind === "deactivate"
            ? `${confirmAction.name} will lose access immediately. Their ${confirmAction.openDeals} open deal(s) stay assigned — reassign them from the Pipeline if needed. You can reactivate this member at any time.`
            : ""
        }
        confirmLabel="Deactivate"
        onConfirm={() => {
          if (confirmAction?.kind === "deactivate") void setMemberStatus(confirmAction.userId, "inactive");
          setConfirmAction(null);
        }}
      />

      <ConfirmDialog
        open={confirmAction?.kind === "revoke"}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title="Revoke invitation?"
        description={
          confirmAction?.kind === "revoke"
            ? `The link sent to ${confirmAction.email} will stop working immediately.`
            : ""
        }
        confirmLabel="Revoke"
        onConfirm={() => {
          if (confirmAction?.kind === "revoke") void handleRevoke(confirmAction.invitationId);
          setConfirmAction(null);
        }}
      />
    </div>
  );
}
