fetch('http://localhost:3000/api/graphql', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		query: `
      query GetBooks($filter: BookFilterInput) {
        books(filter: $filter) {
          data { id title cover }
        }
      }
    `,
		variables: {
			filter: { ids: ['bcd6336d-a262-4c68-b704-4fda890ab66b'] },
		},
	}),
})
	.then((r) => r.json())
	.then(console.log)
	.catch(console.error);
