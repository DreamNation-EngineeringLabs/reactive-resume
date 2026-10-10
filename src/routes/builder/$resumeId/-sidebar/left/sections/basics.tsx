import { zodResolver } from "@hookform/resolvers/zod";
import { Trans } from "@lingui/react/macro";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import type z from "zod";
import { URLInput } from "@/components/input/url-input";
import { useResumeStore } from "@/components/resume/store/resume";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { basicsSchema } from "@/schema/resume/data";
import { SectionBase } from "../shared/section-base";
import { CustomFieldsSection } from "./custom-fields";

export function BasicsSectionBuilder() {
	return (
		<SectionBase type="basics">
			<BasicsSectionForm />
		</SectionBase>
	);
}

const formSchema = basicsSchema;

type FormValues = z.infer<typeof formSchema>;

function BasicsSectionForm() {
	const basics = useResumeStore((state) => state.resume.data.basics);
	const updateResumeData = useResumeStore((state) => state.updateResumeData);

	const form = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: basics,
		mode: "onChange",
	});

	// Every change below writes the whole form back, so changes made elsewhere (undo/redo, an applied
	// reviewer suggestion) must be loaded into the form first or the next keystroke would undo them.
	// Our own writes are skipped, so a save that lags behind fast typing never resets the input.
	const lastWritten = useRef(basics);
	useEffect(() => {
		if (JSON.stringify(basics) !== JSON.stringify(lastWritten.current)) {
			lastWritten.current = basics;
			form.reset(basics);
		}
	}, [basics, form]);

	const onSubmit = (data: FormValues) => {
		lastWritten.current = data;
		updateResumeData((draft) => {
			draft.basics = data;
		});
	};

	return (
		<Form {...form}>
			<form onChange={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								<Trans>Name</Trans>
							</FormLabel>
							<FormControl>
								<Input {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="headline"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								<Trans>Headline</Trans>
							</FormLabel>
							<FormControl>
								<Input {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								<Trans>Email</Trans>
							</FormLabel>
							<FormControl>
								<Input type="email" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="phone"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								<Trans>Phone</Trans>
							</FormLabel>
							<FormControl>
								<Input {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="location"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								<Trans>Location</Trans>
							</FormLabel>
							<FormControl>
								<Input {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="website"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								<Trans>Website</Trans>
							</FormLabel>
							<FormControl>
								<URLInput {...field} value={field.value} onChange={field.onChange} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<CustomFieldsSection onSubmit={onSubmit} />
			</form>
		</Form>
	);
}
