/**
 * Global Test Definitions
 *
 * Allows the IDE to recognize Jest/Vitest globals without explicit imports
 */

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: ((value: any) => any) & {
	any: (type: any) => any;
	objectContaining: (obj: any) => any;
	arrayContaining: (arr: any[]) => any;
	stringMatching: (str: string | RegExp) => any;
};
declare const beforeAll: (fn: () => void | Promise<void>) => void;
declare const afterAll: (fn: () => void | Promise<void>) => void;
declare const beforeEach: (fn: () => void | Promise<void>) => void;
declare const afterEach: (fn: () => void | Promise<void>) => void;
declare const jest: any;
declare const vi: any;
