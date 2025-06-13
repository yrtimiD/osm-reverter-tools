import os from 'node:os';
import fetch from 'node-fetch';
import readline from 'node:readline';

import 'dotenv/config';

import { initConfig } from './config.mjs';
import { debug, info, error } from './log.mjs';


const OAUTH_CONF = initConfig('osm-oauth2', { clientId: null, clientSecret: null });
const authUrl = process.env.PROD ? `https://www.openstreetmap.org` : `https://master.apis.dev.openstreetmap.org`;

export async function login() {
	let CLIENT_ID = process.env.CLIENT_ID ?? OAUTH_CONF.clientId;
	let CLIENT_SECRET = process.env.CLIENT_SECRET ?? OAUTH_CONF.clientSecret;

	return new Promise(async (resolve, reject) => {
		try {
			let oauthConfig = await fetch(`${authUrl}/.well-known/oauth-authorization-server`);
			let oauthAuthorizationServer = await oauthConfig.json();
			debug(oauthAuthorizationServer);

			async function getToken(authCode) {
				let r = await fetch(oauthAuthorizationServer.token_endpoint, {
					method: 'POST',
					body: `grant_type=authorization_code&code=${authCode}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
				});
				if (r.ok) {
					let data = await r.json();
					debug(`${r.status} ${r.statusText}${os.EOL}${JSON.stringify(data)}`);
					return data.access_token;
				} else {
					let text = await r.text();
					error(`Failed to get token: ${r.status} ${r.statusText}${os.EOL}${JSON.stringify(text)}`);
					return Promise.reject(`${r.status} ${r.statusText}`);
				}
			}

			let authCodeUrl = `${oauthAuthorizationServer.authorization_endpoint}?response_type=code&client_id=${CLIENT_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=write_changeset_comments%20read_prefs`;
			let prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
			info(`Login here: ${authCodeUrl}`);
			prompt.question(`Authorization code? `, async (code) => {
				prompt.close();

				let token = await getToken(code);
				resolve(token);
			});
		} catch (e) {
			reject(e);
		}
	});

}
