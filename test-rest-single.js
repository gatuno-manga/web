fetch('http://localhost:3000/api/books/bcd6336d-a262-4c68-b704-4fda890ab66b')
	.then((r) => r.json())
	.then((data) => console.log(JSON.stringify(data.sensitiveContent, null, 2)))
	.catch(console.error);
