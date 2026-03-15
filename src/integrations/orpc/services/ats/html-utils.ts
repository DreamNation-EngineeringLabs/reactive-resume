/** Extract visible text from HTML content */
export function stripHtml(html: string): string {
	return html
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** Replace a specific bullet's text within an HTML description by matching its stripped text */
export function replaceBulletInHtml(html: string, oldText: string, newText: string): string {
	const liRegex = /(<li[^>]*>)([\s\S]*?)(<\/li>)/gi;

	let replaced = false;
	const result = html.replace(liRegex, (match, openTag, content, closeTag) => {
		if (replaced) return match;
		const strippedContent = stripHtml(content);
		if (strippedContent.trim() === oldText.trim()) {
			replaced = true;
			return `${openTag}${newText}${closeTag}`;
		}
		return match;
	});

	return result;
}

/** Remove a specific bullet from an HTML description by matching its stripped text */
export function removeBulletFromHtml(html: string, bulletText: string): string {
	const liRegex = /<li[^>]*>[\s\S]*?<\/li>/gi;

	return html.replace(liRegex, (match) => {
		const stripped = stripHtml(match);
		if (stripped.trim() === bulletText.trim()) {
			return "";
		}
		return match;
	});
}
