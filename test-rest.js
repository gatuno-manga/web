fetch(
	'http://localhost:3000/api/books?ids=bcd6336d-a262-4c68-b704-4fda890ab66b',
)
	.then((r) => r.json())
	.then((data) => console.log(JSON.stringify(data.data[0], null, 2)))
	.catch(console.error);
