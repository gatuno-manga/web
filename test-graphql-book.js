fetch('http://localhost:3000/api/graphql', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		query: `
      query {
        book(id: "bcd6336d-a262-4c68-b704-4fda890ab66b") {
          id title tags { id name } sensitiveContent { id name }
        }
      }
    `,
	}),
})
	.then((r) => r.json())
	.then((data) => console.log(JSON.stringify(data, null, 2)))
	.catch(console.error);
