fetch('http://localhost:3000/api/books?limit=5')
	.then((r) => r.json())
	.then((data) => {
		if (data.data) {
			console.log(Object.keys(data.data[0]));
		}
	})
	.catch(console.error);
