import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { GridFourIcon, ListIcon, ReadCvLogoIcon, SortAscendingIcon, TagIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams, useNavigate, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { zodValidator } from "@tanstack/zod-adapter";
import { useMemo } from "react";
import z from "zod";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { MultipleCombobox } from "@/components/ui/multiple-combobox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";
import { DashboardHeader } from "../-components/header";
import { GridView } from "./-components/grid-view";
import { ListView } from "./-components/list-view";

type SortOption = "lastUpdatedAt" | "createdAt" | "name";

const searchSchema = z.object({
	tags: z.array(z.string()).default([]),
	sort: z.enum(["lastUpdatedAt", "createdAt", "name"]).default("lastUpdatedAt"),
});

export const Route = createFileRoute("/dashboard/resumes/")({
	component: RouteComponent,
	validateSearch: zodValidator(searchSchema),
	search: {
		middlewares: [stripSearchParams({ tags: [], sort: "lastUpdatedAt" })],
	},
	loader: async () => {
		const view = await getViewServerFn();
		return { view };
	},
});

function RouteComponent() {
	const router = useRouter();
	const { i18n } = useLingui();
	const { view } = Route.useLoaderData();
	const { tags, sort } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });

	const { data: allTags } = useQuery(orpc.resume.tags.list.queryOptions());
	const { data: resumes } = useQuery(orpc.resume.list.queryOptions({ input: { tags, sort } }));

	const tagOptions = useMemo(() => {
		if (!allTags) return [];
		return allTags.map((tag) => ({ value: tag, label: tag }));
	}, [allTags]);

	const sortOptions = useMemo(() => {
		return [
			{ value: "lastUpdatedAt", label: i18n.t("Last Updated") },
			{ value: "createdAt", label: i18n.t("Created") },
			{ value: "name", label: i18n.t("Name") },
		];
	}, [i18n]);

	const onViewChange = (value: string) => {
		setViewServerFn({ data: value as "grid" | "list" });
		router.invalidate();
	};

	return (
		<div className="space-y-6">
			<DashboardHeader
				icon={ReadCvLogoIcon}
				title={t`Resumes`}
				description={t`Manage and build professional, ATS-friendly resumes.`}
			/>

			<div className="flex items-center gap-x-3 rounded-[1.5rem] border border-border bg-white p-3 shadow-sm transition-all duration-300 hover:shadow-md">
				<Combobox
					value={sort}
					options={sortOptions}
					onValueChange={(value) => {
						if (!value) return;
						navigate({ search: { tags, sort: value as SortOption } });
					}}
					buttonProps={{
						title: t`Sort by`,
						variant: "ghost",
						className: "rounded-xl text-slate-600 hover:bg-primary/5 hover:text-primary transition-all tap-active",
						children: (_, option) => (
							<>
								<SortAscendingIcon className="size-5" />
								<span className="font-semibold">{option?.label}</span>
							</>
						),
					}}
				/>

				<div className="mx-2 h-6 w-px bg-border" />

				<MultipleCombobox
					value={tags}
					options={tagOptions}
					onValueChange={(value) => {
						navigate({ search: { tags: value, sort } });
					}}
					buttonProps={{
						variant: "ghost",
						title: t`Filter by`,
						className: cn("tap-active rounded-xl text-slate-600 transition-all hover:bg-primary/5 hover:text-primary", {
							hidden: tagOptions.length === 0,
						}),
						children: (_, options) => (
							<>
								<TagIcon className="size-5" />
								<span className="font-semibold">{t`Tags`}</span>
								{options.length > 0 && (
									<div className="flex gap-1">
										{options.map((option) => (
											<Badge
												key={option.value}
												variant="secondary"
												className="rounded-lg border-none bg-primary/10 font-bold text-[10px] text-primary uppercase transition-all"
											>
												{option.label}
											</Badge>
										))}
									</div>
								)}
							</>
						),
					}}
				/>

				<Tabs className="ltr:ms-auto rtl:me-auto" value={view} onValueChange={onViewChange}>
					<TabsList className="h-11 rounded-xl border border-border bg-slate-50 p-1">
						<TabsTrigger
							value="grid"
							className="tap-active rounded-lg px-4 font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md"
						>
							<GridFourIcon weight="duotone" className="size-4" />
							<Trans>Grid</Trans>
						</TabsTrigger>

						<TabsTrigger
							value="list"
							className="tap-active rounded-lg px-4 font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md"
						>
							<ListIcon weight="duotone" className="size-4" />
							<Trans>List</Trans>
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			{view === "list" ? <ListView resumes={resumes ?? []} /> : <GridView resumes={resumes ?? []} />}
		</div>
	);
}

const RESUMES_VIEW_COOKIE_NAME = "resumes_view";

const viewSchema = z.enum(["grid", "list"]).catch("grid");

const setViewServerFn = createServerFn({ method: "POST" })
	.inputValidator(viewSchema)
	.handler(async ({ data }) => {
		setCookie(RESUMES_VIEW_COOKIE_NAME, JSON.stringify(data));
	});

const getViewServerFn = createServerFn({ method: "GET" }).handler(async () => {
	const view = getCookie(RESUMES_VIEW_COOKIE_NAME);
	if (!view) return "grid";
	return viewSchema.parse(JSON.parse(view));
});
