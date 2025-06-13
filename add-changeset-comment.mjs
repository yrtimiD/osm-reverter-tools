#!/usr/bin/env node

import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs/promises';
import path from 'node:path';

import { initConfig } from './config.mjs';
import * as log from './log.mjs';
import { login } from './osm-oauth2.mjs';
import { getApi, requestInterval, defaultErrorSleep } from './osm.mjs';


const OSM_CONFIG = initConfig('osm', { token: null, uid: null });
let osm = null;

async function ensureAuth() {
	if (OSM_CONFIG.token) {
		return;
	} else {
		OSM_CONFIG.token = await login();
	}
}
async function getUserDetails() {
	let osm = getApi(OSM_CONFIG.token);
	log.info(`Using ${osm.apiUrl}`);
	let user = await osm.getUserDetails();
	OSM_CONFIG.uid = user.id;
	log.info(`Logged in as "${user.display_name}" (${user.id})`);
}

async function main() {
	log.debug(`New execution: ${process.argv.join(' ')}`);
	let [, script, commentFile, changesets] = process.argv;
	if (!commentFile || !changesets) {
		console.log(`Adds a changeset discussion comment to all changesets in the list`);
		console.log(`Usage: ${path.basename(script)} @<comment-file> @<changesets-json-array-file>`);
		console.log(`       alternatively can pass a comma-separated-list-of-changesets (e.g. ${path.basename(script)} 1,2,3)`);
		process.exit(1);
	}

	let comment = null;
	try {
		if (commentFile.startsWith('@')) {
			commentFile = commentFile.substring(1);
			comment = await fs.readFile(commentFile, 'utf-8');
			if (!comment || comment.length === 0) throw new Error(`Comment file ${commentFile} should contain some text`);
		} else {
			throw new Error(`comment-file argument expected to be @-prefixed, e.g. @text.txt`);
		}
	} catch (e) {
		log.error(e);
		process.exit(2);
	}

	await ensureAuth();
	await getUserDetails();
	osm = getApi(OSM_CONFIG.token);
	if (changesets.startsWith('@')) {
		await runWithFile(changesets.substring(1), comment);
	} else {
		await runWithList(changesets.split(','), comment);
	}
}
// const queue = [418117, 418116];

async function runWithList(queue, comment) {
	log.info(`Processing ${queue.length} items in the queue...`);

	while (queue.length > 0) {
		let changeset = queue.shift();
		await createComment(changeset, comment);
		await sleep(requestInterval);
	}

	log.info("All done");
}

async function runWithFile(fileName, comment) {
	let fileContent = await fs.readFile(fileName, 'utf-8');
	let queue = JSON.parse(fileContent);
	log.info(`Processing ${queue.length} items in the queue...`);
	let total = queue.length;
	let count = 0;
	while (queue.length > 0) {
		count++;
		let changeset = queue.shift();
		log.info(`${count}/${total} ${osm.apiUrl}/changeset/${changeset}`);

		await createComment(changeset, comment);
		await fs.writeFile(fileName, JSON.stringify(queue), 'utf-8');
		await sleep(requestInterval);
	}

	log.info("All done");
}

async function createComment(changeset, comment) {
	let success = false;
	let errorSleep = defaultErrorSleep;

	while (!success) {
		try {
			let comments = await osm.getComments(changeset);
			let hasComment = comments.some(c => c.text === comment);
			if (hasComment) {
				log.info(`${changeset}: comment already exists`);
			} else {
				await osm.addComment(changeset, comment);
				log.info(`${changeset}: comment was added`);
			}
			success = true;
			errorSleep = defaultErrorSleep;
		} catch (e) {
			log.error(`${changeset}: failed to add comment: ${e.message}`);
			log.info(`Sleeping for ${Math.floor(errorSleep / 60000)} min ${errorSleep / 1000 % 60} sec...`);
			await sleep(errorSleep);
			errorSleep *= 2;
		}
	}
}

main()
	.catch(e => {
		log.error(e);
	});