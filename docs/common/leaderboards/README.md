# Leaderboard pages

The shared web leaderboard requests ten rows for the page the player selects. It does not preload other pages. Previous and Next use server cursors, and the selected page determines the displayed rank numbers. The server returns a next-page cursor instead of counting the entire ranking.

The game session caches each visited page by ranking and page number for 60 seconds. Returning to a fresh page, including reopening the modal, uses that cache immediately. An uncached or expired page shows the existing preloader while its request runs. Retry requests the selected page. Refreshing an earlier page removes cached later pages so their cursors cannot describe a different traversal.

Account changes, ranking changes and profile updates clear the cache and retire pending requests. Request IDs prevent an older response from replacing a newer selection. Cached public rows remain in memory only.

`getLeaderboard` uses descending score and document ID cursors. Canonical rows retain live-account checks and current names and avatars. Missing projections fall back to indexed user queries. Multiplayer pages merge bounded user and AI queries with the same ordering. The server reads one extra candidate per source to determine whether another page exists, and may read replacement candidates for deleted or invalid rows.

Updated callers opt into paginated responses. Legacy callers retain the existing response shape until their platform artifacts are updated. Deploy the required Firestore indexes before deploying the updated callable, then release the web client. Android continues to request its existing initial row limit through the shared adapter.
