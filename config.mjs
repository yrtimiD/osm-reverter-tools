import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';


export const configFolder = path.join(os.homedir(), '.config', 'osm-tools');
fs.mkdirSync(configFolder, { recursive: true });

export function initConfig(name, defaults) {
	const configFile = path.join(configFolder, `${name}.json`);
	const config = { ...defaults, _name: name, _file: configFile };

	config._save = function saveConfig() {
		let json = JSON.stringify(config, (key, value) => key.startsWith('_') ? undefined : value, 2);
		fs.writeFileSync(configFile, json, 'utf8');
	}
	config._reload = function reloadConfig() {
		if (fs.existsSync(configFile)) {
			let loaded = JSON.parse(fs.readFileSync(configFile, 'utf-8'))
			Object.assign(config, loaded);
		}
	}

	config._reload();
	config._save();

	return new Proxy(config, {
		set(target, property, value) {
			target[property] = value;
			target._save();
			return true;
		}
	});
}
