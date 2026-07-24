import express, { json } from 'express';
import cors from 'cors';

const app = express();

const PORT = 3000;

app.use(cors());
app.use(json());

app.get('/api/health', (req, res) => {
	res.json({
		status: 'ok',
		message: 'Bibot backend online 🤖'
	});
});

app.post('/api/chat', (req, res) => {
	const { message } = req.body;

	console.log('Messaggio ricevuto:', message);

	res.json({
		response: `Bibot ha ricevuto: ${message}`
	});
});

app.listen(PORT, () => {
	console.log(`Bibot backend in ascolto su http://localhost:${PORT}`);
});