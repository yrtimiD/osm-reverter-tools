import fetch from 'node-fetch';
import os from 'node:os';

import * as log from './log.mjs';


const apiUrl = process.env.PROD ? `https://api.openstreetmap.org` : `https://master.apis.dev.openstreetmap.org`;

export const requestInterval = 1000;
export const defaultErrorSleep = 1 * 60 * 1000;

export function getApi(token) {
	async function api(method, url, body) {
		let headers = {
			'Content-Type': 'application/x-www-form-urlencoded'
		};
		if (token) headers['Authorization'] = `Bearer ${token}`;

		let r = await fetch(`${apiUrl}${url}`, {
			method,
			body,
			headers,
		});

		if (r.ok) {
			let data = await r.json();
			log.debug(`${method} ${url}${os.EOL}${body}${os.EOL}${os.EOL}${r.status} ${r.statusText}${os.EOL}${JSON.stringify(data)}`);
			return data;
		} else {
			let text = await r.text();
			log.debug(`${method} ${url}${os.EOL}${body}${os.EOL}${os.EOL}${r.status} ${r.statusText}${os.EOL}${text}`);
			throw Error(`${r.status} ${r.statusText}`);
		}
	};

	return {
		apiUrl,

		getUserDetails() {
			return api('GET', `/api/0.6/user/details.json`)
				.then(data => data.user);
		},

		getComments(changeset) {
			return api('GET', `/api/0.6/changeset/${changeset}.json?include_discussion=true`)
				.then(data => data.changeset.comments ?? []);
		},

		addComment(changeset, comment) {
			return api('POST', `/api/0.6/changeset/${changeset}/comment.json`, `text=${encodeURIComponent(comment)}`);
		},

		async getChangesets(userId) {
			let changesets = [];
			let baseQuery = `?user=${userId}`;
			let query = baseQuery;

			while (true) {
				let data = await api('GET', '/api/0.6/changesets.json' + query);
				changesets = changesets.concat(data.changesets);

				if (data.changesets.length < 100) {
					break;
				}

				const lastDate = data.changesets[data.changesets.length - 1].created_at;
				query = `${baseQuery}&time=2001-01-01,${lastDate}`;
			}

			return changesets;
		}

	};
}

