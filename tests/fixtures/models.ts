export interface Step {
	title: string;
}

export function decompose(step: Step): Step[] {
	return [];
}

export const config = { retries: 3 };
