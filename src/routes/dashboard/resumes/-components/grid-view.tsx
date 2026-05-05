import { AnimatePresence, motion } from "motion/react";
import type { RouterOutput } from "@/integrations/orpc/client";
import { CreateResumeCard } from "./cards/create-card";
import { ResumeCard } from "./cards/resume-card";

type Resume = RouterOutput["resume"]["list"][number];

type Props = {
	resumes: Resume[];
};

export function GridView({ resumes }: Props) {
	return (
		<div className="grid 3xl:grid-cols-5 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			<AnimatePresence>
				{resumes?.map((resume, index) => (
					<motion.div
						layout
						key={resume.id}
						initial={{ opacity: 0, x: -50 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, y: -50, filter: "blur(12px)" }}
						transition={{ delay: index * 0.05 }}
					>
						<ResumeCard resume={resume} />
					</motion.div>
				))}
			</AnimatePresence>

			<motion.div
				initial={{ opacity: 0, x: -50 }}
				animate={{ opacity: 1, x: 0 }}
				exit={{ opacity: 0, x: -50 }}
				transition={{ delay: ((resumes?.length ?? 0) + 1) * 0.05 }}
			>
				<CreateResumeCard />
			</motion.div>
		</div>
	);
}
