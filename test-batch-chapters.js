fetch('http://localhost:3000/api/chapters/batch/data', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(['some-chapter-id']),
})
	.then((r) => r.json())
	.then(console.log)
	.catch(console.error);
