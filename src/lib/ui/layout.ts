export function shellLayout(width: number, height: number) {
	const layout = width >= 1024 ? 'desktop' : width > height ? 'landscape' : 'portrait';
	return {
		layout,
		dialog: layout === 'portrait' ? 'sheet' : 'centered',
		view: layout === 'portrait' ? 'fullscreen' : 'drawer'
	} as const;
}
