import { useLingui } from "@lingui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { LayoutGrid } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type RefObject, useRef, useState } from "react";
import { toast } from "sonner";
import { CometCard } from "@/components/animation/comet-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type DialogProps, useDialogStore } from "@/dialogs/store";
import { orpc } from "@/integrations/orpc/client";
import type { Template } from "@/schema/templates";
import { generateRandomName, slugify } from "@/utils/string";
import { cn } from "@/utils/style";
import { type TemplateMetadata, templates } from "./data";

export function TemplateBrowseDialog(_: DialogProps<"resume.template.browse">) {
	const navigate = useNavigate();
	const closeDialog = useDialogStore((state) => state.closeDialog);
	const scrollAreaRef = useRef<HTMLDivElement | null>(null);
	const [selected, setSelected] = useState<Template | null>(null);

	const { data: userInfo } = useQuery(orpc.userInfo.get.queryOptions());
	const hasUserInfo = Boolean(userInfo?.basics?.name?.trim());

	const { mutateAsync: createResume, isPending: isCreating } = useMutation(
		orpc.resume.create.mutationOptions(),
	);
	const { mutateAsync: patchResume, isPending: isPatching } = useMutation(
		orpc.resume.patch.mutationOptions(),
	);

	const isPending = isCreating || isPatching;

	const handleUseTemplate = async () => {
		if (!selected || isPending) return;

		const toastId = toast.loading(
			hasUserInfo ? t`Building your resume from My Info...` : t`Setting up a sample resume...`,
		);
		const name = generateRandomName();

		try {
			const id = await createResume({
				name,
				slug: slugify(name),
				tags: [],
				withSampleData: !hasUserInfo,
				jobDescription: "",
				useUserInfo: hasUserInfo,
			});

			await patchResume({
				id,
				operations: [{ op: "replace", path: "/metadata/template", value: selected }],
			});

			toast.success(
				hasUserInfo
					? t`Resume created from My Info using the ${templates[selected].name} template.`
					: t`Sample resume created with the ${templates[selected].name} template. Fill out My Info to get personalized resumes.`,
				{ id: toastId },
			);
			closeDialog();
			navigate({ to: "/builder/$resumeId", params: { resumeId: id } });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t`Failed to create resume.`, { id: toastId });
		}
	};

	return (
		<DialogContent className="lg:max-w-5xl">
			<DialogHeader className="gap-2">
				<DialogTitle className="flex items-center gap-3 text-xl">
					<LayoutGrid size={20} />
					<Trans>Browse Templates</Trans>
				</DialogTitle>
				<DialogDescription className="leading-relaxed">
					{hasUserInfo ? (
						<Trans>
							Pick a starting point. We'll create a new resume from your <strong>My Info</strong> tab using the chosen
							template — you can rename or switch templates anytime in the builder.
						</Trans>
					) : (
						<Trans>
							Pick a starting point. Add details in <strong>My Info</strong> to personalize new resumes — until then we'll
							spin up a sample resume with the chosen template.
						</Trans>
					)}
				</DialogDescription>
			</DialogHeader>

			<ScrollArea ref={scrollAreaRef} className="max-h-[60svh] pb-4">
				<div className="grid grid-cols-2 gap-6 p-4 md:grid-cols-3 lg:grid-cols-4">
					{Object.entries(templates).map(([template, metadata]) => (
						<TemplateCard
							key={template}
							metadata={metadata}
							id={template as Template}
							collisionBoundary={scrollAreaRef}
							isActive={template === selected}
							onSelect={(id) => setSelected(id)}
						/>
					))}
				</div>
			</ScrollArea>

			<DialogFooter>
				<Button variant="outline" onClick={closeDialog} disabled={isPending}>
					<Trans>Cancel</Trans>
				</Button>
				<Button onClick={handleUseTemplate} disabled={!selected || isPending}>
					{selected ? (
						<Trans>Use {templates[selected].name}</Trans>
					) : (
						<Trans>Pick a template</Trans>
					)}
				</Button>
			</DialogFooter>
		</DialogContent>
	);
}

type TemplateCardProps = {
	id: Template;
	isActive?: boolean;
	metadata: TemplateMetadata;
	collisionBoundary: RefObject<HTMLDivElement | null>;
	onSelect: (template: Template) => void;
};

function TemplateCard({ id, metadata, isActive, collisionBoundary, onSelect }: TemplateCardProps) {
	const { i18n } = useLingui();

	return (
		<HoverCard openDelay={150} closeDelay={0}>
			<CometCard translateDepth={3} rotateDepth={6} glareOpacity={0}>
				<HoverCardTrigger asChild>
					<button
						type="button"
						onClick={() => onSelect(id)}
						className={cn(
							"relative block aspect-page size-full cursor-pointer overflow-hidden rounded-md bg-popover outline-none transition-all",
							isActive && "ring-2 ring-primary ring-offset-4 ring-offset-background",
						)}
					>
						<img src={metadata.imageUrl} alt={metadata.name} className="size-full object-cover" />
					</button>
				</HoverCardTrigger>

				<div className="mt-2 flex items-center justify-center">
					<span className={cn("font-bold tracking-tight", isActive ? "text-primary" : "text-slate-700")}>
						{metadata.name}
					</span>
				</div>

				<HoverCardContent
					side="right"
					sideOffset={-32}
					align="start"
					alignOffset={32}
					collisionBoundary={collisionBoundary.current}
					className="pointer-events-none! flex w-80 flex-col justify-between space-y-6 rounded-md bg-background/95 p-4 pb-6 shadow-lg"
				>
					<div className="space-y-1">
						<h3 className="font-semibold text-lg">{metadata.name}</h3>
						<p className="text-muted-foreground text-sm">{i18n.t(metadata.description)}</p>
					</div>

					{metadata.tags.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{metadata.tags
								.sort((a, b) => a.localeCompare(b))
								.map((tag) => (
									<Badge key={tag} variant="default">
										{tag}
									</Badge>
								))}
						</div>
					)}
				</HoverCardContent>
			</CometCard>
		</HoverCard>
	);
}
