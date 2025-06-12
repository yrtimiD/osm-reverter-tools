#!/usr/bin/env node

import path from 'node:path';
import fetch from 'node-fetch';

async function getChangesets(userId) {
	let changesets = [];
	let baseUrl = `http://api.openstreetmap.org/api/0.6/changesets.json?user=${userId}`;
	let url = baseUrl;

	while (true) {
		const response = await fetch(url);
		const data = await response.json();
		changesets = changesets.concat(data.changesets);

		if (data.changesets.length < 100) {
			break;
		}

		const lastDate = data.changesets[data.changesets.length - 1].created_at;
		url = `${baseUrl}&time=2001-01-01,${lastDate}`;
	}

	return changesets;
}

try {
	let [, script, userId] = process.argv;
	if (!userId) {
		console.log(`Prints list of all user changesets`);
		console.log(`Usage: ${path.basename(script)} <user_id>`);
		process.exit(1);
	}
	let allChangesets = await getChangesets(userId);
	allChangesets.sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at)); // ensure reverse order (new to old)

	console.log(`${allChangesets.length} changesets in groups of 30:`);
	while (allChangesets.length > 0) {
		let chunk = allChangesets.splice(0, 30);
		let csv = chunk.map(c => c.id).join(',');
		console.log(csv);
		console.log();
	}

} catch (e) {
	console.error('Error:', e);
}