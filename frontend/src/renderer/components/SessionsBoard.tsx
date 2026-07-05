import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { GitBranch } from "lucide-react";
import { type AttentionZone, type WorkspaceSession, attentionZone, workerSessions, sessionNeedsAttention } from "../types/workspace";
import { useSessionScmSummary, type SessionPRSummary } from "../hooks/useSessionScmSummary";
import { useWorkspaceQuery, workspaceQueryKey } from "../hooks/useWorkspaceQuery";
import { BoardToolbar } from "./BoardToolbar";
import { NewTaskDialog } from "./NewTaskDialog";
import { prDiffSummary, sessionPRDisplaySummaries } from "../lib/pr-display";
import { cn } from "../lib/utils";
import { PRAttentionPanel, PRStatusStrip } from "./PRSummaryDisplay";

type SessionsBoardProps = {
	/** When set, the board shows only this project's sessions. */
	projectId?: string;
};

type Column = {
	level: AttentionZone;
	label: string;
	dot: string;
	dotGlow: boolean;
	titleClass: string;
};

const COLUMNS: Column[] = [
	{
		level: "working",
		label: "Working",
		dot: "var(--orange)",
		dotGlow: true,
		titleClass: "text-working font-bold uppercase tracking-wide",
	},
	{
		level: "action",
		label: "Needs you",
		dot: "var(--amber)",
		dotGlow: true,
		titleClass: "text-warning font-bold uppercase tracking-wide",
	},
	{
		level: "pending",
		label: "In review",
		dot: "var(--fg-passive)",
		dotGlow: false,
		titleClass: "text-muted-foreground font-bold uppercase tracking-wide",
	},
	{
		level: "merge",
		label: "Ready to merge",
		dot: "var(--green)",
		dotGlow: true,
		titleClass: "text-success font-bold uppercase tracking-wide",
	},
];

export function SessionsBoard({ projectId }: SessionsBoardProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const workspaceQuery = useWorkspaceQuery();
	
	const all = workspaceQuery.data ?? [];
	const workspaces = projectId ? all.filter((w) => w.id === projectId) : all;
	const sessions = workspaces.flatMap((w) => workerSessions(w.sessions));

	const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

	// Toolbar Filter & Search States
	const [searchQuery, setSearchQuery] = useState("");

	// Filter sessions based on search
	const filteredSessions = sessions.filter((session) => {
		const matchesSearch = searchQuery === "" || 
			session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(session.branch && session.branch.toLowerCase().includes(searchQuery.toLowerCase())) ||
			session.status.toLowerCase().includes(searchQuery.toLowerCase());
		if (!matchesSearch) return false;

		return true;
	});

	// Collapsed Done / Terminated bar
	const [doneExpanded, setDoneExpanded] = useState(false);

	const openSession = (session: WorkspaceSession) =>
		void navigate({
			to: "/projects/$projectId/sessions/$sessionId",
			params: { projectId: session.workspaceId, sessionId: session.id },
		});


	const handleTaskCreated = async (sessionId: string) => {
		if (!projectId) return;
		await queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
		void navigate({
			to: "/projects/$projectId/sessions/$sessionId",
			params: { projectId, sessionId },
		});
	};

	// Group filtered sessions into Kanban Columns
	const byZone = new Map<AttentionZone, WorkspaceSession[]>();
	for (const session of filteredSessions) {
		const zone = attentionZone(session);
		(byZone.get(zone) ?? byZone.set(zone, []).get(zone)!).push(session);
	}
	const done = byZone.get("done") ?? [];

	return (
		<div className="flex h-full min-h-0 flex-col bg-background text-foreground relative overflow-y-auto">
			{/* Sticky Toolbar replacement of old header */}
			<BoardToolbar
				searchQuery={searchQuery}
				setSearchQuery={setSearchQuery}
				onCreateTask={() => setIsNewTaskOpen(true)}
			/>

			{/* Column Scroll Container - Horizontal scroll, grows vertically */}
			<div className="flex-grow overflow-x-auto overflow-y-visible w-full min-h-0">
				{workspaceQuery.isError ? (
					<p className="py-16 text-center text-[13px] text-passive">Could not load sessions.</p>
				) : (
					<div className="kanban-columns-wrapper flex gap-6 items-start justify-between min-w-[1000px] h-fit p-6 pb-24">
						{COLUMNS.map((col) => {
							const colSessions = byZone.get(col.level) ?? [];
							// Sort column items based on default attention priority
							const sortedColSessions = [...colSessions].sort((a, b) => {
								const aAttention = sessionNeedsAttention(a) ? 1 : 0;
								const bAttention = sessionNeedsAttention(b) ? 1 : 0;
								if (aAttention !== bAttention) {
									return bAttention - aAttention;
								}
								const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
								const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
								return bTime - aTime;
							});

							return (
								<ZoneColumn
									key={col.level}
									col={col}
									sessions={sortedColSessions}
									onOpen={openSession}
								/>
							);
						})}
					</div>
				)}
			</div>

			{done.length > 0 && (
				<div className="shrink-0 border-t border-border px-6 py-1 bg-bg-1/40 z-10 sticky bottom-0 bg-background/90 backdrop-blur">
					<button
						aria-expanded={doneExpanded}
						className="group flex min-h-[44px] w-full items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
						onClick={() => setDoneExpanded((v) => !v)}
						type="button"
					>
						<svg
							aria-hidden="true"
							className={cn("h-3 w-3 shrink-0 transition-transform duration-150", doneExpanded && "rotate-90")}
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							viewBox="0 0 24 24"
						>
							<path d="m9 18 6-6-6-6" />
						</svg>
						<span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.05em]">Done / Terminated</span>
						<span className="ml-auto shrink-0 font-mono text-[10px] text-passive bg-bg-3 px-2 py-0.5 rounded-full">{done.length}</span>
					</button>
					{doneExpanded && (
						<div className="flex flex-wrap gap-2 pb-4 pt-1">
							{done.map((s) => (
								<button
									key={s.id}
									className="rounded-[6px] border border-border bg-bg-2 px-3 py-1.5 text-left transition-all duration-150 hover:bg-bg-3 hover:border-border-strong"
									onClick={() => openSession(s)}
									type="button"
								>
									<span className="text-[12px] text-muted-foreground">{s.title}</span>
								</button>
							))}
						</div>
					)}
				</div>
			)}

			<NewTaskDialog
				open={isNewTaskOpen}
				projectId={projectId}
				onCreated={(sessionId) => void handleTaskCreated(sessionId)}
				onOpenChange={setIsNewTaskOpen}
			/>
		</div>
	);
}

function ZoneColumn({
	col,
	sessions,
	onOpen,
}: {
	col: Column;
	sessions: WorkspaceSession[];
	onOpen: (s: WorkspaceSession) => void;
}) {
	return (
		<section className="matte-column flex flex-col flex-1 min-w-0 rounded-none p-2.5 h-fit">
			{/* Lightweight Column Header */}
			<div className="sticky top-0 z-10 flex shrink-0 items-center gap-[9px] px-3 pb-5 pt-1 bg-transparent rounded-none">
				<span
					className="h-3.5 w-1.5 rounded-[2px]"
					style={{
						background: col.dot,
					}}
				/>
				<span className={cn("text-[11px]", col.titleClass)}>{col.label}</span>
				<span className="ml-auto font-mono text-[11px] leading-none text-passive">{sessions.length}</span>
			</div>
			
			<div className="flex flex-col gap-3 mt-3 h-fit">
				{sessions.map((session) => (
					<SessionCard key={session.id} session={session} onOpen={() => onOpen(session)} />
				))}
				{sessions.length === 0 && (
					<div className="flex flex-col items-center justify-center py-12 px-4 rounded-none border border-dashed border-border/10 text-center">
						<span className="text-[11.5px] text-passive font-light">No tasks</span>
					</div>
				)}
			</div>
		</section>
	);
}

function SessionCard({ session, onOpen }: { session: WorkspaceSession; onOpen: () => void }) {
	const badge = sessionBadge(session);
	const branch = session.branch || "";
	const showBranch = branch !== "" && !sameLabel(branch, session.title) && !sameLabel(branch, session.id);
	const prSummaries = sessionPRDisplaySummaries(session, useSessionScmSummary(session.id).data);

	return (
		<button
			className={cn(
				"session-card group relative w-full rounded-[8px] border border-white/5 hover:border-white/10 bg-bg-2 p-3.5 text-left transition-all duration-150 outline-none"
			)}
			onClick={onOpen}
			type="button"
		>
			<div className="text-[14.5px] font-semibold leading-snug tracking-normal text-foreground">
				{session.title}
			</div>

			{/* Metadata stays secondary so the task title remains the first read. */}
			<div className="mt-2.5 flex items-center gap-2">
				<span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
					<span className={cn("h-1.5 w-1.5 rounded-full", 
						session.status === "working" && "bg-working animate-status-pulse",
						session.status === "needs_input" && "bg-warning",
						session.status === "ci_failed" && "bg-error",
						session.status === "approved" && "bg-success",
						session.status === "mergeable" && "bg-success",
						"bg-passive"
					)} />
					<span className={cn(
						session.status === "working" && "text-working/90",
						session.status === "needs_input" && "text-warning/90",
						session.status === "ci_failed" && "text-error/90",
						session.status === "approved" && "text-success/90",
						session.status === "mergeable" && "text-success/90",
						"text-passive"
					)}>
						{badge.label}
					</span>
				</span>
				<span className="ml-auto shrink-0 font-mono text-[10px] text-passive">
					{agentLabel(session.provider)}
				</span>
			</div>

			{/* Smooth Expandable Content on Hover */}
			<div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-300 ease-in-out">
				<div className="overflow-hidden">
					<div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out delay-75">
						{showBranch && (
							<div className="mt-2.5 flex items-center min-w-0 gap-1.5 font-mono text-[10.5px] text-passive/85">
								<GitBranch className="h-3.5 w-3.5 inline shrink-0" />
								<span className="truncate block">{branch}</span>
							</div>
						)}

						<div className="mt-3.5 border-t border-border/10 pt-3 font-mono text-[10.5px] text-passive">
							{prSummaries.length > 0 ? (
								<div className="flex flex-col gap-2.5">
									{prSummaries.map((prSummary, index) => (
										<BoardPRSummary
											className={cn(index > 0 && "border-t border-border/5 pt-2.5")}
											key={prSummary.number}
											pr={prSummary}
										/>
									))}
								</div>
							) : (
								<div className="text-[10px] text-passive/70 font-light">No pull requests opened yet.</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</button>
	);
}

function BoardPRSummary({ className, pr }: { className?: string; pr: SessionPRSummary }) {
	const diffSummary = prDiffSummary(pr);
	return (
		<div className={cn("flex min-w-0 flex-col gap-1", className)}>
			<span className="text-[10px] text-foreground-muted flex items-center gap-1.5">
				<span className="font-semibold text-accent">#{pr.number}</span>
				<span>·</span>
				<span className="capitalize">{pr.state}</span>
			</span>
			{diffSummary ? <span className="truncate text-passive/85">{diffSummary}</span> : null}
			<PRStatusStrip pr={pr} />
			<PRAttentionPanel className="mt-1 pt-1 border-t border-border/10" interactiveLinks={false} maxItems={1} pr={pr} />
		</div>
	);
}

function sameLabel(a: string, b: string): boolean {
	const normalize = (value: string) =>
		value
			.toLowerCase()
			.replace(/^(feat|fix|chore|refactor|session)\//, "")
			.replace(/[^a-z0-9]+/g, "");
	return normalize(a) === normalize(b);
}

function agentLabel(provider: WorkspaceSession["provider"]): string {
	switch (provider) {
		case "claude-code":
			return "Claude";
		case "opencode":
			return "OpenCode";
		default:
			return provider;
	}
}

function sessionBadge(session: WorkspaceSession): { label: string; className: string } {
	switch (session.status) {
		case "needs_input":
			return { label: "Input needed", className: "text-warning" };
		case "no_signal":
			return { label: "No signal", className: "text-passive" };
		case "ci_failed":
			return { label: "CI failed", className: "text-error" };
		case "changes_requested":
			return { label: "Changes requested", className: "text-warning" };
		case "review_pending":
			return { label: "Review pending", className: "text-muted-foreground" };
		case "draft":
			return { label: "Draft PR", className: "text-muted-foreground" };
		case "pr_open":
			return { label: "PR open", className: "text-muted-foreground" };
		case "approved":
			return { label: "Approved", className: "text-success" };
		case "mergeable":
			return { label: "Ready", className: "text-success" };
		case "merged":
			return { label: "Merged", className: "text-passive" };
		case "terminated":
			return { label: "Terminated", className: "text-passive" };
		default:
			return { label: "Working", className: "text-working" };
	}
}
