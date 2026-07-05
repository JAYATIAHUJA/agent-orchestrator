import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Activity, Bot, Clock, FileCode, GitBranch, GitPullRequest, MessageSquare, Terminal, X } from "lucide-react";
import { type AttentionZone, type WorkspaceSession, attentionZone, workerSessions, sessionNeedsAttention, sessionIsActive } from "../types/workspace";
import { useWorkspaceQuery, workspaceQueryKey } from "../hooks/useWorkspaceQuery";
import { BoardToolbar } from "./BoardToolbar";
import { NewTaskDialog } from "./NewTaskDialog";
import { cn } from "../lib/utils";

type SessionsBoardProps = {
	/** When set, the board shows only this project's sessions. */
	projectId?: string;
};

type Column = {
	level: AttentionZone;
	label: string;
	dot: string;
	titleClass: string;
};

const COLUMNS: Column[] = [
	{
		level: "working",
		label: "Working",
		dot: "var(--orange)",
		titleClass: "text-working font-semibold",
	},
	{
		level: "action",
		label: "Needs you",
		dot: "var(--amber)",
		titleClass: "text-warning font-semibold",
	},
	{
		level: "pending",
		label: "In review",
		dot: "var(--fg-passive)",
		titleClass: "text-muted-foreground font-semibold",
	},
	{
		level: "merge",
		label: "Ready to merge",
		dot: "var(--green)",
		titleClass: "text-success font-semibold",
	},
];

const DETAIL_TABS = [
	{ label: "Overview", icon: Activity },
	{ label: "Conversation", icon: MessageSquare },
	{ label: "Logs", icon: Terminal },
	{ label: "Commits", icon: GitPullRequest },
	{ label: "Artifacts", icon: FileCode },
	{ label: "Timeline", icon: Clock },
] as const;

export function SessionsBoard({ projectId }: SessionsBoardProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const workspaceQuery = useWorkspaceQuery();
	const boardRef = useRef<HTMLDivElement>(null);
	const cardRectsRef = useRef<Map<string, DOMRect>>(new Map());

	const all = workspaceQuery.data ?? [];
	const workspaces = projectId ? all.filter((w) => w.id === projectId) : all;
	const sessions = workspaces.flatMap((w) => workerSessions(w.sessions));
	const activeAgents = sessions.filter(sessionIsActive).length;
	const taskCount = sessions.length;

	const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [doneExpanded, setDoneExpanded] = useState(false);
	const [selectedSession, setSelectedSession] = useState<WorkspaceSession | null>(null);

	const filteredSessions = sessions.filter((session) => {
		const q = searchQuery.trim().toLowerCase();
		if (q === "") return true;
		return (
			session.title.toLowerCase().includes(q) ||
			(session.branch?.toLowerCase().includes(q) ?? false) ||
			session.status.toLowerCase().includes(q) ||
			agentLabel(session.provider).toLowerCase().includes(q)
		);
	});

	const byZone = new Map<AttentionZone, WorkspaceSession[]>();
	for (const session of filteredSessions) {
		const zone = attentionZone(session);
		(byZone.get(zone) ?? byZone.set(zone, []).get(zone)!).push(session);
	}
	const done = byZone.get("done") ?? [];

	useLayoutEffect(() => {
		const board = boardRef.current;
		if (!board) return;
		const cards = Array.from(board.querySelectorAll<HTMLElement>("[data-session-card-id]"));
		const nextRects = new Map<string, DOMRect>();

		for (const card of cards) {
			const id = card.dataset.sessionCardId;
			if (!id) continue;
			const next = card.getBoundingClientRect();
			nextRects.set(id, next);
			const prev = cardRectsRef.current.get(id);
			if (!prev) continue;
			const deltaX = prev.left - next.left;
			const deltaY = prev.top - next.top;
			if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) continue;
			card.animate(
				[
					{ opacity: 0.62, transform: `translate(${deltaX}px, ${deltaY}px) scale(0.96)` },
					{ opacity: 0.88, transform: `translate(${deltaX * 0.18}px, ${deltaY * 0.18}px) scale(0.985)` },
					{ opacity: 1, transform: "translate(0, 0) scale(1)" },
				],
				{ duration: 250, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
			);
		}

		cardRectsRef.current = nextRects;
	}, [filteredSessions]);

	const navigateToSession = (session: WorkspaceSession) =>
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

	return (
		<div ref={boardRef} className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
			<BoardHeader activeAgents={activeAgents} taskCount={taskCount} />
			<BoardToolbar searchQuery={searchQuery} setSearchQuery={setSearchQuery} onCreateTask={() => setIsNewTaskOpen(true)} />

			<div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-1">
				{workspaceQuery.isError ? (
					<p className="py-16 text-center text-[13px] text-passive">Could not load sessions.</p>
				) : (
					<div className="kanban-columns-wrapper flex h-full min-h-0 min-w-[1080px] items-stretch justify-between px-5 pb-5 pt-8">
						{COLUMNS.map((col) => {
							const colSessions = byZone.get(col.level) ?? [];
							const sortedColSessions = [...colSessions].sort((a, b) => {
								const aAttention = sessionNeedsAttention(a) ? 1 : 0;
								const bAttention = sessionNeedsAttention(b) ? 1 : 0;
								if (aAttention !== bAttention) return bAttention - aAttention;
								const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
								const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
								return bTime - aTime;
							});

							return <ZoneColumn key={col.level} col={col} sessions={sortedColSessions} onOpen={setSelectedSession} />;
						})}
					</div>
				)}
			</div>

			{done.length > 0 && (
				<div className="shrink-0 border-t border-border bg-background/90 px-6 py-1 backdrop-blur">
					<button
						aria-expanded={doneExpanded}
						className="group flex min-h-[44px] w-full items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
						onClick={() => setDoneExpanded((v) => !v)}
						type="button"
					>
						<svg aria-hidden="true" className={cn("h-3 w-3 shrink-0 transition-transform duration-150", doneExpanded && "rotate-90")} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
							<path d="m9 18 6-6-6-6" />
						</svg>
						<span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.05em]">Done / Terminated</span>
						<span className="ml-auto shrink-0 rounded-full bg-bg-3 px-2 py-0.5 font-mono text-[10px] text-passive">{done.length}</span>
					</button>
					{doneExpanded && (
						<div className="flex flex-wrap gap-2 pb-4 pt-1">
							{done.map((session) => (
								<button key={session.id} className="rounded-[6px] border border-border bg-bg-2 px-3 py-1.5 text-left transition-all duration-150 hover:border-border-strong hover:bg-bg-3" onClick={() => setSelectedSession(session)} type="button">
									<span className="text-[12px] text-muted-foreground">{session.title}</span>
								</button>
							))}
						</div>
					)}
				</div>
			)}

			<TaskDetailsPanel session={selectedSession} onClose={() => setSelectedSession(null)} onOpenSession={navigateToSession} />
			<NewTaskDialog open={isNewTaskOpen} projectId={projectId} onCreated={(sessionId) => void handleTaskCreated(sessionId)} onOpenChange={setIsNewTaskOpen} />
		</div>
	);
}

type BoardHeaderProps = {
	activeAgents: number;
	taskCount: number;
};

function BoardHeader({ activeAgents, taskCount }: BoardHeaderProps) {
	return (
		<header className="px-6 pb-6 pt-7">
			<div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
				<div className="min-w-0">
					<h1 className="text-[31px] font-bold leading-none tracking-normal text-foreground">Board</h1>
					<p className="mt-2 text-[14px] font-normal leading-5 text-muted-foreground">
						Track AI agents as they progress from work <span aria-hidden="true">&rarr;</span> review <span aria-hidden="true">&rarr;</span> merge.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2 pt-1">
					<BoardStatChip icon={<Activity className="h-3.5 w-3.5 text-success" />} label={`${activeAgents} Active Agents`} />
					<BoardStatChip icon={<Bot className="h-3.5 w-3.5 text-muted-foreground" />} label={`${taskCount} Tasks`} />
				</div>
			</div>
		</header>
	);
}

function BoardStatChip({ icon, label }: { icon: ReactNode; label: string }) {
	return (
		<span className="inline-flex h-8 items-center gap-2 rounded-[10px] border border-border/70 bg-bg-1/55 px-3 text-[13px] font-medium text-muted-foreground">
			{icon}
			<span>{label}</span>
		</span>
	);
}

function ZoneColumn({ col, sessions, onOpen }: { col: Column; sessions: WorkspaceSession[]; onOpen: (session: WorkspaceSession) => void }) {
	return (
		<section className="matte-column group/lane flex min-h-0 min-w-[260px] flex-1 flex-col px-4 py-2" style={{ "--column-tone": col.dot } as CSSProperties}>
			<div className="flex shrink-0 items-center gap-[9px] px-0 pb-4 pt-0">
				<span className="h-3.5 w-1.5 rounded-[2px]" style={{ background: col.dot }} />
				<span className={cn("column-title-shine pb-[3px] text-[15.5px] leading-none tracking-normal", col.titleClass, `column-title-shine--${col.level}`)}>
					{col.label}
				</span>
				<span className="ml-auto font-mono text-[11px] leading-none text-passive">{sessions.length}</span>
			</div>

			<div className="kanban-lane-scroll mt-3 flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto pb-4 pr-1">
				{sessions.map((session) => (
					<SessionCard key={session.id} session={session} onOpen={() => onOpen(session)} />
				))}
				{sessions.length === 0 && (
					<div className="flex min-h-[112px] flex-col items-center justify-center rounded-[8px] border border-dashed border-border/20 px-4 py-12 text-center">
						<span className="text-[11.5px] font-light text-passive">No tasks</span>
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
	const needsAttention = sessionNeedsAttention(session);

	return (
		<button
			className="session-card animate-card-enter group relative w-full cursor-grab rounded-[9px] border p-4 text-left shadow-none outline-none hover:-translate-y-0.5 active:cursor-grabbing"
			data-session-card-id={session.id}
			onClick={onOpen}
			type="button"
		>
			<div className="flex items-start gap-3">
				<span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", statusDotClass(session.status))} />
				<div className="min-w-0 flex-1">
					<div className="truncate text-[16px] font-semibold leading-5 tracking-normal text-foreground">{session.title}</div>
					{showBranch && (
						<div className="mt-2 flex min-w-0 items-center gap-1.5 font-mono text-[13px] text-muted-foreground/80 transition-colors group-hover:text-muted-foreground">
							<GitBranch className="h-3.5 w-3.5 shrink-0" />
							<span className="truncate">{branch}</span>
						</div>
					)}
				</div>
				<span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", badge.className)}>{badge.label}</span>
			</div>

			<div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
				<span className="inline-flex min-w-0 items-center gap-1.5">
					<Bot className="h-3.5 w-3.5 shrink-0" />
					<span className="truncate">{agentLabel(session.provider)}</span>
				</span>
				<span className="font-mono text-[10.5px] text-passive">{relativeTime(session.updatedAt)}</span>
			</div>

			{needsAttention && <AttentionLine session={session} />}

			<div className="pointer-events-none mt-3 flex max-h-0 gap-2 overflow-hidden opacity-0 transition-all duration-150 group-hover:max-h-8 group-hover:opacity-100">
				{["Open", "Logs", "Retry", "Assign"].map((action) => (
					<span key={action} className="rounded-[6px] border border-border/70 bg-bg-2 px-2 py-1 text-[11px] font-medium text-muted-foreground">
						{action}
					</span>
				))}
			</div>
		</button>
	);
}

function AttentionLine({ session }: { session: WorkspaceSession }) {
	const label = attentionLabel(session);
	return (
		<div className="mt-3 rounded-[8px] border border-warning/20 bg-warning/8 px-3 py-2 text-[12px] text-warning">
			<div className="font-medium">{label.reason}</div>
			<div className="mt-0.5 text-[11px] text-warning/75">{label.action}</div>
		</div>
	);
}

function TaskDetailsPanel({ session, onClose, onOpenSession }: { session: WorkspaceSession | null; onClose: () => void; onOpenSession: (session: WorkspaceSession) => void }) {
	if (!session) return null;
	return (
		<>
			<button aria-label="Close task details" className="task-panel-backdrop animate-panel-backdrop fixed inset-x-0 bottom-0 top-14 z-30" onClick={onClose} type="button" />
			<aside className="task-details-panel animate-slide-over-in fixed bottom-0 right-0 top-14 z-40 flex w-[420px] max-w-[92vw] flex-col border-l border-border text-foreground">
				<div className="flex items-start gap-3 border-b border-border px-5 py-5">
					<div className="min-w-0 flex-1">
						<div className="mb-2 flex items-center gap-2">
							<span className={cn("h-2 w-2 rounded-full", statusDotClass(session.status))} />
							<span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", sessionBadge(session).className)}>{sessionBadge(session).label}</span>
						</div>
						<h2 className="truncate text-[18px] font-semibold leading-6">{session.title}</h2>
						<p className="mt-1 flex items-center gap-1.5 truncate font-mono text-[12px] text-muted-foreground">
							<GitBranch className="h-3.5 w-3.5 shrink-0" />
							{session.branch || session.id}
						</p>
					</div>
					<button className="rounded-[8px] p-2 text-muted-foreground transition-colors hover:bg-bg-2 hover:text-foreground" onClick={onClose} type="button">
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="scrollbar-hidden flex gap-2 overflow-x-auto border-b border-border px-4 py-3">
					{DETAIL_TABS.map(({ label, icon: Icon }, index) => (
						<button key={label} className={cn("inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[12px] transition-colors", index === 0 ? "bg-bg-2 text-foreground" : "text-muted-foreground hover:bg-bg-2 hover:text-foreground")} type="button">
							<Icon className="h-3.5 w-3.5" />
							{label}
						</button>
					))}
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
					<div className="space-y-5">
						<DetailRow label="Agent" value={agentLabel(session.provider)} />
						<DetailRow label="Status" value={sessionBadge(session).label} />
						<DetailRow label="Repository / branch" value={session.branch || "No branch yet"} />
						<DetailRow label="Last activity" value={relativeTime(session.updatedAt)} />
						<div className="rounded-[10px] border border-border bg-bg-1 p-4">
							<div className="text-[13px] font-semibold">Timeline</div>
							<div className="mt-3 space-y-3 text-[12px] text-muted-foreground">
								<div>Agent session created.</div>
								<div>{sessionBadge(session).label}</div>
								<div>{relativeTime(session.updatedAt)}</div>
							</div>
						</div>
					</div>
				</div>

				<div className="flex gap-2 border-t border-border px-5 py-4">
					<button className="rounded-[9px] border border-border bg-bg-2 px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-bg-3" onClick={() => onOpenSession(session)} type="button">
						Open full session
					</button>
					<button className="rounded-[9px] border border-border px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-bg-2 hover:text-foreground" type="button">
						View logs
					</button>
				</div>
			</aside>
		</>
	);
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<div className="text-[11px] font-medium uppercase tracking-[0.08em] text-passive">{label}</div>
			<div className="mt-1 truncate text-[13px] text-muted-foreground">{value}</div>
		</div>
	);
}

function attentionLabel(session: WorkspaceSession): { reason: string; action: string } {
	switch (session.status) {
		case "ci_failed":
			return { reason: "CI failed", action: "View logs" };
		case "needs_input":
			return { reason: "Waiting for you", action: "Respond" };
		case "changes_requested":
			return { reason: "Changes requested", action: "Review feedback" };
		default:
			return { reason: "Needs attention", action: "Open task" };
	}
}

function statusDotClass(status: WorkspaceSession["status"]): string {
	switch (status) {
		case "working":
			return "bg-working animate-status-pulse";
		case "needs_input":
		case "changes_requested":
			return "bg-warning";
		case "ci_failed":
			return "bg-error";
		case "approved":
		case "mergeable":
			return "bg-success";
		default:
			return "bg-passive";
	}
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
			return { label: "Waiting", className: "border-warning/25 bg-warning/10 text-warning" };
		case "no_signal":
			return { label: "Idle", className: "border-border bg-bg-2 text-passive" };
		case "ci_failed":
			return { label: "CI failed", className: "border-error/25 bg-error/10 text-error" };
		case "changes_requested":
			return { label: "Review", className: "border-warning/25 bg-warning/10 text-warning" };
		case "review_pending":
			return { label: "Reviewing", className: "border-border bg-bg-2 text-muted-foreground" };
		case "draft":
			return { label: "Draft", className: "border-border bg-bg-2 text-muted-foreground" };
		case "pr_open":
			return { label: "PR open", className: "border-border bg-bg-2 text-muted-foreground" };
		case "approved":
			return { label: "Approved", className: "border-success/25 bg-success/10 text-success" };
		case "mergeable":
			return { label: "Ready", className: "border-success/25 bg-success/10 text-success" };
		case "merged":
			return { label: "Merged", className: "border-border bg-bg-2 text-passive" };
		case "terminated":
			return { label: "Terminated", className: "border-border bg-bg-2 text-passive" };
		default:
			return { label: "Working", className: "border-working/25 bg-working/10 text-working" };
	}
}

function relativeTime(value?: string): string {
	if (!value) return "Just now";
	const time = new Date(value).getTime();
	if (Number.isNaN(time)) return "Just now";
	const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
