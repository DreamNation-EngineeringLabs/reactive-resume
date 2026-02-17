import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { DownloadSimpleIcon, FileIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useFormBlocker } from "@/hooks/use-form-blocker";
import { JSONResumeImporter } from "@/integrations/import/json-resume";
import { ReactiveResumeJSONImporter } from "@/integrations/import/reactive-resume-json";
import { ReactiveResumeV4JSONImporter } from "@/integrations/import/reactive-resume-v4-json";
import { client, orpc } from "@/integrations/orpc/client";
import type { ResumeData } from "@/schema/resume/data";
import { cn } from "@/utils/style";
import { type DialogProps, useDialogStore } from "../store";

const formSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("") }),
	z.object({
		type: z.literal("pdf"),
		file: z.instanceof(File).refine((file) => file.type === "application/pdf", { message: "File must be a PDF" }),
	}),
	z.object({
		type: z.literal("docx"),
		file: z
			.instanceof(File)
			.refine(
				(file) =>
					file.type === "application/msword" ||
					file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				{ message: "File must be a Microsoft Word document" },
			),
	}),
	z.object({
		type: z.literal("reactive-resume-json"),
		file: z
			.instanceof(File)
			.refine((file) => file.type === "application/json", { message: "File must be a JSON file" }),
	}),
	z.object({
		type: z.literal("reactive-resume-v4-json"),
		file: z
			.instanceof(File)
			.refine((file) => file.type === "application/json", { message: "File must be a JSON file" }),
	}),
	z.object({
		type: z.literal("json-resume-json"),
		file: z
			.instanceof(File)
			.refine((file) => file.type === "application/json", { message: "File must be a JSON file" }),
	}),
]);

type FormValues = z.infer<typeof formSchema>;

export function ImportResumeDialog(_: DialogProps<"resume.import">) {
	const closeDialog = useDialogStore((state) => state.closeDialog);

	const prevTypeRef = useRef<string>("");
	const inputRef = useRef<HTMLInputElement>(null);
	const [isLoading, setIsLoading] = useState<boolean>(false);

	const { mutateAsync: importResume } = useMutation(orpc.resume.import.mutationOptions());

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			type: "",
		},
	});

	const type = useWatch({ control: form.control, name: "type" });

	useEffect(() => {
		if (prevTypeRef.current === type) return;
		prevTypeRef.current = type;
		form.resetField("file");
	}, [form.resetField, type]);

	const onSelectFile = () => {
		if (!inputRef.current) return;
		inputRef.current.click();
	};

	const onUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		form.setValue("file", file, { shouldDirty: true });
	};

	const { blockEvents } = useFormBlocker(form);

	// Helper function to convert ArrayBuffer to base64 for large files
	const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		const chunkSize = 8192; // Process in chunks to avoid stack overflow
		
		for (let i = 0; i < bytes.length; i += chunkSize) {
			const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
			binary += String.fromCharCode(...chunk);
		}
		
		return btoa(binary);
	};

	const onSubmit = async (values: FormValues) => {
		if (values.type === "") return;

		setIsLoading(true);

		const toastId = toast.loading(t`Importing your resume...`, {
			description: t`This may take a few minutes, depending on the response of the AI provider. Please do not close the window or refresh the page.`,
		});

		try {
			let data: ResumeData | undefined;

			if (values.type === "json-resume-json") {
				const json = await values.file.text();
				const importer = new JSONResumeImporter();
				data = importer.parse(json);
			}

			if (values.type === "reactive-resume-json") {
				const json = await values.file.text();
				const importer = new ReactiveResumeJSONImporter();
				data = importer.parse(json);
			}

			if (values.type === "reactive-resume-v4-json") {
				const json = await values.file.text();
				const importer = new ReactiveResumeV4JSONImporter();
				data = importer.parse(json);
			}

			if (values.type === "pdf") {
			console.log("[Import] Step 1: Converting PDF to base64");
			try {
				const arrayBuffer = await values.file.arrayBuffer();
				console.log("[Import] Step 1.5: Got arrayBuffer, length:", arrayBuffer.byteLength);
				const base64 = arrayBufferToBase64(arrayBuffer);
				console.log("[Import] Step 3: About to call client.ai.parsePdf");
				console.log("[Import] Step 3.1: client object:", client);
				console.log("[Import] Step 3.2: client.ai object:", client.ai);
				console.log("[Import] Step 3.3: client.ai.parsePdf function:", typeof client.ai.parsePdf);
				
				data = await client.ai.parsePdf({
					file: { name: values.file.name, data: base64 },
				});
				console.log("[Import] Step 4: Received data from API");
			} catch (pdfError) {
				console.error("[Import] Error in PDF processing:", pdfError);
				throw pdfError;
			}
		}
			if (values.type === "docx") {
				const arrayBuffer = await values.file.arrayBuffer();
			const base64 = arrayBufferToBase64(arrayBuffer);
				const mediaType =
					values.file.type === "application/msword"
						? ("application/msword" as const)
						: ("application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const);

				data = await client.ai.parseDocx({
					mediaType,
					file: { name: values.file.name, data: base64 },
				});
			}

			if (!data) throw new Error("No data was returned from the AI provider.");

			await importResume({ data });
			toast.success(t`Your resume has been imported successfully.`, { id: toastId, description: null });
			closeDialog();
		} catch (error: unknown) {
			if (error instanceof Error) {
				toast.error(error.message, { id: toastId, description: null });
			} else {
				toast.error(t`An unknown error occurred while importing your resume.`, { id: toastId, description: null });
			}
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<DialogContent {...blockEvents}>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-x-2">
					<DownloadSimpleIcon />
					<Trans>Import an existing resume</Trans>
				</DialogTitle>
				<DialogDescription>
					<Trans>
						Continue where you left off by importing an existing resume. Supported formats include PDF, Microsoft Word, and JSON files. PDF and Word documents are automatically parsed using AI.
					</Trans>
				</DialogDescription>
			</DialogHeader>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<FormField
						control={form.control}
						name="type"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									<Trans>Type</Trans>
								</FormLabel>
								<FormControl>
									<Combobox
										clearable={false}
										value={field.value}
										onValueChange={field.onChange}
										options={[
									{ value: "reactive-resume-json", label: "JSON Format" },
									{ value: "reactive-resume-v4-json", label: "JSON Format (Legacy)" },
											{ value: "json-resume-json", label: "JSON Resume" },
											{ value: "pdf", label: "PDF" },
											{ value: "docx", label: "Microsoft Word" },
										]}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						key={type}
						control={form.control}
						name="file"
						render={({ field }) => (
							<FormItem className={cn(!type && "hidden")}>
								<FormControl>
									<div>
										<Input type="file" className="hidden" ref={inputRef} onChange={onUploadFile} />

										<Button
											variant="outline"
											className="h-auto w-full flex-col border-dashed py-8 font-normal"
											onClick={onSelectFile}
										>
											{field.value ? (
												<>
													<FileIcon weight="thin" size={32} />
													<p>{field.value.name}</p>
												</>
											) : (
												<>
													<UploadSimpleIcon weight="thin" size={32} />
													<Trans>Click here to select a file to import</Trans>
												</>
											)}
										</Button>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<DialogFooter>
						<Button type="submit" disabled={!type || isLoading}>
							{isLoading ? <Spinner /> : null}
							{isLoading ? t`Importing...` : t`Import`}
						</Button>
					</DialogFooter>
				</form>
			</Form>
		</DialogContent>
	);
}
