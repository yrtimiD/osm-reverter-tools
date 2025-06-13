#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { setTimeout as sleep } from 'node:timers/promises';
import 'dotenv/config';
import colors from 'yoctocolors';

const requestSleep = 1000;
const defaultErrorSleep = 1 * 60 * 1000;

const apiUrl = process.env.PROD ? `https://api.openstreetmap.org` : `https://master.apis.dev.openstreetmap.org`;
const authUrl = process.env.PROD ? `https://www.openstreetmap.org` : `https://master.apis.dev.openstreetmap.org`;

const configFolder = path.join(os.homedir(), '.config', 'add-changeset-comment');
fs.mkdirSync(configFolder, { recursive: true });

const configFile = path.join(configFolder, 'config.json');
let CONFIG = {
	token: null,
	uid: null,
};

//#region Log
const logFile = path.join(configFolder, 'debug.log');
console.log(`Logging to ${logFile}`);
function appendLog(message) {
	fs.appendFileSync(logFile, message + os.EOL, 'utf-8');
}
function debug(message) {
	let time = new Date().toISOString();
	message = `[D] ${message}`;
	appendLog(`${time} ${message}`);
}
function log(message) {
	let time = new Date().toISOString();
	message = `[I] ${message}`;
	console.log(`${time} ${colors.white(message)}`);
	appendLog(`${time} ${message}`);
}
function error(message) {
	let time = new Date().toISOString();
	message = `[E] ${message}`;
	console.log(`${time} ${colors.redBright(message)}`);
	appendLog(`${time} ${message}`);
}
//#endregion

//#region Config
async function loadConfig() {
	if (fs.existsSync(configFile)) {
		CONFIG = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
	} else {
		saveConfig();
	}
}

async function saveConfig() {
	fs.writeFileSync(configFile, JSON.stringify(CONFIG, null, 2), 'utf8');
}
//#endregion

//#region Auth
async function login() {
	if (CONFIG.token) return Promise.resolve();

	let { CLIENT_ID, CLIENT_SECRET } = process.env;

	return new Promise(async (resolve, reject) => {
		try {
			let oauthConfig = await fetch(`${authUrl}/.well-known/oauth-authorization-server`);
			let oauthAuthorizationServer = await oauthConfig.json();
			debug(oauthAuthorizationServer);
			saveConfig();

			async function getToken(authCode) {
				let r = await fetch(oauthAuthorizationServer.token_endpoint, {
					method: 'POST',
					body: `grant_type=authorization_code&code=${authCode}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
				});
				if (r.ok) {
					let d = await r.json();
					debug(oauthAuthorizationServer);
					return d.access_token;
				} else {
					return Promise.reject(`${r.status} ${r.statusText}`);
				}
			}

			let authCodeUrl = `${oauthAuthorizationServer.authorization_endpoint}?response_type=code&client_id=${CLIENT_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=write_changeset_comments%20read_prefs`;
			let prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
			log(`Login here: ${authCodeUrl}`);
			prompt.question(`Authorization code? `, async (code) => {
				prompt.close();

				CONFIG.token = await getToken(code);
				saveConfig();

				resolve();
			});
		} catch (e) {
			reject(e);
		}
	});

}
//#endregion

//#region API
async function api(method, url, body) {
	let r = await fetch(`${apiUrl}${url}`, {
		method,
		body,
		headers: {
			'Authorization': `Bearer ${CONFIG.token}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	});
	if (r.ok) {
		let data = await r.json();
		debug(`${method} ${url}${os.EOL}${body}${os.EOL}${os.EOL}${r.status} ${r.statusText}${os.EOL}${JSON.stringify(data)}`);
		return data;
	} else {
		let text = await r.text();
		debug(`${method} ${url}${os.EOL}${body}${os.EOL}${os.EOL}${r.status} ${r.statusText}${os.EOL}${text}`);
		throw Error(`${r.status} ${r.statusText}`);
	}
}

function getUserDetails() {
	return api('GET', `/api/0.6/user/details.json`)
		.then(data => {
			CONFIG.uid = data.user.id;
			saveConfig();
			log(`Logged in as "${data.user.display_name}" (${data.user.id})`);
		});
}

async function getComments(changeset) {
	return api('GET', `/api/0.6/changeset/${changeset}.json?include_discussion=true`)
		.then(data => data.changeset.comments ?? []);
}

async function addComment(changeset, comment) {
	let data = await api('POST', `/api/0.6/changeset/${changeset}/comment.json`, `text=${encodeURIComponent(comment)}`);
}
//#endregion

async function run() {
	const comment = `test`;
	const queue = [418117, 418116];
	log(`Processing ${queue.length} items in the queue...`);

	let errorSleep = defaultErrorSleep;
	while (queue.length > 0) {
		let changeset = queue.shift();
		log(`${apiUrl}/changeset/${changeset}`);
		try {
			let comments = await getComments(changeset);
			let hasComment = comments.some(c => c.text === comment);
			if (hasComment) {
				log(`${changeset}: comment already exists`);
			} else {
				await addComment(changeset, comment);
				log(`${changeset}: comment was added`);
			}

			await sleep(requestSleep);
			errorSleep = defaultErrorSleep;
		} catch (e) {
			queue.unshift(changeset);
			error(`${changeset}: failed to add comment: ${e.message}`);
			log(`Sleeping for ${errorSleep / 1000} sec...`);
			await sleep(errorSleep);
			errorSleep *= 2;
		}
	}

	log("All done");
}

loadConfig()
	.then(login)
	.then(getUserDetails)
	.then(run)
	.catch(e => log(e));

