import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../api.config';

export type AssistantMode = 'CHAT' | 'SOMMELIER_ANALYSIS';
export interface AssistantMessage { role: 'user' | 'assistant'; content: string; }
export interface AssistantContext { spaceId: string; cellarId?: string | null; }
export interface AssistantChatResponse {
  reply: string;
  mode: AssistantMode;
  context_summary: {
    space: { id: string; name: string; purpose: 'COLLECTOR' | 'BUSINESS' };
    cellar: { id: string; name: string } | null;
  };
}
export const ASSISTANT_MESSAGE_LIMIT = 2000;

@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly http = inject(HttpClient);

  chat(context: AssistantContext, mode: AssistantMode, message: string, history: readonly AssistantMessage[]): Observable<AssistantChatResponse> {
    return this.http.post<AssistantChatResponse>(API_CONFIG.baseUrl + API_CONFIG.endpoints.assistantChat, {
      space_id: context.spaceId,
      ...(context.cellarId ? { cellar_id: context.cellarId } : {}),
      mode, message: message.trim(),
      // Completed turns only. Keep the backend's 10-message / 2000-character limits.
      history: history.slice(-10).map(({ role, content }) => ({ role, content: content.trim().slice(0, ASSISTANT_MESSAGE_LIMIT) })),
    });
  }
}
