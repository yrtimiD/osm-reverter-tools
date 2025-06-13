#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'node:fs';
import os from 'node:os';
import path, { resolve } from 'node:path';
import readline from 'node:readline';
import 'dotenv/config';
import { setTimeout as sleep } from 'node:timers/promises';
import { error } from 'node:console';

let requestSleep = 1000;
let errorSleep = 10 * 60 * 1000;

let apiUrl = process.env.PROD ? `https://api.openstreetmap.org` : `https://master.apis.dev.openstreetmap.org`;
let authUrl = process.env.PROD ? `https://www.openstreetmap.org` : `https://master.apis.dev.openstreetmap.org`;

let configFile = path.join(os.homedir(), '.config', 'add-changeset-comment', 'config.json');
let CONFIG = {
	token: null,
	uid: null,
};

//#region Config
async function loadConfig() {
	if (fs.existsSync(configFile)) {
		CONFIG = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
	} else {
		saveConfig();
	}
}

async function saveConfig() {
	if (!fs.existsSync(path.dirname(configFile))) {
		fs.mkdirSync(path.dirname(configFile), { recursive: true });
	}
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
			saveConfig();

			async function getToken(authCode) {
				let r = await fetch(oauthAuthorizationServer.token_endpoint, {
					method: 'POST',
					body: `grant_type=authorization_code&code=${authCode}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
				});
				if (r.ok) {
					let d = await r.json();
					return d.access_token;
				} else {
					return Promise.reject(`${r.status} ${r.statusText}`);
				}
			}

			let authCodeUrl = `${oauthAuthorizationServer.authorization_endpoint}?response_type=code&client_id=${CLIENT_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=write_changeset_comments%20read_prefs`;
			let prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
			console.log(`Login here: ${authCodeUrl}`);
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
		return await r.json();
	} else {
		throw Error(`${r.status} ${r.statusText}`);
	}
}

function getUserDetails() {
	return api('GET', `/api/0.6/user/details.json`)
		.then(data => {
			CONFIG.uid = data.user.id;
			saveConfig();
			console.log(`Logged in as "${data.user.display_name}" (${data.user.id})`);
		});
}

async function getComments(changeset) {
	return api('GET', `/api/0.6/changeset/${changeset}.json?include_discussion=true`)
		.then(data => data.changeset.comments);
}

async function addComment(changeset, comment) {
	let comments = await getComments(changeset);
	let hasComment = comments.some(c => c.text === comment);
	if (hasComment) {
		console.log(`C${changeset}: comment already exists`);
		return;
	}

	let data = await api('POST', `/api/0.6/changeset/${changeset}/comment.json`, `text=${encodeURIComponent(comment)}`);
}
//#endregion

async function run() {
	console.log("Starting...");
	let queue = [418117, 418116];
	while (queue.length > 0) {
		let changeset = queue[0];
		try {
			await addComment(changeset, `test: ${new Date().toISOString()}`);
			console.log(`${changeset}: added`);
			queue.shift();
			await sleep(requestSleep);
		} catch (e) {
			console.error(`${changeset}: failed to add comment: ${e.message}`);
			console.log(`Sleeping for ${errorSleep / 1000} sec...`);
			await sleep(errorSleep);
		}
	}
}

loadConfig()
	.then(login)
	.then(getUserDetails)
	.then(run)
	.catch(e => console.log(e));

