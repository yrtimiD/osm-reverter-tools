# OSM-REVERTER-TOOLS

# OAuth2 app register
* Open https://www.openstreetmap.org/oauth2/applications/new
* Name: any
* Redirect URIs: `urn:ietf:wg:oauth:2.0:oob`
* Confidential application?: check
* Permissions: Read user preferences, Comment on changesets
* Configure `~/.config/osm-tools/osm-oauth2.json`:
	```json
	{
	  "clientId": "<client id>",
	  "clientSecret": "<client secret>"
	}
	```
* If `~/.config/osm-tools/osm.json` exists delete the file itself to force re-login with new client-id and client-secret

# Run
```shell
PROD=yes ./add-changeset-comment.mjs @comment.txt @changesets.json
```
