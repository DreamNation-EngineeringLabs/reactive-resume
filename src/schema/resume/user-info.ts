import z from "zod";
import {
	basicsSchema,
	pictureSchema,
	profileItemSchema,
	experienceItemSchema,
	educationItemSchema,
	projectItemSchema,
	skillItemSchema,
	languageItemSchema,
	interestItemSchema,
	awardItemSchema,
	certificationItemSchema,
	publicationItemSchema,
	volunteerItemSchema,
	referenceItemSchema,
} from "./data";

/**
 * Schema for the user's master profile info.
 * This stores all the user's details once, so they don't need to
 * re-enter them for every new resume they create.
 */
export const userInfoDataSchema = z.object({
	picture: pictureSchema.describe("The user's profile picture configuration."),
	basics: basicsSchema.describe("Basic contact information: name, email, phone, location, website."),
	summary: z.string().describe("A master summary/bio the user can maintain. HTML-formatted."),
	profiles: z.array(profileItemSchema).describe("Social/professional profiles (GitHub, LinkedIn, etc.)."),
	experience: z.array(experienceItemSchema).describe("All work experience entries."),
	education: z.array(educationItemSchema).describe("All education entries."),
	projects: z.array(projectItemSchema).describe("All project entries."),
	skills: z.array(skillItemSchema).describe("All skills."),
	languages: z.array(languageItemSchema).describe("Languages the user knows."),
	interests: z.array(interestItemSchema).describe("Hobbies and interests."),
	awards: z.array(awardItemSchema).describe("Awards and achievements."),
	certifications: z.array(certificationItemSchema).describe("Certifications and licenses."),
	publications: z.array(publicationItemSchema).describe("Publications and articles."),
	volunteer: z.array(volunteerItemSchema).describe("Volunteer experience."),
	references: z.array(referenceItemSchema).describe("Professional references."),
});

export type UserInfoData = z.infer<typeof userInfoDataSchema>;

export const defaultUserInfoData: UserInfoData = {
	picture: {
		hidden: false,
		url: "",
		size: 80,
		rotation: 0,
		aspectRatio: 1,
		borderRadius: 0,
		borderColor: "rgba(0, 0, 0, 0.5)",
		borderWidth: 0,
		shadowColor: "rgba(0, 0, 0, 0.5)",
		shadowWidth: 0,
	},
	basics: {
		name: "",
		headline: "",
		email: "",
		phone: "",
		location: "",
		website: { url: "", label: "" },
		customFields: [],
	},
	summary: "",
	profiles: [],
	experience: [],
	education: [],
	projects: [],
	skills: [],
	languages: [],
	interests: [],
	awards: [],
	certifications: [],
	publications: [],
	volunteer: [],
	references: [],
};
