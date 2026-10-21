# API (all require `Authorization: Bearer <supabase JWT>`, envelope `{ok,data|error}`)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | /api/documents/upload | multipart `file`, `title?` | 201 document (`uploading`) |
| POST | /api/documents/text | `{title,text}` | 201 document |
| GET | /api/documents | — | list own docs |
| GET | /api/documents/:id | — | doc incl. `status` |
| DELETE | /api/documents/:id | — | `{ok:true}` |
| POST | /api/documents/:id/quiz | `{count 5-50,difficulty}` | quiz row |
| POST | /api/documents/:id/exam-questions | — | exam questions |
| POST | /api/documents/:id/summary | `{type}` | markdown |
| POST | /api/documents/:id/flashcards | — | `{set,cards}` |
| POST | /api/documents/:id/code-examples | — | examples[] |
| POST | /api/documents/:id/chat | `{message,sessionId?}` | `{answer,sources,sessionId}` or SSE |
| GET | /api/documents/:id/chat/history | — | latest session+messages |
| POST | /api/quizzes/:id/attempts | `{answers,durationSec}` | attempt + per-question results |
| GET | /api/progress/overview | — | `{attempts,documents,accuracyTrend,streak}` |
| GET | /api/progress/topics | — | `{topics[{topic,accuracy}],weak[]}` |
