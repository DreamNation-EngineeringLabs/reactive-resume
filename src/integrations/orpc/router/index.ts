import { aiRouter } from "./ai";
import { authRouter } from "./auth";
import { flagsRouter } from "./flags";
import { printerRouter } from "./printer";
import { resumeRouter } from "./resume";
import { statisticsRouter } from "./statistics";
import { storageRouter } from "./storage";
import { userInfoRouter } from "./user-info";

export default {
	ai: aiRouter,
	auth: authRouter,
	flags: flagsRouter,
	resume: resumeRouter,
	storage: storageRouter,
	printer: printerRouter,
	statistics: statisticsRouter,
	userInfo: userInfoRouter,
};
