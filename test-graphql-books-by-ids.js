fetch('http://localhost:3000/api/graphql', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		query: `
      query {
        __schema {
          queryType {
            fields {
              name
              args { name }
            }
          }
        }
      }
    `,
	}),
})
	.then((r) => r.json())
	.then((data) =>
		console.log(data.data.__schema.queryType.fields.map((f) => f.name)),
	)
	.catch(console.error);
