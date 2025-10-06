export async function getHostname(signalUrl) {
	try {
		const self = await fetch('/hostname');
		const js = await self.json();
		if (js.hostname) return js.hostname;
	} catch {}
	try {
		const url = signalUrl.replace('ws', 'http') + '/hostname';
		const r = await fetch(url);
		const js = await r.json();
		return js.hostname || 'unknown-host';
	} catch {}
	return 'unknown-host';
}


