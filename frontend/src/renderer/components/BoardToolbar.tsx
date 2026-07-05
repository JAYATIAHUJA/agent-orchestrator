import { useEffect, useRef } from "react";
import { Search, Plus } from "lucide-react";

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
		<div className="sticky top-0 z-20 flex flex-col gap-3 border-b border-border/40 bg-background/70 px-6 pt-0 pb-4 backdrop-blur-md">
			<div className="flex flex-wrap items-center justify-between gap-4">
				{/* Left side: Search and filters */}
				<div className="flex flex-wrap items-center gap-3 flex-grow max-w-4xl">
					{/* Search */}
					<label className="board-search-field" data-has-value={searchQuery.length > 0}>
						<input
							ref={searchRef}
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search board..."
							className="board-search-input"
						/>
						<span className="slash-icon">/</span>
						<Search className="search-icon" />
					</label>


				</div>

				{/* Right side: Sort and Actions */}
				<div className="flex items-center gap-3 shrink-0">


					{/* Create button */}
					<button
						onClick={onCreateTask}
						className="board-new-task-button relative z-[1] flex h-11 items-center gap-2 overflow-hidden rounded-[12px] border border-[#5A87FF]/70 bg-[#4F7CFF] px-4 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(79,124,255,.22)] transition-all duration-200 hover:border-[#7EA2FF] hover:text-white hover:shadow-[0_8px_22px_rgba(79,124,255,.32)] active:scale-[0.98]"
						type="button"
					>
						<Plus className="relative z-[1] h-4 w-4" />
						<span className="relative z-[1]">Task</span>
					</button>
				</div>
			</div>
		</div>
	);
}




