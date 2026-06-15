import { POSTED_KEY_PREFIX, POSTED_TTL_SECONDS } from './config';

/** Tracks which stories have already been posted, so we never post one twice. */
export class PostedStore {
	constructor(private readonly kv: KVNamespace) {}

	async has(storyId: number): Promise<boolean> {
		const marker = await this.kv.get(this.key(storyId));
		return marker !== null;
	}

	async add(storyId: number): Promise<void> {
		await this.kv.put(this.key(storyId), '1', { expirationTtl: POSTED_TTL_SECONDS });
	}

	async remove(storyId: number): Promise<void> {
		await this.kv.delete(this.key(storyId));
	}

	private key(storyId: number): string {
		return `${POSTED_KEY_PREFIX}${storyId}`;
	}
}
