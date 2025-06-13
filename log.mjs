import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import colors from 'yoctocolors';
import { configFolder } from './config.mjs';


const logFile = path.join(configFolder, 'debug.log');
console.log(`Logging to ${logFile}`);
function appendLog(message) {
	fs.appendFileSync(logFile, message + os.EOL, 'utf-8');
}
export function debug(message) {
	let time = new Date().toISOString();
	message = `[D] ${message}`;
	appendLog(`${time} ${message}`);
}
export function info(message) {
	let time = new Date().toISOString();
	message = `[I] ${message}`;
	console.log(`${time} ${colors.white(message)}`);
	appendLog(`${time} ${message}`);
}
export function error(message) {
	let time = new Date().toISOString();
	if (message instanceof Error) {
		console.error(message);
	} else {
		message = `[E] ${message}`;
		console.error(`${time} ${colors.redBright(message)}`);
	}
	appendLog(`${time} ${message}`);
}
