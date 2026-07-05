import { useEffect, useRef } from "react";
import { Search, Command, Plus } from "lucide-react";

type BoardToolbarProps = {
	searchQuery: string;
	setSearchQuery: (query: string) => void;
	onCreateTask: () => void;
};

export function BoardToolbar({
	searchQuery,
	setSearchQuery,
	onCreateTask,
}: BoardToolbarProps) {
	const searchRef = useRef<HTMLInputElement>(null);

	// Command+K / / to focus search
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				searchRef.current?.focus();
			} else if (e.key === "/" && document.activeElement !== searchRef.current) {
				e.preventDefault();
				searchRef.current?.focus();
			} else if (e.key === "Escape" && document.activeElement === searchRef.current) {
				searchRef.current?.blur();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	return (
		<div className="sticky top-0 z-20 flex flex-col gap-3 px-6 py-4 border-b border-border/40 bg-background/70 backdrop-blur-md">
			<div className="flex flex-wrap items-center justify-between gap-4">
				{/* Left side: Search and filters */}
				<div className="flex flex-wrap items-center gap-3 flex-grow max-w-4xl">
					{/* Search */}
					<div className="relative flex items-center min-w-[200px] max-w-xs flex-grow bg-bg-1/40 border border-border/40 rounded-lg focus-within:border-accent/40 transition-colors">
						<Search className="absolute left-3 h-3.5 w-3.5 text-passive" />
						<input
							ref={searchRef}
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search board..."
							className="w-full bg-transparent border-0 py-1.5 pl-9 pr-8 text-[12.5px] placeholder-passive text-foreground focus:ring-0 focus:outline-none font-light"
						/>
						<span className="absolute right-3 flex items-center gap-0.5 pointer-events-none font-mono text-[9px] text-passive bg-bg-2 border border-border/40 px-1 py-0.5 rounded">
							<Command className="h-2.5 w-2.5" />
							<span>K</span>
						</span>
					</div>


				</div>

				{/* Right side: Sort and Actions */}
				<div className="flex items-center gap-3 shrink-0">


					{/* Create button */}
					<button
						onClick={onCreateTask}
						className="flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-accent-fg text-[12.5px] font-medium py-1.5 px-3.5 rounded-lg shadow-md transition-all active:scale-[0.98]"
						type="button"
					>
						<Plus className="h-4 w-4" />
						<span>Task</span>
					</button>
				</div>
			</div>
		</div>
	);
}
