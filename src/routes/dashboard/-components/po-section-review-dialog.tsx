import { t } from "@lingui/core/macro";
import {
	MicrophoneIcon,
	PaperPlaneTiltIcon,
	PlayIcon,
	SpinnerIcon,
	StopIcon,
	TrashIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";

type Props = {
	open: boolean;
	onClose: () => void;
	sectionId: string;
	sectionName: string;
	tenantId: string;
	/** Resumes in PO-managed state that belong to this section */
	resumes: Array<{ id: string; studentId: string }>;
	/** When set, dialog is in edit mode — updates this review instead of creating a new one */
	editReviewId?: string;
	initialNotes?: string;
	initialVoiceNoteUrl?: string | null;
	/** Invalidation key so the sections view refreshes after submit */
	onSuccess: () => void;
};

type RecordingState = "idle" | "recording" | "recorded";

export function POSectionReviewDialog({
	open,
	onClose,
	sectionId,
	sectionName,
	tenantId,
	resumes,
	editReviewId,
	initialNotes,
	initialVoiceNoteUrl,
	onSuccess,
}: Props) {
	const queryClient = useQueryClient();
	const isEditMode = !!editReviewId;

	// ── Text notes ────────────────────────────────────────────────────────────
	const [notes, setNotes] = useState("");

	// ── Voice note recording ──────────────────────────────────────────────────
	const [recordingState, setRecordingState] = useState<RecordingState>("idle");
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	// In edit mode, track whether the user wants to keep the existing voice note
	const [keepExistingVoiceNote, setKeepExistingVoiceNote] = useState(true);
	const [recordingSeconds, setRecordingSeconds] = useState(0);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Cleanup object URLs on unmount
	useEffect(() => {
		return () => {
			if (audioUrl) URL.revokeObjectURL(audioUrl);
		};
	}, [audioUrl]);

	// Reset / seed state when dialog opens
	useEffect(() => {
		if (open) {
			setNotes(initialNotes ?? "");
			setRecordingState("idle");
			setAudioBlob(null);
			if (audioUrl) URL.revokeObjectURL(audioUrl);
			setAudioUrl(null);
			setRecordingSeconds(0);
			setKeepExistingVoiceNote(true);
		}
	}, [open]); // eslint-disable-line react-hooks/exhaustive-deps

	const startRecording = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
				? "audio/webm;codecs=opus"
				: "audio/webm";
			const recorder = new MediaRecorder(stream, { mimeType });
			chunksRef.current = [];

			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) chunksRef.current.push(e.data);
			};

			recorder.onstop = () => {
				const blob = new Blob(chunksRef.current, { type: mimeType });
				const url = URL.createObjectURL(blob);
				setAudioBlob(blob);
				setAudioUrl(url);
				setRecordingState("recorded");
				// Stop all tracks to release mic
				stream.getTracks().forEach((t) => t.stop());
			};

			mediaRecorderRef.current = recorder;
			recorder.start();
			setRecordingState("recording");
			setRecordingSeconds(0);

			timerRef.current = setInterval(() => {
				setRecordingSeconds((s) => s + 1);
			}, 1000);
		} catch {
			// Microphone access denied — silently stay in idle
		}
	}, []);

	const stopRecording = useCallback(() => {
		if (timerRef.current) clearInterval(timerRef.current);
		mediaRecorderRef.current?.stop();
	}, []);

	const discardRecording = useCallback(() => {
		if (audioUrl) URL.revokeObjectURL(audioUrl);
		setAudioBlob(null);
		setAudioUrl(null);
		setRecordingState("idle");
		setRecordingSeconds(0);
	}, [audioUrl]);

	// ── Upload voice note ─────────────────────────────────────────────────────
	const uploadMutation = useMutation({
		...orpc.storage.uploadFile.mutationOptions(),
	});

	// ── Create review ─────────────────────────────────────────────────────────
	const reviewMutation = useMutation({
		...orpc.resume.dashboard.poReviewSection.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			onSuccess();
			onClose();
		},
	});

	// ── Update review (edit mode) ─────────────────────────────────────────────
	const updateMutation = useMutation({
		...orpc.resume.dashboard.updatePoSectionReview.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			onSuccess();
			onClose();
		},
	});

	const handleSubmit = async () => {
		if (!notes.trim()) return;

		let voiceNoteUrl: string | undefined | null;

		if (audioBlob) {
			// New recording — upload it
			const file = new File([audioBlob], "voice-note.webm", { type: audioBlob.type });
			const uploaded = await uploadMutation.mutateAsync(file as any);
			voiceNoteUrl = uploaded.url;
		} else if (isEditMode) {
			// In edit mode: keep existing URL if user didn't discard, else null it out
			voiceNoteUrl = keepExistingVoiceNote ? initialVoiceNoteUrl : null;
		}

		if (isEditMode && editReviewId) {
			updateMutation.mutate({
				id: editReviewId,
				reviewNotes: notes.trim(),
				voiceNoteUrl,
			});
		} else {
			reviewMutation.mutate({
				sectionId,
				tenantId,
				reviewNotes: notes.trim(),
				voiceNoteUrl: voiceNoteUrl ?? undefined,
				resumes,
			});
		}
	};

	const isSubmitting = uploadMutation.isPending || reviewMutation.isPending || updateMutation.isPending;
	const canSubmit = notes.trim().length > 0 && !isSubmitting;

	const formatSeconds = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<span>{isEditMode ? t`Edit Feedback: ${sectionName}` : t`Review Section: ${sectionName}`}</span>
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 pt-1">
					{/* Summary — only show for new feedback, not edits */}
					{!isEditMode && (
						<div className="flex items-center gap-2 rounded-xl bg-orange-50 px-4 py-2.5 text-orange-800 text-sm">
							<WarningCircleIcon weight="duotone" className="size-4 shrink-0" />
							<span>
								{t`Sending feedback for`}{" "}
								<strong>
									{resumes.length} {t`resume(s)`}
								</strong>
								{". "}
								{t`They will return to FINALIZED_BY_FACULTY state for faculty to address.`}
							</span>
						</div>
					)}

					{/* Review notes (required) */}
					<div className="space-y-1.5">
						<label className="font-semibold text-slate-700 text-sm">{t`Review Notes`} *</label>
						<Textarea
							placeholder={t`Describe what needs to be improved across this section — e.g. "Most resumes lack quantified metrics in the experience section. Please ensure every bullet uses the XYZ formula with numbers."`}
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							className="min-h-[120px] resize-none text-sm"
						/>
					</div>

					{/* Voice note (optional) */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<label className="font-semibold text-slate-700 text-sm">
								{t`Voice Note`}{" "}
								<span className="font-normal text-slate-400">{t`(optional)`}</span>
							</label>
							{recordingState === "recorded" && audioUrl && (
								<button
									type="button"
									onClick={discardRecording}
									className="flex items-center gap-1 text-rose-500 text-xs hover:text-rose-600"
								>
									<TrashIcon className="size-3" />
									{t`Discard`}
								</button>
							)}
						</div>

						{/* In edit mode — show existing voice note with option to replace or remove */}
						{isEditMode && initialVoiceNoteUrl && keepExistingVoiceNote && recordingState === "idle" && (
							<div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
								<audio src={initialVoiceNoteUrl} controls className="h-8 flex-1" />
								<button
									type="button"
									onClick={() => setKeepExistingVoiceNote(false)}
									className="shrink-0 text-rose-500 text-xs hover:text-rose-600"
								>
									<TrashIcon className="size-3.5" />
								</button>
							</div>
						)}

						{recordingState === "idle" && (!isEditMode || !initialVoiceNoteUrl || !keepExistingVoiceNote) && (
							<button
								type="button"
								onClick={startRecording}
								className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-slate-500 text-sm transition-all hover:border-indigo-300 hover:text-indigo-600"
							>
								<MicrophoneIcon weight="duotone" className="size-4" />
								{isEditMode ? t`Record a new voice note` : t`Click to record a voice note`}
							</button>
						)}

						{recordingState === "recording" && (
							<div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
								<div className="flex items-center gap-2 text-rose-700">
									<span className="inline-block size-2 animate-pulse rounded-full bg-rose-500" />
									<span className="font-mono text-sm">{formatSeconds(recordingSeconds)}</span>
									<span className="text-sm">{t`Recording…`}</span>
								</div>
								<button
									type="button"
									onClick={stopRecording}
									className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-sm text-white hover:bg-rose-700"
								>
									<StopIcon weight="fill" className="size-3.5" />
									{t`Stop`}
								</button>
							</div>
						)}

						{recordingState === "recorded" && audioUrl && (
							<div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
								<PlayIcon weight="duotone" className="size-4 shrink-0 text-indigo-600" />
								<audio src={audioUrl} controls className="h-8 flex-1" />
							</div>
						)}
					</div>

					{/* Actions */}
					<div className="flex justify-end gap-2 pt-2">
						<Button variant="outline" onClick={onClose} disabled={isSubmitting}>
							{t`Cancel`}
						</Button>
						<Button
							onClick={handleSubmit}
							disabled={!canSubmit}
							className={cn(
								"gap-2 bg-orange-600 text-white hover:bg-orange-700",
								isSubmitting && "cursor-not-allowed opacity-70",
							)}
						>
							{isSubmitting ? (
								<SpinnerIcon className="size-4 animate-spin" />
							) : (
								<PaperPlaneTiltIcon weight="duotone" className="size-4" />
							)}
							{isEditMode ? t`Save Changes` : t`Send Feedback to Faculty`}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
