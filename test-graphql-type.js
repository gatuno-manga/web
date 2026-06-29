fetch('http://localhost:3000/api/graphql', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		query: `
      query {
        __type(name: "Book") {
          fields { name }
        }
      }
    `,
	}),
})
	.then((r) => r.json())
	.then((data) => console.log(data.data.__type.fields.map((f) => f.name)))
	.catch(console.error);
