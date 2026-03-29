import { t } from "@lingui/core/macro";
import { TrashIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { orpc } from "@/integrations/orpc/client";

type ChecklistItem = {
	id: string;
	title: string;
	description: string;
	weight: number;
};

type ChecklistCreatorProps = {
	tenantId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function ChecklistCreator({ tenantId, open, onOpenChange }: ChecklistCreatorProps) {
	const queryClient = useQueryClient();
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [items, setItems] = useState<ChecklistItem[]>([
		{ id: crypto.randomUUID(), title: "", description: "", weight: 1 },
	]);

	const createMutation = useMutation(
		orpc.resume.checklists.create.mutationOptions({
			onSuccess: () => {
				setTitle("");
				setDescription("");
				setItems([{ id: crypto.randomUUID(), title: "", description: "", weight: 1 }]);
				onOpenChange(false);
				queryClient.invalidateQueries({ queryKey: ["resume", "checklists"] });
			},
		}),
	);

	const addItem = () => {
		setItems((prev) => [...prev, { id: crypto.randomUUID(), title: "", description: "", weight: 1 }]);
	};

	const removeItem = (id: string) => {
		setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
	};

	const updateItem = (id: string, updates: Partial<ChecklistItem>) => {
		setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
	};

	const handleSubmit = () => {
		if (!title.trim() || items.some((i) => !i.title.trim())) return;

		createMutation.mutate({
			title: title.trim(),
			description: description.trim() || undefined,
			tenantId,
			items: items.map((item, idx) => ({
				title: item.title.trim(),
				description: item.description.trim() || undefined,
				weight: item.weight,
				order: idx,
			})),
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="rounded-3xl sm:max-w-[700px]">
				<DialogHeader>
					<DialogTitle className="font-semibold text-lg text-slate-900">{t`Create Checklist`}</DialogTitle>
				</DialogHeader>

				<div className="max-h-[70vh] space-y-4 overflow-y-auto">
					{/* Title & Description */}
					<div className="space-y-3">
						<input
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Checklist title..."
							className="w-full rounded-xl border-0 bg-slate-50 px-4 py-3 font-semibold text-slate-900 text-sm outline-none ring-1 ring-slate-200 transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500"
						/>
						<textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Description (optional)..."
							rows={2}
							className="w-full resize-none rounded-xl border-0 bg-slate-50 px-4 py-3 text-slate-900 text-sm outline-none ring-1 ring-slate-200 transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500"
						/>
					</div>

					{/* Items */}
					<div className="space-y-3">
						<p className="font-semibold text-slate-400 text-xs uppercase tracking-widest">Checklist Items</p>
						{items.map((item, idx) => (
							<div key={item.id} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
								<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-600 text-xs">
									{idx + 1}
								</span>
								<div className="min-w-0 flex-1 space-y-2">
									<input
										type="text"
										value={item.title}
										onChange={(e) => updateItem(item.id, { title: e.target.value })}
										placeholder="Criterion title..."
										className="w-full rounded-xl border-0 bg-white px-3 py-2 text-slate-900 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
									/>
									<div className="flex items-center gap-2">
										<input
											type="text"
											value={item.description}
											onChange={(e) => updateItem(item.id, { description: e.target.value })}
											placeholder="Description (optional)..."
											className="flex-1 rounded-xl border-0 bg-white px-3 py-2 text-slate-700 text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
										/>
										<div className="flex items-center gap-1">
											<span className="text-slate-400 text-xs">Weight:</span>
											<input
												type="number"
												min={0.1}
												max={100}
												step={0.1}
												value={item.weight}
												onChange={(e) => updateItem(item.id, { weight: Number.parseFloat(e.target.value) || 1 })}
												className="w-16 rounded-xl border-0 bg-white px-2 py-2 text-center text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
											/>
										</div>
									</div>
								</div>
								<button
									type="button"
									onClick={() => removeItem(item.id)}
									className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600 active:scale-[0.95]"
								>
									<TrashIcon className="size-4" />
								</button>
							</div>
						))}

						<button
							type="button"
							onClick={addItem}
							className="w-full rounded-xl border-2 border-slate-200 border-dashed py-3 font-semibold text-slate-400 text-sm transition-all hover:border-indigo-300 hover:text-indigo-600 active:scale-[0.99]"
						>
							+ Add Item
						</button>
					</div>
				</div>

				{/* Submit */}
				<button
					type="button"
					onClick={handleSubmit}
					disabled={!title.trim() || items.some((i) => !i.title.trim()) || createMutation.isPending}
					className="w-full rounded-xl bg-indigo-600 py-2.5 font-semibold text-sm text-white transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
				>
					{createMutation.isPending ? "Creating..." : "Create Checklist"}
				</button>
			</DialogContent>
		</Dialog>
	);
}
