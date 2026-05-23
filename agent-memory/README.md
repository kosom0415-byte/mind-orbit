# Agent Memory

이 폴더는 GPT PM Agent와 Codex Engineer Agent가 장기 작업 맥락을 문서로 공유하기 위한 로컬 메모리 공간입니다.

현재 단계에서는 실제 API 호출이나 자동 동기화를 하지 않습니다. 각 파일은 사람이 읽고 검토할 수 있는 markdown 기록으로 유지합니다.

## Files

- `workflow-state.md`: 현재 협업 루프의 상태 요약
- `decision-log.md`: 사람이 승인했거나 Agent가 판단한 결정 기록
- `open-questions.md`: GPT PM Agent 또는 사람에게 확인해야 하는 질문

## Safety

- API key, env 값, token, password, secret을 기록하지 않습니다.
- Production 변경 승인 여부는 명시적으로 기록합니다.
- 불확실한 결정은 Codex가 임의로 진행하지 않고 질문으로 남깁니다.
