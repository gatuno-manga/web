/* eslint-disable no-undef */
importScripts('./ngsw-worker.js');

const DB_NAME = 'gatuno_db';
const SYNC_STORE = 'sync_queue';
const API_BASE_URL = '/api/users/me/reading-progress';

self.addEventListener('sync', (event) => {
	if (event.tag === 'sync-reading-progress') {
		console.log('[SW] Background Sync triggered: sync-reading-progress');
		event.waitUntil(syncReadingProgress());
	}
});

async function syncReadingProgress() {
	try {
		const db = await openDatabase();
		const items = await getSyncQueue(db);

		if (items.length === 0) {
			console.log('[SW] No items in sync queue');
			return;
		}

		console.log(`[SW] Syncing ${items.length} items...`);

		for (const item of items) {
			try {
				const success = await sendProgress(item);
				if (success) {
					await removeFromQueue(db, item.chapterId);
					console.log(`[SW] Successfully synced chapter: ${item.chapterId}`);
				}
			} catch (err) {
				console.error(`[SW] Failed to sync chapter ${item.chapterId}:`, err);
			}
		}
	} catch (err) {
		console.error('[SW] Error during sync process:', err);
	}
}

function openDatabase() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
	});
}

function getSyncQueue(db) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([SYNC_STORE], 'readonly');
		const store = transaction.objectStore(SYNC_STORE);
		const request = store.getAll();
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
	});
}

function removeFromQueue(db, chapterId) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([SYNC_STORE], 'readwrite');
		const store = transaction.objectStore(SYNC_STORE);
		const request = store.delete(chapterId);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

async function sendProgress(item) {
	const payload = {
		chapterId: item.chapterId,
		bookId: item.bookId,
		pageIndex: item.pageIndex,
		totalPages: item.totalPages,
		completed: item.completed,
	};

	const response = await fetch(API_BASE_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${item.accessToken}`,
		},
		body: JSON.stringify(payload),
	});

	return response.ok;
}
