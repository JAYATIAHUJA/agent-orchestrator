import type { ReactNode } from "react";

// The board subhead (mc-board .dashboard-main__subhead): a compact title with
// a muted subtitle, optionally a trailing count. The board variant gives the
// Kanban landing surface a stronger hierarchy without affecting forms.
export function DashboardSubhead({
	title,
	subtitle,
	count,
	actions,
	variant = "default",
}: {
	title: string;
	subtitle: string;
	count?: number;
	actions?: ReactNode;
	variant?: "default" | "board";
}) {
	if (variant === "board") {
		return (
			<header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-6 pb-3 pt-6">
				<div className="min-w-[220px] max-w-[580px] flex-1">
					<div className="flex min-w-0 items-baseline gap-3">
						<h1 className="text-[34px] font-semibold leading-[1.05] tracking-normal text-foreground">{title}</h1>
						{typeof count === "number" && <span className="font-mono text-[13px] text-passive">{count}</span>}
					</div>
					<p className="mt-3 max-w-[560px] text-[14px] font-normal leading-6 text-muted-foreground/95">{subtitle}</p>
				</div>
				{actions ? <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 pt-1.5">{actions}</div> : null}
			</header>
		);
	}

	return (
		<div className="flex flex-wrap items-center gap-3 px-[18px] pt-[22px]">
			<div className="flex min-w-[220px] flex-1 items-baseline gap-3">
				<h1 className="text-[21px] font-bold tracking-normal text-foreground">{title}</h1>
				{typeof count === "number" && <span className="font-mono text-[13px] text-passive">{count}</span>}
				<span className="min-w-0 truncate text-[12.5px] text-passive">{subtitle}</span>
			</div>
			{actions ? <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">{actions}</div> : null}
		</div>
	);
}
