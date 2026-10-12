// Sets the theme before CSS paints. Keep the colors in step with THEME_COLOR.
(function () {
	var key = 'coding-drills:v1:preferences';
	var colors = { light: '#f6f7fb', dark: '#1c1c25' };
	var choice = 'system';
	try {
		var raw = localStorage.getItem(key);
		if (raw) {
			var parsed = JSON.parse(raw);
			if (parsed && (parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system')) {
				choice = parsed.theme;
			}
		}
	} catch (error) {
		choice = 'system';
	}
	var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	var resolved = choice === 'light' || choice === 'dark' ? choice : dark ? 'dark' : 'light';
	document.documentElement.dataset.theme = resolved;
	document.documentElement.style.colorScheme = resolved;
	if (choice === 'system') return;
	var meta = document.createElement('meta');
	meta.id = 'theme-color-choice';
	meta.name = 'theme-color';
	meta.content = colors[resolved];
	document.head.appendChild(meta);
})();
