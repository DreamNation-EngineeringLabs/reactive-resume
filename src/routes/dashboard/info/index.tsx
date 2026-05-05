import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
	BookOpenIcon,
	BriefcaseIcon,
	CertificateIcon,
	ChatCircleIcon,
	CodeIcon,
	FloppyDiskIcon,
	GlobeIcon,
	GraduationCapIcon,
	HandshakeIcon,
	HeartIcon,
	LightbulbIcon,
	PlusIcon,
	TrashIcon,
	TrophyIcon,
	UserCircleIcon,
	UsersIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useFieldArray, useForm, useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { RichInput } from "@/components/input/rich-input";
import { URLInput } from "@/components/input/url-input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { orpc } from "@/integrations/orpc/client";
import { defaultUserInfoData, type UserInfoData, userInfoDataSchema } from "@/schema/resume/user-info";
import { generateId } from "@/utils/string";
import { cn } from "@/utils/style";

export const Route = createFileRoute("/dashboard/info/")({
	component: RouteComponent,
});

function RouteComponent() {
	const queryClient = useQueryClient();
	const { data: userInfo, isLoading } = useQuery(orpc.userInfo.get.queryOptions());

	const { mutate: saveInfo, isPending } = useMutation(
		orpc.userInfo.upsert.mutationOptions({
			onSuccess: () => {
				toast.success(t`Your info has been saved successfully.`);
				queryClient.invalidateQueries({ queryKey: orpc.userInfo.get.queryOptions().queryKey });
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	const form = useForm<UserInfoData>({
		resolver: zodResolver(userInfoDataSchema),
		defaultValues: defaultUserInfoData,
	});

	// Reset form when data loads
	useEffect(() => {
		if (userInfo) {
			form.reset(userInfo);
		}
	}, [userInfo, form]);

	const onSubmit = (data: UserInfoData) => {
		saveInfo(data);
	};

	if (isLoading) {
		return (
			<div className="-m-10 md:-m-12 min-h-full bg-slate-50 p-10 md:p-12">
				<div className="space-y-6">
					<MasterProfileHeader isPending={false} onSave={() => undefined} />
					<div className="flex items-center justify-center py-12">
						<p className="text-slate-400 text-sm">Loading...</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="-m-10 md:-m-12 min-h-full bg-slate-50 p-10 md:p-12">
			<div className="space-y-6">
				<MasterProfileHeader isPending={isPending} onSave={form.handleSubmit(onSubmit)} />

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
						<Accordion type="multiple" defaultValue={["basics"]} className="space-y-4">
							<BasicsSection />
							<SummarySection />
							<ProfilesSection />
							<ExperienceSection />
							<EducationSection />
							<ProjectsSection />
							<SkillsSection />
							<LanguagesSection />
							<InterestsSection />
							<AwardsSection />
							<CertificationsSection />
							<PublicationsSection />
							<VolunteerSection />
							<ReferencesSection />
						</Accordion>
					</form>
				</Form>
				<div className="h-50"></div>
			</div>
		</div>
	);
}

// ─── Master Profile Header ────────────────────────────────────────────────────

function MasterProfileHeader({ isPending, onSave }: { isPending: boolean; onSave: () => void }) {
	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div className="max-w-xl">
				<h1 className="font-black text-3xl text-slate-900 tracking-tight">
					<Trans>Master Profile</Trans>
				</h1>
				<p className="mt-1 font-medium text-slate-500 text-sm">
					<Trans>Manage your core professional data to pre-fill future resumes and applications securely.</Trans>
				</p>
			</div>
			<Button onClick={onSave} disabled={isPending} size="lg" className="shrink-0">
				<FloppyDiskIcon weight="duotone" className="size-4" />
				<Trans>Save Changes</Trans>
			</Button>
		</div>
	);
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

type SectionWrapperProps = {
	value: string;
	icon: React.ReactNode;
	title: string;
	count?: number;
	children: React.ReactNode;
};

const FIELD_OVERRIDES = [
	// Tiny uppercase labels with tight spacing to input
	"[&_label]:mb-0 [&_label]:font-semibold [&_label]:text-[10.5px] [&_label]:text-slate-500 [&_label]:uppercase [&_label]:tracking-widest",
	// Standalone Input (data-slot="input") — filled grey, no border
	"**:data-[slot=input]:h-11 **:data-[slot=input]:rounded-lg **:data-[slot=input]:border-transparent **:data-[slot=input]:bg-slate-100 **:data-[slot=input]:font-medium **:data-[slot=input]:text-slate-900 **:data-[slot=input]:shadow-none",
	"**:data-[slot=input]:hover:bg-slate-100/80",
	"**:data-[slot=input]:focus-visible:bg-white **:data-[slot=input]:focus-visible:ring-2 **:data-[slot=input]:focus-visible:ring-primary/20",
	// Standalone Textarea
	"[&_textarea]:rounded-lg [&_textarea]:border-transparent [&_textarea]:bg-slate-100 [&_textarea]:font-medium [&_textarea]:text-slate-900 [&_textarea]:shadow-none",
	"[&_textarea:hover]:bg-slate-100/80",
	"[&_textarea:focus-visible]:bg-white [&_textarea:focus-visible]:ring-2 [&_textarea:focus-visible]:ring-primary/20",
	// URLInput wrapper (InputGroup) — becomes the filled container; its inner input stays transparent (default)
	"**:data-[slot=input-group]:h-11 **:data-[slot=input-group]:rounded-lg **:data-[slot=input-group]:border-transparent **:data-[slot=input-group]:bg-slate-100 **:data-[slot=input-group]:shadow-none",
	"**:data-[slot=input-group]:focus-within:bg-white **:data-[slot=input-group]:focus-within:ring-2 **:data-[slot=input-group]:focus-within:ring-primary/20",
].join(" ");

function SectionWrapper({ value, icon, title, count, children }: SectionWrapperProps) {
	return (
		<AccordionItem
			value={value}
			className="rounded-2xl border border-slate-200/60 bg-white px-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.03)] transition-shadow hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]"
		>
			<AccordionTrigger className="py-5 hover:no-underline">
				<div className="flex items-center gap-x-3">
					<div className="flex size-7 shrink-0 items-center justify-center text-primary">{icon}</div>
					<span className="font-bold text-base text-slate-900">{title}</span>
					{count !== undefined && count > 0 && (
						<span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-[10px] text-primary uppercase tracking-wider">
							{count}
						</span>
					)}
				</div>
			</AccordionTrigger>
			<AccordionContent className={cn("pb-6", FIELD_OVERRIDES)}>{children}</AccordionContent>
		</AccordionItem>
	);
}

// ─── Basics Section ───────────────────────────────────────────────────────────

function BasicsSection() {
	const form = useFormContext<UserInfoData>();

	return (
		<SectionWrapper value="basics" icon={<UserCircleIcon className="size-5" />} title={t`Basics`}>
			<div className="grid gap-4 sm:grid-cols-2">
				<FormField
					control={form.control}
					name="basics.name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								<Trans>Full Name</Trans>
							</FormLabel>
							<FormControl>
								<Input placeholder={t`John Doe`} {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="basics.headline"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								<Trans>Headline</Trans>
							</FormLabel>
							<FormControl>
								<Input placeholder={t`Software Engineer`} {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="basics.email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								<Trans>Email</Trans>
							</FormLabel>
							<FormControl>
								<Input type="email" placeholder="john@example.com" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="basics.phone"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								<Trans>Phone</Trans>
							</FormLabel>
							<FormControl>
								<Input placeholder="+1 234 567 8900" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="basics.location"
					render={({ field }) => (
						<FormItem className="sm:col-span-2">
							<FormLabel>
								<Trans>Location</Trans>
							</FormLabel>
							<FormControl>
								<Input placeholder={t`San Francisco, CA`} {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="basics.website"
					render={({ field }) => (
						<FormItem className="sm:col-span-2">
							<FormLabel>
								<Trans>Website</Trans>
							</FormLabel>
							<FormControl>
								<URLInput value={field.value} onChange={field.onChange} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
			</div>
		</SectionWrapper>
	);
}

// ─── Summary Section ──────────────────────────────────────────────────────────

function SummarySection() {
	const form = useFormContext<UserInfoData>();
	const summary = form.watch("summary") ?? "";
	const charCount = summary.replace(/<[^>]*>/g, "").length;

	return (
		<SectionWrapper value="summary" icon={<ChatCircleIcon className="size-5" />} title={t`Professional Summary`}>
			<FormField
				control={form.control}
				name="summary"
				render={({ field }) => (
					<FormItem>
						<FormControl>
							<RichInput value={field.value} onChange={field.onChange} />
						</FormControl>
						<div className="flex justify-end pt-1">
							<span className="text-[11px] text-slate-400 tabular-nums">
								{charCount} <Trans>characters</Trans>
							</span>
						</div>
						<FormMessage />
					</FormItem>
				)}
			/>
		</SectionWrapper>
	);
}

// ─── Profiles Section ─────────────────────────────────────────────────────────

function ProfilesSection() {
	const form = useFormContext<UserInfoData>();
	const { fields, append, remove } = useFieldArray({ control: form.control, name: "profiles" });

	return (
		<SectionWrapper value="profiles" icon={<GlobeIcon className="size-5" />} title={t`Profiles`} count={fields.length}>
			<div className="space-y-4">
				{fields.map((field, index) => (
					<div
						key={field.id}
						className="group relative space-y-3 border-slate-100 border-b pb-5 last:border-0 last:pb-0"
					>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="-top-1 absolute right-0 z-10 size-7 bg-white text-slate-400 opacity-0 shadow-sm transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus-visible:opacity-100"
							onClick={() => remove(index)}
						>
							<TrashIcon className="size-4" />
						</Button>
						<div className="grid gap-3 sm:grid-cols-2">
							<FormField
								control={form.control}
								name={`profiles.${index}.network`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Network</Trans>
										</FormLabel>
										<FormControl>
											<Input placeholder={t`LinkedIn`} {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`profiles.${index}.username`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Username</Trans>
										</FormLabel>
										<FormControl>
											<Input placeholder={t`johndoe`} {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`profiles.${index}.website`}
								render={({ field }) => (
									<FormItem className="sm:col-span-2">
										<FormLabel>
											<Trans>URL</Trans>
										</FormLabel>
										<FormControl>
											<URLInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</div>
				))}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-auto justify-start p-0 font-semibold text-primary hover:bg-transparent hover:text-primary/80"
					onClick={() =>
						append({
							id: generateId(),
							hidden: false,
							options: { showLinkInTitle: false },
							icon: "",
							network: "",
							username: "",
							website: { url: "", label: "" },
						})
					}
				>
					<PlusIcon className="mr-1" />
					<Trans>Add Profile</Trans>
				</Button>
			</div>
		</SectionWrapper>
	);
}

// ─── Experience Section ───────────────────────────────────────────────────────

function ExperienceSection() {
	const form = useFormContext<UserInfoData>();
	const { fields, append, remove } = useFieldArray({ control: form.control, name: "experience" });

	return (
		<SectionWrapper
			value="experience"
			icon={<BriefcaseIcon className="size-5" />}
			title={t`Experience`}
			count={fields.length}
		>
			<div className="space-y-4">
				{fields.map((field, index) => (
					<div
						key={field.id}
						className="group relative space-y-3 border-slate-100 border-b pb-5 last:border-0 last:pb-0"
					>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="-top-1 absolute right-0 z-10 size-7 bg-white text-slate-400 opacity-0 shadow-sm transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus-visible:opacity-100"
							onClick={() => remove(index)}
						>
							<TrashIcon className="size-4" />
						</Button>
						<div className="grid gap-3 sm:grid-cols-2">
							<FormField
								control={form.control}
								name={`experience.${index}.company`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Company</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`experience.${index}.position`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Position</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`experience.${index}.location`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Location</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`experience.${index}.period`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Period</Trans>
										</FormLabel>
										<FormControl>
											<Input placeholder={t`Jan 2020 – Present`} {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`experience.${index}.website`}
								render={({ field }) => (
									<FormItem className="sm:col-span-2">
										<FormLabel>
											<Trans>Website</Trans>
										</FormLabel>
										<FormControl>
											<URLInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`experience.${index}.description`}
								render={({ field }) => (
									<FormItem className="sm:col-span-2">
										<FormLabel>
											<Trans>Description</Trans>
										</FormLabel>
										<FormControl>
											<RichInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</div>
				))}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-auto justify-start p-0 font-semibold text-primary hover:bg-transparent hover:text-primary/80"
					onClick={() =>
						append({
							id: generateId(),
							hidden: false,
							options: { showLinkInTitle: false },
							company: "",
							position: "",
							location: "",
							period: "",
							website: { url: "", label: "" },
							description: "",
						})
					}
				>
					<PlusIcon className="mr-1" />
					<Trans>Add Experience</Trans>
				</Button>
			</div>
		</SectionWrapper>
	);
}

// ─── Education Section ────────────────────────────────────────────────────────

function EducationSection() {
	const form = useFormContext<UserInfoData>();
	const { fields, append, remove } = useFieldArray({ control: form.control, name: "education" });

	return (
		<SectionWrapper
			value="education"
			icon={<GraduationCapIcon className="size-5" />}
			title={t`Education`}
			count={fields.length}
		>
			<div className="space-y-4">
				{fields.map((field, index) => (
					<div
						key={field.id}
						className="group relative space-y-3 border-slate-100 border-b pb-5 last:border-0 last:pb-0"
					>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="-top-1 absolute right-0 z-10 size-7 bg-white text-slate-400 opacity-0 shadow-sm transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus-visible:opacity-100"
							onClick={() => remove(index)}
						>
							<TrashIcon className="size-4" />
						</Button>
						<div className="grid gap-3 sm:grid-cols-2">
							<FormField
								control={form.control}
								name={`education.${index}.school`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>School</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`education.${index}.degree`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Degree</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`education.${index}.area`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Area of Study</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`education.${index}.grade`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Grade</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`education.${index}.location`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Location</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`education.${index}.period`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Period</Trans>
										</FormLabel>
										<FormControl>
											<Input placeholder={t`2018 – 2022`} {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`education.${index}.website`}
								render={({ field }) => (
									<FormItem className="sm:col-span-2">
										<FormLabel>
											<Trans>Website</Trans>
										</FormLabel>
										<FormControl>
											<URLInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`education.${index}.description`}
								render={({ field }) => (
									<FormItem className="sm:col-span-2">
										<FormLabel>
											<Trans>Description</Trans>
										</FormLabel>
										<FormControl>
											<RichInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</div>
				))}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-auto justify-start p-0 font-semibold text-primary hover:bg-transparent hover:text-primary/80"
					onClick={() =>
						append({
							id: generateId(),
							hidden: false,
							options: { showLinkInTitle: false },
							school: "",
							degree: "",
							area: "",
							grade: "",
							location: "",
							period: "",
							website: { url: "", label: "" },
							description: "",
						})
					}
				>
					<PlusIcon className="mr-1" />
					<Trans>Add Education</Trans>
				</Button>
			</div>
		</SectionWrapper>
	);
}

// ─── Projects Section ─────────────────────────────────────────────────────────

function ProjectsSection() {
	const form = useFormContext<UserInfoData>();
	const { fields, append, remove } = useFieldArray({ control: form.control, name: "projects" });

	return (
		<SectionWrapper value="projects" icon={<CodeIcon className="size-5" />} title={t`Projects`} count={fields.length}>
			<div className="space-y-4">
				{fields.map((field, index) => (
					<div
						key={field.id}
						className="group relative space-y-3 border-slate-100 border-b pb-5 last:border-0 last:pb-0"
					>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="-top-1 absolute right-0 z-10 size-7 bg-white text-slate-400 opacity-0 shadow-sm transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus-visible:opacity-100"
							onClick={() => remove(index)}
						>
							<TrashIcon className="size-4" />
						</Button>
						<div className="grid gap-3 sm:grid-cols-2">
							<FormField
								control={form.control}
								name={`projects.${index}.name`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Name</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`projects.${index}.period`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Period</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`projects.${index}.website`}
								render={({ field }) => (
									<FormItem className="sm:col-span-2">
										<FormLabel>
											<Trans>Website</Trans>
										</FormLabel>
										<FormControl>
											<URLInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`projects.${index}.description`}
								render={({ field }) => (
									<FormItem className="sm:col-span-2">
										<FormLabel>
											<Trans>Description</Trans>
										</FormLabel>
										<FormControl>
											<RichInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</div>
				))}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-auto justify-start p-0 font-semibold text-primary hover:bg-transparent hover:text-primary/80"
					onClick={() =>
						append({
							id: generateId(),
							hidden: false,
							options: { showLinkInTitle: false },
							name: "",
							period: "",
							website: { url: "", label: "" },
							description: "",
						})
					}
				>
					<PlusIcon className="mr-1" />
					<Trans>Add Project</Trans>
				</Button>
			</div>
		</SectionWrapper>
	);
}

// ─── Skills Section ───────────────────────────────────────────────────────────

function SkillsSection() {
	const form = useFormContext<UserInfoData>();
	const { fields, append, remove } = useFieldArray({ control: form.control, name: "skills" });

	return (
		<SectionWrapper value="skills" icon={<LightbulbIcon className="size-5" />} title={t`Skills`} count={fields.length}>
			<div className="space-y-4">
				{fields.map((field, index) => (
					<div
						key={field.id}
						className="group relative space-y-3 border-slate-100 border-b pb-5 last:border-0 last:pb-0"
					>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="-top-1 absolute right-0 z-10 size-7 bg-white text-slate-400 opacity-0 shadow-sm transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus-visible:opacity-100"
							onClick={() => remove(index)}
						>
							<TrashIcon className="size-4" />
						</Button>
						<div className="grid gap-3 sm:grid-cols-2">
							<FormField
								control={form.control}
								name={`skills.${index}.name`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Skill Name</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`skills.${index}.proficiency`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Proficiency</Trans>
										</FormLabel>
										<FormControl>
											<Input placeholder={t`Advanced`} {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</div>
				))}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-auto justify-start p-0 font-semibold text-primary hover:bg-transparent hover:text-primary/80"
					onClick={() =>
						append({
							id: generateId(),
							hidden: false,
							options: { showLinkInTitle: false },
							icon: "",
							name: "",
							proficiency: "",
							level: 0,
							keywords: [],
						})
					}
				>
					<PlusIcon className="mr-1" />
					<Trans>Add Skill</Trans>
				</Button>
			</div>
		</SectionWrapper>
	);
}

// ─── Languages Section ────────────────────────────────────────────────────────

function LanguagesSection() {
	const form = useFormContext<UserInfoData>();
	const { fields, append, remove } = useFieldArray({ control: form.control, name: "languages" });

	return (
		<SectionWrapper
			value="languages"
			icon={<GlobeIcon className="size-5" />}
			title={t`Languages`}
			count={fields.length}
		>
			<div className="space-y-4">
				{fields.map((field, index) => (
					<div
						key={field.id}
						className="group relative space-y-3 border-slate-100 border-b pb-5 last:border-0 last:pb-0"
					>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="-top-1 absolute right-0 z-10 size-7 bg-white text-slate-400 opacity-0 shadow-sm transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus-visible:opacity-100"
							onClick={() => remove(index)}
						>
							<TrashIcon className="size-4" />
						</Button>
						<div className="grid gap-3 sm:grid-cols-2">
							<FormField
								control={form.control}
								name={`languages.${index}.language`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Language</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`languages.${index}.fluency`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Fluency</Trans>
										</FormLabel>
										<FormControl>
											<Input placeholder={t`Native, Fluent, etc.`} {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</div>
				))}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-auto justify-start p-0 font-semibold text-primary hover:bg-transparent hover:text-primary/80"
					onClick={() =>
						append({
							id: generateId(),
							hidden: false,
							options: { showLinkInTitle: false },
							language: "",
							fluency: "",
							level: 0,
						})
					}
				>
					<PlusIcon className="mr-1" />
					<Trans>Add Language</Trans>
				</Button>
			</div>
		</SectionWrapper>
	);
}

// ─── Interests Section ────────────────────────────────────────────────────────

function InterestsSection() {
	const form = useFormContext<UserInfoData>();
	const { fields, append, remove } = useFieldArray({ control: form.control, name: "interests" });

	return (
		<SectionWrapper
			value="interests"
			icon={<HeartIcon className="size-5" />}
			title={t`Interests`}
			count={fields.length}
		>
			<div className="space-y-4">
				{fields.map((field, index) => (
					<div
						key={field.id}
						className="group relative space-y-3 border-slate-100 border-b pb-5 last:border-0 last:pb-0"
					>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="-top-1 absolute right-0 z-10 size-7 bg-white text-slate-400 opacity-0 shadow-sm transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus-visible:opacity-100"
							onClick={() => remove(index)}
						>
							<TrashIcon className="size-4" />
						</Button>
						<FormField
							control={form.control}
							name={`interests.${index}.name`}
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										<Trans>Interest</Trans>
									</FormLabel>
									<FormControl>
										<Input {...field} />
									</FormControl>
								</FormItem>
							)}
						/>
					</div>
				))}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-auto justify-start p-0 font-semibold text-primary hover:bg-transparent hover:text-primary/80"
					onClick={() =>
						append({
							id: generateId(),
							hidden: false,
							options: { showLinkInTitle: false },
							icon: "",
							name: "",
							keywords: [],
						})
					}
				>
					<PlusIcon className="mr-1" />
					<Trans>Add Interest</Trans>
				</Button>
			</div>
		</SectionWrapper>
	);
}

// ─── Awards Section ───────────────────────────────────────────────────────────

function AwardsSection() {
	const form = useFormContext<UserInfoData>();
	const { fields, append, remove } = useFieldArray({ control: form.control, name: "awards" });

	return (
		<SectionWrapper
			value="awards"
			icon={<TrophyIcon className="size-5" />}
			title={t`Achievements`}
			count={fields.length}
		>
			<div className="space-y-4">
				{fields.map((field, index) => (
					<div
						key={field.id}
						className="group relative space-y-3 border-slate-100 border-b pb-5 last:border-0 last:pb-0"
					>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="-top-1 absolute right-0 z-10 size-7 bg-white text-slate-400 opacity-0 shadow-sm transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus-visible:opacity-100"
							onClick={() => remove(index)}
						>
							<TrashIcon className="size-4" />
						</Button>
						<div className="grid gap-3 sm:grid-cols-2">
							<FormField
								control={form.control}
								name={`awards.${index}.title`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Title</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`awards.${index}.awarder`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Awarder</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`awards.${index}.date`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Date</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`awards.${index}.website`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Website</Trans>
										</FormLabel>
										<FormControl>
											<URLInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`awards.${index}.description`}
								render={({ field }) => (
									<FormItem className="sm:col-span-2">
										<FormLabel>
											<Trans>Description</Trans>
										</FormLabel>
										<FormControl>
											<RichInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</div>
				))}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-auto justify-start p-0 font-semibold text-primary hover:bg-transparent hover:text-primary/80"
					onClick={() =>
						append({
							id: generateId(),
							hidden: false,
							options: { showLinkInTitle: false },
							title: "",
							awarder: "",
							date: "",
							website: { url: "", label: "" },
							description: "",
						})
					}
				>
					<PlusIcon className="mr-1" />
					<Trans>Add Achievement</Trans>
				</Button>
			</div>
		</SectionWrapper>
	);
}

// ─── Certifications Section ───────────────────────────────────────────────────

function CertificationsSection() {
	const form = useFormContext<UserInfoData>();
	const { fields, append, remove } = useFieldArray({ control: form.control, name: "certifications" });

	return (
		<SectionWrapper
			value="certifications"
			icon={<CertificateIcon className="size-5" />}
			title={t`Certifications`}
			count={fields.length}
		>
			<div className="space-y-4">
				{fields.map((field, index) => (
					<div
						key={field.id}
						className="group relative space-y-3 border-slate-100 border-b pb-5 last:border-0 last:pb-0"
					>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="-top-1 absolute right-0 z-10 size-7 bg-white text-slate-400 opacity-0 shadow-sm transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus-visible:opacity-100"
							onClick={() => remove(index)}
						>
							<TrashIcon className="size-4" />
						</Button>
						<div className="grid gap-3 sm:grid-cols-2">
							<FormField
								control={form.control}
								name={`certifications.${index}.title`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Title</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`certifications.${index}.issuer`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Issuer</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`certifications.${index}.date`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Date</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`certifications.${index}.website`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Website</Trans>
										</FormLabel>
										<FormControl>
											<URLInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`certifications.${index}.description`}
								render={({ field }) => (
									<FormItem className="sm:col-span-2">
										<FormLabel>
											<Trans>Description</Trans>
										</FormLabel>
										<FormControl>
											<RichInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</div>
				))}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-auto justify-start p-0 font-semibold text-primary hover:bg-transparent hover:text-primary/80"
					onClick={() =>
						append({
							id: generateId(),
							hidden: false,
							options: { showLinkInTitle: false },
							title: "",
							issuer: "",
							date: "",
							website: { url: "", label: "" },
							description: "",
						})
					}
				>
					<PlusIcon className="mr-1" />
					<Trans>Add Certification</Trans>
				</Button>
			</div>
		</SectionWrapper>
	);
}

// ─── Publications Section ─────────────────────────────────────────────────────

function PublicationsSection() {
	const form = useFormContext<UserInfoData>();
	const { fields, append, remove } = useFieldArray({ control: form.control, name: "publications" });

	return (
		<SectionWrapper
			value="publications"
			icon={<BookOpenIcon className="size-5" />}
			title={t`Publications`}
			count={fields.length}
		>
			<div className="space-y-4">
				{fields.map((field, index) => (
					<div
						key={field.id}
						className="group relative space-y-3 border-slate-100 border-b pb-5 last:border-0 last:pb-0"
					>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="-top-1 absolute right-0 z-10 size-7 bg-white text-slate-400 opacity-0 shadow-sm transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus-visible:opacity-100"
							onClick={() => remove(index)}
						>
							<TrashIcon className="size-4" />
						</Button>
						<div className="grid gap-3 sm:grid-cols-2">
							<FormField
								control={form.control}
								name={`publications.${index}.title`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Title</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`publications.${index}.publisher`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Publisher</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`publications.${index}.date`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Date</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`publications.${index}.website`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Website</Trans>
										</FormLabel>
										<FormControl>
											<URLInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`publications.${index}.description`}
								render={({ field }) => (
									<FormItem className="sm:col-span-2">
										<FormLabel>
											<Trans>Description</Trans>
										</FormLabel>
										<FormControl>
											<RichInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</div>
				))}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-auto justify-start p-0 font-semibold text-primary hover:bg-transparent hover:text-primary/80"
					onClick={() =>
						append({
							id: generateId(),
							hidden: false,
							options: { showLinkInTitle: false },
							title: "",
							publisher: "",
							date: "",
							website: { url: "", label: "" },
							description: "",
						})
					}
				>
					<PlusIcon className="mr-1" />
					<Trans>Add Publication</Trans>
				</Button>
			</div>
		</SectionWrapper>
	);
}

// ─── Volunteer Section ────────────────────────────────────────────────────────

function VolunteerSection() {
	const form = useFormContext<UserInfoData>();
	const { fields, append, remove } = useFieldArray({ control: form.control, name: "volunteer" });

	return (
		<SectionWrapper
			value="volunteer"
			icon={<HandshakeIcon className="size-5" />}
			title={t`Volunteer Experience`}
			count={fields.length}
		>
			<div className="space-y-4">
				{fields.map((field, index) => (
					<div
						key={field.id}
						className="group relative space-y-3 border-slate-100 border-b pb-5 last:border-0 last:pb-0"
					>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="-top-1 absolute right-0 z-10 size-7 bg-white text-slate-400 opacity-0 shadow-sm transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus-visible:opacity-100"
							onClick={() => remove(index)}
						>
							<TrashIcon className="size-4" />
						</Button>
						<div className="grid gap-3 sm:grid-cols-2">
							<FormField
								control={form.control}
								name={`volunteer.${index}.organization`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Organization</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`volunteer.${index}.location`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Location</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`volunteer.${index}.period`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Period</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`volunteer.${index}.website`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Website</Trans>
										</FormLabel>
										<FormControl>
											<URLInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`volunteer.${index}.description`}
								render={({ field }) => (
									<FormItem className="sm:col-span-2">
										<FormLabel>
											<Trans>Description</Trans>
										</FormLabel>
										<FormControl>
											<RichInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</div>
				))}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-auto justify-start p-0 font-semibold text-primary hover:bg-transparent hover:text-primary/80"
					onClick={() =>
						append({
							id: generateId(),
							hidden: false,
							options: { showLinkInTitle: false },
							organization: "",
							location: "",
							period: "",
							website: { url: "", label: "" },
							description: "",
						})
					}
				>
					<PlusIcon className="mr-1" />
					<Trans>Add Volunteer Experience</Trans>
				</Button>
			</div>
		</SectionWrapper>
	);
}

// ─── References Section ───────────────────────────────────────────────────────

function ReferencesSection() {
	const form = useFormContext<UserInfoData>();
	const { fields, append, remove } = useFieldArray({ control: form.control, name: "references" });

	return (
		<SectionWrapper
			value="references"
			icon={<UsersIcon className="size-5" />}
			title={t`References`}
			count={fields.length}
		>
			<div className="space-y-4">
				{fields.map((field, index) => (
					<div
						key={field.id}
						className="group relative space-y-3 border-slate-100 border-b pb-5 last:border-0 last:pb-0"
					>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="-top-1 absolute right-0 z-10 size-7 bg-white text-slate-400 opacity-0 shadow-sm transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus-visible:opacity-100"
							onClick={() => remove(index)}
						>
							<TrashIcon className="size-4" />
						</Button>
						<div className="grid gap-3 sm:grid-cols-2">
							<FormField
								control={form.control}
								name={`references.${index}.name`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Name</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`references.${index}.position`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Position</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`references.${index}.phone`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Phone</Trans>
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`references.${index}.website`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<Trans>Website</Trans>
										</FormLabel>
										<FormControl>
											<URLInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`references.${index}.description`}
								render={({ field }) => (
									<FormItem className="sm:col-span-2">
										<FormLabel>
											<Trans>Description</Trans>
										</FormLabel>
										<FormControl>
											<RichInput value={field.value} onChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</div>
				))}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-auto justify-start p-0 font-semibold text-primary hover:bg-transparent hover:text-primary/80"
					onClick={() =>
						append({
							id: generateId(),
							hidden: false,
							options: { showLinkInTitle: false },
							name: "",
							position: "",
							phone: "",
							website: { url: "", label: "" },
							description: "",
						})
					}
				>
					<PlusIcon className="mr-1" />
					<Trans>Add Reference</Trans>
				</Button>
			</div>
		</SectionWrapper>
	);
}
