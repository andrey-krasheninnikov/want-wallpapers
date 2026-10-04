import { SQL } from 'bun';
import { readFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import { join } from 'node:path';
export const secretDirectory = process.env.TEST_SECRETS_DIR ?? `/tmp/want-wallpapers-test-${userInfo().uid}`;
const url = readFileSync(join(secretDirectory, 'ui_database_url'), 'utf8').trim();
if (!/^postgresql:\/\/postgres:[a-f0-9]+@127\.0\.0\.1:\d+\/wallpapers_ui_[a-f0-9]+\?sslmode=disable$/.test(url)) throw new Error('UI tests require an isolated local database.');
export const database = new SQL(url);
