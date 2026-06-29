fetch('http://localhost:3000/api/graphql', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		query: `
      query GetBooks($filter: BookFilterInput) {
        books(filter: $filter) {
          data { id title sensitiveContent { name } }
        }
      }
    `,
		variables: { filter: { ids: ['some-id'] } },
	}),
})
	.then((r) => r.json())
	.then(console.log)
	.catch(console.error);
