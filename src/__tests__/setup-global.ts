/**
 * Global Test Setup
 */
/* @ts-expect-error */
declare const beforeAll: any;
/* @ts-expect-error */
declare const afterAll: any;

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key";

// Mock browser APIs if needed
if (typeof window === "undefined") {
	global.window = {} as any;
}

// Suppress console errors in tests (optional)
const originalError = console.error;
beforeAll(() => {
	console.error = (...args: any[]) => {
		if (typeof args[0] === "string" && args[0].includes("Warning: ReactDOM.render")) {
			return;
		}
		originalError.call(console, ...args);
	};
});

afterAll(() => {
	console.error = originalError;
});
