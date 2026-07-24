import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface RispostaChat {
	response: string;
}

@Injectable({
	providedIn: 'root'
})
export class ChatService {
	private http = inject(HttpClient);

	private apiUrl = 'http://localhost:3000/api';

	inviaMessaggio(message: string): Observable<RispostaChat> {
		return this.http.post<RispostaChat>(
			`${this.apiUrl}/chat`,
			{ message }
		);
	}
}