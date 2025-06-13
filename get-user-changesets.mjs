#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { initConfig } from './config.mjs';
import { getApi, requestInterval, defaultErrorSleep } from './osm.mjs';


let OSM_CONFIG = initConfig('osm', { token: null, uid: null });
let osm = getApi(OSM_CONFIG.token);

try {
	let [, script, userId] = process.argv;
	if (!userId) {
		console.log(`Creates a list of all user changesets`);
		console.log(`Usage: ${path.basename(script)} <user_id>`);
		process.exit(1);
	}
	let allChangesets = await osm.getChangesets(userId);
	allChangesets.sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at)); // ensure reverse order (new to old)

	let resFile = path.join(process.cwd(), `${userId}.json`);
	let buff = [];
	while (allChangesets.length > 0) {
		let chunk = allChangesets.splice(0, 30);
		let csv = chunk.map(c => c.id).join(',');
		buff.push(csv);
	}
	fs.writeFileSync(resFile, `[${os.EOL}${buff.join(`,${os.EOL}`)}${os.EOL}]`, 'utf8');
	console.log(`Saved to: ${resFile}`);
} catch (e) {
	console.error('Error:', e);
}
